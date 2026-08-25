import { AbstractFlowrAnalyzerContext } from './abstract-flowr-analyzer-context';
import {
	FlowrAnalyzerPackageVersionsPlugin,
	type SigDbLoadedInfo
} from '../plugins/package-version-plugins/flowr-analyzer-package-versions-plugin';
import { Package } from '../plugins/package-version-plugins/package';
import type { PackageSignatureSource } from '../sigdb/reader';
import { Identifier } from '../../dataflow/environments/identifier';
import type { DecodedFunction } from '../sigdb/decode';
import type { Range } from 'semver';
import type { FlowrAnalyzerFunctionsContext, ReadOnlyFlowrAnalyzerFunctionsContext } from './flowr-analyzer-functions-context';
import type { InvalidationEvent, InvalidationEventReceiver } from '../cache/flowr-cache';
import { resetOnFullInvalidation } from '../cache/flowr-cache';
import { isSigDbEnabled } from '../../config';
import { RRange } from '../../util/r-version';
import { uniqueArray } from '../../util/collections/arrays';
import { signatureDbOf, type SignatureDb } from '../sigdb/signature-db';

/**
 * Read-only interface to the {@link FlowrAnalyzerDependenciesContext} for inspecting dependencies without modifying them.
 */
export interface ReadOnlyFlowrAnalyzerDependenciesContext {
	/**
	 * The name of this context.
	 */
	readonly name:             string;
	/**
	 * The functions context associated with this dependencies-context.
	 */
	readonly functionsContext: ReadOnlyFlowrAnalyzerFunctionsContext;
	/**
	 * Get the dependency with the given name, if it exists.
	 *
	 * If the static dependencies have not yet been loaded, this may trigger a resolution step.
	 * Pass `version` to pin the resolution to a constraint (an exact version string, or a {@link Range}; uncached;
	 * `versionOverrides` config still wins, base-R stays tied to the assumed R version); otherwise the version
	 * comes from the declared constraints.
	 * @param name    - The name of the dependency to get.
	 * @param version - Optional version constraint to pin the resolution to (exact version string or a {@link Range}).
	 * @returns The dependency with the given name, or undefined if it does not exist.
	 */
	getDependency(name: string, version?: string | Range): Readonly<Package> | undefined;

	/**
	 * The versions a dependency can possibly have: its {@link Package.derivedRange|derived range}, but only once
	 * some version can satisfy it. `undefined` if the dependency is unknown, if nothing constrains it, or if the
	 * sources contradict each other, since then no version is possible at all.
	 *
	 * For *why* it is what it is (the individual constraints, or the version the database resolved to), take the
	 * {@link Package} from {@link getDependency}.
	 * @param name - The name of the dependency.
	 */
	inferredRange(name: string): Range | undefined;

	/**
	 * Get all dependencies known to this context.
	 */
	getDependencies(): readonly Readonly<Package>[];

	/**
	 * Every package name the project *declares* (`Depends`/`Imports`/`Suggests`/`LinkingTo`/`Enhances`), whether or
	 * not it became a loadable dependency here. `Suggests` do not, yet they still name packages the project may install.
	 */
	declaredPackageNames(): readonly string[];

	/**
	 * Metadata of the signature databases the version plugins currently have loaded.
	 */
	loadedSignatureDatabases(): SigDbLoadedInfo[];

	/**
	 * The identifying names (scopes, e.g. `base`/`current`/`history`) of the signature databases currently
	 * available, deduplicated. A simple view over {@link loadedSignatureDatabases} for checking what a project
	 * can resolve against; empty when the signature database is disabled or none is loaded.
	 */
	availableSignatureDatabases(): readonly string[];

	/**
	 * Whether at least one signature database is available (i.e., {@link availableSignatureDatabases} is non-empty).
	 * Cheaper than materializing the list when only the presence matters.
	 */
	hasSignatureDatabase(): boolean;

	/**
	 * The names of known packages that export `name` (from the version plugins' signature databases). Used to
	 * hint which `library()`/`::` might be missing for an otherwise-undefined symbol. Empty if no database is
	 * available or the signature database is disabled.
	 */
	packagesExporting(name: string): readonly string[];

	/**
	 * The way to reach the signature database programmatically.
	 *
	 * Everything the database can answer is on the returned {@link SignatureDb}, and it answers for the version
	 * _this project_ assumes for each package, which is the one `solver.sigdb.versionOverrides`,
	 * `solver.sigdb.versionSelection` and `solver.sigdb.assumedRVersion` produced. A bare
	 * {@link PackageSignatureSource} would instead answer for whatever it happens to hold as newest.
	 * @example
	 * ```ts
	 * const db = analyzer.inspectContext().deps.signatures();
	 * db.versionOf('dplyr');                              // the version the analysis assumes
	 * db.functionOf(Identifier.make('lead', 'dplyr'));    // its database entry
	 * db.parametersOf(Identifier.make('lead', 'dplyr'));  // its formals, ready for MatchArgs.toNames
	 * ```
	 */
	signatures(): SignatureDb;

	/**
	 * The signature sources the version plugins currently have loaded, as they are. Prefer
	 * {@link signatures}, which is the same sources as one database with the versions already resolved.
	 */
	signatureSources(): readonly PackageSignatureSource[];

	/**
	 * The signature-database entry for the qualified call `id` (a `pkg::fn` {@link Identifier}) from the first
	 * {@link signatureSources|source} that has it, resolving the package version from the project's dependency info
	 * unless `version` overrides it. This is the easy way to obtain a function's parameters from a context: pass
	 * `fn.signature` to {@link MatchArgs.toNames}. `undefined` if `id` is unqualified or no loaded source defines it.
	 * @useInstead {@link SignatureDb.functionOf}
	 */
	signatureOf(id: Identifier, version?: string): DecodedFunction | undefined;
}

/**
 * Manages the project's dependencies, their versions, and their interplay with {@link FlowrAnalyzerPackageVersionsPlugin}s.
 */
export class FlowrAnalyzerDependenciesContext extends AbstractFlowrAnalyzerContext<undefined, void, FlowrAnalyzerPackageVersionsPlugin> implements ReadOnlyFlowrAnalyzerDependenciesContext, InvalidationEventReceiver {
	public readonly name = 'flowr-analyzer-dependencies-context';

	public readonly functionsContext: FlowrAnalyzerFunctionsContext;

	private dependencies:  Map<string, Package> = new Map();
	/** what {@link getDependency} resolved for a package the project does not depend on, so a lookup never makes it one */
	private resolvedOnly:  Map<string, Package> = new Map();
	private staticsLoaded = false;
	/** resolvers consulted lazily to fill in exports; `existing` carries version info from other plugins */
	private lazyResolvers: ((name: string, existing?: Package) => Package | undefined)[] = [];
	private resolvedMisses = new Set<string>();

	public reset(): void {
		this.dependencies = new Map();
		this.resolvedOnly = new Map();
		this.staticsLoaded = false;
		this.lazyResolvers = [];
		this.resolvedMisses = new Set();
	}

	/** Register a resolver consulted by {@link getDependency} to fill in a package's exports lazily. */
	public addLazyResolver(resolver: (name: string, existing?: Package) => Package | undefined): void {
		this.lazyResolvers.push(resolver);
	}

	public loadedSignatureDatabases(): SigDbLoadedInfo[] {
		if(!isSigDbEnabled(this.ctx.config)) {
			return [];
		}
		return this.plugins.flatMap(p => p.loadedDatabases());
	}

	public availableSignatureDatabases(): readonly string[] {
		return uniqueArray(this.loadedSignatureDatabases().map(d => d.scope));
	}

	public hasSignatureDatabase(): boolean {
		return isSigDbEnabled(this.ctx.config) && this.plugins.some(p => p.loadedDatabases().length > 0);
	}

	public packagesExporting(name: string): readonly string[] {
		if(!isSigDbEnabled(this.ctx.config)) {
			return [];
		}
		const out = new Set<string>();
		for(const p of this.plugins) {
			for(const pkg of p.packagesExporting(name)) {
				out.add(pkg);
			}
		}
		return [...out];
	}

	public signatures(): SignatureDb {
		return signatureDbOf(this);
	}

	public signatureSources(): readonly PackageSignatureSource[] {
		if(!isSigDbEnabled(this.ctx.config)) {
			return [];
		}
		return this.plugins.flatMap(p => [...p.signatureSources(this.ctx.config)]);
	}

	public signatureOf(id: Identifier, version?: string): DecodedFunction | undefined {
		const pkg = Identifier.getNamespace(id);
		if(pkg === undefined) {
			return undefined; // a qualified `pkg::fn` identifier is required to know which package to look in
		}
		const name = Identifier.getName(id);
		const ver = version ?? this.getDependency(pkg)?.resolvedVersion;
		for(const src of this.signatureSources()) {
			if(!src.has(pkg)) {
				continue; // avoids touching a package this source lacks
			}
			// decode only the one function (not the whole package), falling back to the source's latest version
			const fn = src.functionByName(pkg, name, ver) ?? src.functionByName(pkg, name);
			if(fn) {
				return fn;
			}
		}
		return undefined;
	}

	/** Whether any version plugin can resolve the base-R packages (a versioned signature source is available). */
	public hasBaseRSource(): boolean {
		return isSigDbEnabled(this.ctx.config) && this.plugins.some(p => p.providesBaseRPackages());
	}

	/** Cheap fingerprint of only the base-R-providing databases, so base-R-derived caches survive unrelated database changes. */
	public baseRSourceFingerprint(): string {
		if(!isSigDbEnabled(this.ctx.config)) {
			return '';
		}
		return this.plugins.filter(p => p.providesBaseRPackages())
			.flatMap(p => p.loadedDatabases()).map(d => d.hash).join(',');
	}

	/** Mount an additional signature database/source by path (a plain `.sigs.ndjson`, a `.br`, or a manifest). */
	public async addDatabaseSource(source: string): Promise<void> {
		for(const p of this.plugins) {
			await p.addDatabaseSource(source);
		}
	}

	/** Eagerly mount every version plugin's signature database up front (see `solver.sigdb.eagerlyLoad`). */
	public eagerlyLoadSignatureDatabases(): void {
		for(const p of this.plugins) {
			p.preloadDatabasesSync();
		}
	}

	receive(event: InvalidationEvent): void {
		resetOnFullInvalidation(this, event);
	}

	public constructor(functionsContext: FlowrAnalyzerFunctionsContext, plugins?: readonly FlowrAnalyzerPackageVersionsPlugin[]) {
		super(functionsContext.getAttachedContext(), FlowrAnalyzerPackageVersionsPlugin.defaultPlugin(), plugins);
		this.functionsContext = functionsContext;
	}

	public resolveStaticDependencies(): void {
		this.applyPlugins(undefined);
		this.staticsLoaded = true;
	}

	/** Runs the static plugins once. They fill this context and the project metadata, so both gate their reads on it. */
	public ensureStaticsLoaded(): void {
		if(!this.staticsLoaded) {
			this.resolveStaticDependencies();
		}
	}

	/**
	 * Register a dependency declared by a project metadata file (`DESCRIPTION`, `renv.lock`, `rv.lock`, `uvr.lock`). Gated by
	 * `solver.sigdb.loadProjectDependencies`: when project-dependency loading is disabled this is a no-op, so the
	 * declared deps never enter the context (unlike {@link addDependency}, used for on-demand signature-database
	 * resolution).
	 */
	public addDeclaredDependency(pkg: Package): this {
		if(!this.ctx.config.solver.sigdb.loadProjectDependencies) {
			return this;
		}
		return this.addDependency(pkg);
	}

	public addDependency(pkg: Package): this {
		mergeIntoMap(this.dependencies, pkg);
		return this;
	}

	public getDependency(name: string, version?: string | Range): Package | undefined {
		if(!this.staticsLoaded) {
			this.resolveStaticDependencies();
		}
		if(version !== undefined) {
			return this.resolvePinnedDependency(name, typeof version === 'string' ? RRange.parse('=' + version) : version);
		}
		const existing = this.dependencies.get(name) ?? this.resolvedOnly.get(name);
		// a package already carrying exports is complete; a version-only one is still enriched below
		if(existing?.namespaceInfo || (!existing && this.resolvedMisses.has(name))) {
			return existing;
		}
		if(!this.resolvedMisses.has(name)) {
			for(const resolve of this.lazyResolvers) {
				const resolved = resolve(name, existing);
				if(resolved) {
					// merges exports into any existing version info, of a dependency or of a mere lookup
					const into = this.dependencies.has(name) ? this.dependencies : this.resolvedOnly;
					mergeIntoMap(into, resolved);
					return into.get(name);
				}
			}
			this.resolvedMisses.add(name);
		}
		return existing;
	}

	/** Like {@link getDependency}, but for a package the code pulls in (`library(p)`): the result joins the project's {@link getDependencies|dependencies}. */
	public loadDependency(name: string): Package | undefined {
		const found = this.getDependency(name);
		const cached = this.resolvedOnly.get(name);
		if(cached !== undefined) {
			this.resolvedOnly.delete(name);
			mergeIntoMap(this.dependencies, cached);
		}
		return this.dependencies.get(name) ?? found;
	}

	/** Resolve `name` constrained to `range` via the plugins (uncached); falls back to the cached dependency. */
	private resolvePinnedDependency(name: string, range: Range | undefined): Package | undefined {
		const pin = new Package({ name, versionConstraints: range ? [range] : [] });
		for(const resolve of this.lazyResolvers) {
			const resolved = resolve(name, pin);
			if(resolved) {
				return resolved;
			}
		}
		return this.getDependency(name);
	}

	public inferredRange(name: string): Range | undefined {
		const pkg = this.getDependency(name);
		return pkg?.hasSatisfiableVersion() ? pkg.derivedRange : undefined;
	}

	public getDependencies(): Package[] {
		if(!this.staticsLoaded) {
			this.resolveStaticDependencies();
		}
		return Array.from(this.dependencies.values());
	}

	public declaredPackageNames(): string[] {
		this.ensureStaticsLoaded();
		const declared: readonly (readonly Package[] | undefined)[] = Object.values(this.ctx.meta.getDeclaredPackages());
		return uniqueArray(declared.flatMap(group => group?.map(p => p.name) ?? []));
	}
}

function mergeIntoMap(map: Map<string, Package>, pkg: Package): void {
	const existing = map.get(pkg.name);
	if(existing) {
		existing.mergeInPlace(pkg);
	} else {
		map.set(pkg.name, pkg);
	}
}
