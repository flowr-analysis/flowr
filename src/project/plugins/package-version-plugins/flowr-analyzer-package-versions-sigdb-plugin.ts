import { FlowrAnalyzerPackageVersionsPlugin, type SigDbLoadedInfo } from './flowr-analyzer-package-versions-plugin';
import { SemVer, minVersion } from 'semver';
import path from 'path';
import { Package } from './package';
import type { FlowrAnalyzerContext } from '../../context/flowr-analyzer-context';
import type { NamespaceInfo } from '../file-plugins/files/flowr-namespace-file';
import { SigDatabase, SigDatabaseSet, SigDbExt, defaultSigDbPaths, getSharedSigSource, getSharedSigSourceSync, type PackageSignatureSource, type RPackageVersion } from './sigdb';
import { log } from '../../../util/log';
import { FileRole } from '../../context/flowr-file';
import { isSigDbEnabled, resolveAssumedRVersion, type FlowrConfig } from '../../../config';
import { RVersion } from '../../../util/r-version';
import { baseRPackages } from '../../../util/r-base-packages';

/** the plugin's instance name (pass to `unregisterPlugins` to disable the default sigdb resolver) */
export const SigDbPluginName = 'flowr-analyzer-package-versions-sigdb-plugin';

/** describe one loaded source for `:version` / diagnostics: a single bundle, a sharded set, or an in-memory source */
function describeLoadedDatabase(src: PackageSignatureSource): SigDbLoadedInfo {
	if(src instanceof SigDatabase) {
		return { scope: 'signatures', version: src.content?.version ?? 0, date: src.content?.date ?? '', hash: src.content?.hash ?? '' };
	}
	if(src instanceof SigDatabaseSet) {
		return { scope: 'signatures', version: 0, date: src.manifest.date, hash: src.manifest.shards.map(s => s.hash).join(',') };
	}
	// an in-memory source (e.g. a LocalSignatureSource) carries no bundle version/date
	return { scope: 'signatures', version: 0, date: '', hash: src.packageNames().join(',') };
}

export const sigDbLog = log.getSubLogger({ name: SigDbPluginName });

/** an opened signature source, or a local file path (a plain `.sigs.ndjson`, or a `.br`/manifest via {@link FlowrAnalyzerPackageVersionsSigDbPlugin.preload}) */
export type SigDbSource = PackageSignatureSource | string;

/** additional sources from `$FLOWR_SIGDB` (path-delimiter separated), consulted after the explicit ones */
function envSources(): string[] {
	const env = typeof process !== 'undefined' ? process.env?.FLOWR_SIGDB : undefined;
	return env ? env.split(path.delimiter).filter(s => s.length > 0) : [];
}

/**
 * The database flattens S3 methods into the export list, so we recover the `generic -> classes` map for
 * dispatch: an export `generic.class` is a method when the `generic` is itself exported (e.g. `print.foo`).
 */
export function reconstructS3Generics(exported: readonly string[]): Map<string, string[]> {
	const names = new Set(exported);
	const generics = new Map<string, string[]>();
	for(const name of exported) {
		const dot = name.indexOf('.');
		const generic = dot > 0 ? name.slice(0, dot) : undefined;
		if(generic !== undefined && names.has(generic)) {
			const classes = generics.get(generic) ?? [];
			classes.push(name.slice(dot + 1));
			generics.set(generic, classes);
		}
	}
	return generics;
}

/**
 * Resolves `library(pkg)` / `use(pkg, fn)` from precomputed `flowr-sigdb` databases via the
 * {@link PackageSignatureSource} contract. For an R-core package it picks the version shipped with the assumed
 * R release (`solver.sigdb.assumedRVersion`), so `library(stats)` attaches that release's exports. Plain-file
 * sources load lazily; a `.br` or manifest source is mounted by {@link preload}. On by default.
 */
export class FlowrAnalyzerPackageVersionsSigDbPlugin extends FlowrAnalyzerPackageVersionsPlugin {
	public readonly name        = SigDbPluginName;
	public readonly description = 'Resolves library exports (and versioned base R) from precomputed flowr-sigdb databases.';
	public readonly version     = new SemVer('0.1.0');

	private readonly extraSources: SigDbSource[];
	private sources:               PackageSignatureSource[] | undefined;
	/** the `additionalPaths` the current {@link sources} were assembled with, so a later config resolves a rebuild */
	private sourcesKey:            string | undefined;
	private analyzerCtx:           FlowrAnalyzerContext | undefined;
	/** cached reverse index `export name -> packages exporting it`, built once per source set (see {@link packagesExporting}) */
	private exportIndex:           Map<string, string[]> | undefined;
	/** `pkg@assumedR` keys already reported via {@link baseVersionFor}'s fallback, so the info is logged once */
	private readonly baseFallbacksLogged = new Set<string>();

	/** invalidate the assembled source list and derived caches (after a source or config change) */
	private resetAssembled(): void {
		this.sources = undefined;
		this.sourcesKey = undefined;
		this.exportIndex = undefined;
	}

	public constructor(...sources: SigDbSource[]) {
		super();
		this.extraSources = sources;
	}

	/**
	 * Dynamically add signature sources after construction (opened instances, plain `.sigs.ndjson`, or `.br`/
	 * manifest paths). Added sources take precedence over the bundled default, so they can override or extend it
	 * at runtime -- e.g. a {@link LocalSignatureSource} analyzed from a package on disk (see {@link addLocalPackages}).
	 */
	public addSource(...sources: readonly SigDbSource[]): void {
		this.extraSources.push(...sources);
		this.resetAssembled();   // invalidate the caches so the next resolve picks the new sources up
	}

	/**
	 * Analyze a single installed R package or a whole library folder on disk -- running flowR over its `R/`
	 * sources to extract each function's full signature (parameters, defaults, callees) alongside its
	 * `DESCRIPTION`/`NAMESPACE` metadata -- and add it as a resolvable source. Returns the packages added.
	 */
	public override async addLocalPackages(dir: string, config?: FlowrConfig): Promise<string[]> {
		const cfg = config ?? this.analyzerCtx?.config;
		if(cfg === undefined) {
			sigDbLog.warn(`cannot analyze ${dir}: no configuration available (register the plugin or pass a config)`);
			return [];
		}
		// dynamic import: sigdb-local pulls in the analyzer builder, so a static import would form a load cycle
		const { readLocalSignatureSource } = await import('./sigdb-local');
		const source = await readLocalSignatureSource(cfg, dir);
		const names = source.packageNames();
		if(names.length > 0) {
			this.addSource(source);
		}
		return names;
	}

	public process(ctx: FlowrAnalyzerContext): void {
		this.resetAssembled();   // reload on (re)registration so config/source changes take effect (shared bundles are reused)
		this.analyzerCtx = ctx;
		if(isSigDbEnabled(ctx.config)) {
			ctx.deps.addLazyResolver((name, existing) => this.resolve(name, existing));
			if(ctx.config.solver.sigdb.warmInBackground) {
				this.startBackgroundWarm();
			}
			if(ctx.config.solver.sigdb.autoSync) {
				this.startBackgroundSync(ctx);
			}
		}
	}

	private syncPromise: Promise<void> | undefined;

	/**
	 * Opt-in (`solver.sigdb.autoSync`) startup re-sync: if the committed `sigdb.remote.json` link file lists shards
	 * whose cached copies are missing or hash-mismatched (e.g. a `git pull` updated the pointer), download the
	 * changed shards from the release in the background and mount the freshly-synced bundle. Fire-and-forget,
	 * idempotent, and failure-tolerant -- offline or a bad release just leaves the committed base floor in place.
	 */
	private startBackgroundSync(ctx: FlowrAnalyzerContext): void {
		if(this.syncPromise !== undefined) {
			return;
		}
		this.syncPromise = (async() => {
			// dynamic import: sigdb-download pulls in node http/https, keep it off the hot load path
			const dl = await import('./sigdb-download');
			if(!dl.sigDbNeedsSync()) {
				return;
			}
			sigDbLog.info('sigdb: committed link file changed -- re-syncing shards in the background');
			const { files } = await dl.downloadFullSigDb({
				repo:       ctx.config.solver.sigdb.downloadRepo,
				onProgress: msg => sigDbLog.info(`sigdb sync: ${msg}`)
			});
			for(const manifest of files.filter(f => /\.manifest\.json(\.br)?$/.test(f))) {
				await ctx.deps.addDatabaseSource(manifest);
			}
		})().catch((e: unknown) => {
			sigDbLog.warn(`background sigdb sync failed (keeping the committed base floor): ${(e as Error).message}`);
		});
	}

	private warmPromise: Promise<void> | undefined;

	/**
	 * Warm the hot shards (base + most-downloaded packages) of any sharded source in a background task, so the
	 * first `library()` lookup no longer blocks on decompression. Fire-and-forget and idempotent; the long-tail
	 * and history shards stay lazy. Enabled via `solver.sigdb.warmInBackground`.
	 */
	private startBackgroundWarm(): void {
		if(this.warmPromise !== undefined) {
			return;
		}
		this.warmPromise = (async() => {
			for(const src of this.loadSources()) {
				if(src instanceof SigDatabaseSet) {
					await src.preloadShards(s => s.tier === 'current' && s.shard !== 'rest');
				}
			}
		})().catch((e: unknown) => {
			sigDbLog.warn(`background sigdb warm failed: ${(e as Error).message}`);
		});
	}

	/** Mount the databases up front instead of on the first library load (see `solver.sigdb.eagerlyLoad`). */
	public override preloadDatabasesSync(): void {
		this.loadSources();
	}

	/** whether any loaded source carries a versioned base-R package (so base namespaces can be attached eagerly) */
	public override providesBaseRPackages(): boolean {
		const base = baseRPackages();
		return this.loadSources().some(src => base.some(p => src.has(p) && src.isBaseR(p)));
	}

	public override signatureSources(config?: FlowrConfig): readonly PackageSignatureSource[] {
		// a query can run before any analysis has set `analyzerCtx`, so the caller (the deps context) passes the
		// config through -- otherwise `additionalPaths` would be invisible until the first analysis
		return this.loadSources(config);
	}

	public override loadedDatabases(): SigDbLoadedInfo[] {
		return this.loadSources().map(describeLoadedDatabase);
	}

	/**
	 * Packages in the loaded sources (respecting `self`-package exclusion) that export `name`. Backed by a
	 * reverse index built once per source set, so repeated hint lookups (e.g. from the `undefined-symbol` linter)
	 * do not re-scan every package. The first call still pays one full pass over the sources.
	 */
	public override packagesExporting(name: string): readonly string[] {
		if(!isSigDbEnabled(this.analyzerCtx?.config)) {
			return [];
		}
		this.exportIndex ??= this.buildExportIndex();
		return this.exportIndex.get(name) ?? [];
	}

	/** one pass over every loaded source building `export name -> packages`, honoring self-package exclusion */
	private buildExportIndex(): Map<string, string[]> {
		const index = new Map<string, string[]>();
		for(const src of this.loadSources()) {
			for(const pkg of src.packageNames()) {
				if(this.isSelfPackage(pkg)) {
					continue;
				}
				for(const exp of src.lookup(pkg)?.exported ?? []) {
					const owners = index.get(exp);
					if(owners === undefined) {
						index.set(exp, [pkg]);
					} else if(!owners.includes(pkg)) {
						owners.push(pkg);
					}
				}
			}
		}
		return index;
	}

	/**
	 * The raw sources in priority order: explicit constructor sources, `$FLOWR_SIGDB`, then **every** bundled
	 * database discovered in the data dirs (see {@link defaultSigDbPaths}) -- so an extra bundle dropped next to
	 * the default (e.g. a downloaded full-history one) is mounted automatically. All bundled defaults are skipped
	 * when `$FLOWR_DISABLE_DEFAULT_SIGDB` is set; explicit sources are always honored.
	 */
	private rawSources(config?: FlowrConfig): SigDbSource[] {
		const sources = [...this.extraSources, ...envSources()];
		const disableBundled = typeof process !== 'undefined' && process.env?.FLOWR_DISABLE_DEFAULT_SIGDB;
		if(!disableBundled) {
			// `additionalPaths` from the config are searched first (so a downloaded full-history bundle wins): a
			// directory is discovered like any search root, a direct bundle/manifest file is mounted as-is
			const extra = (config ?? this.analyzerCtx?.config)?.solver.sigdb.additionalPaths ?? [];
			sources.push(...defaultSigDbPaths(extra));
			sources.push(...extra.filter(p => /\.(manifest\.json|sigs\.ndjson)(\.br|\.gz)?$/.test(p)));
		}
		return sources;
	}

	/** synchronously openable sources (instances + plain `.sigs.ndjson`); `.br`/manifests are added by {@link preload}. */
	private loadSources(config?: FlowrConfig): PackageSignatureSource[] {
		// a query may run before an analysis has set `analyzerCtx`, memoizing sources without the config's
		// `additionalPaths`; re-key on them so the config-aware call rebuilds rather than reusing the stale set
		const key = ((config ?? this.analyzerCtx?.config)?.solver.sigdb.additionalPaths ?? []).join('\0');
		if(this.sources === undefined || this.sourcesKey !== key) {
			this.sourcesKey = key;
			this.sources = this.rawSources(config)
				.map(s => this.loadSync(s))
				.filter((s): s is PackageSignatureSource => s !== undefined);
		}
		return this.sources;
	}

	private loadSync(source: SigDbSource): PackageSignatureSource | undefined {
		if(typeof source !== 'string') {
			return source;
		}
		try {
			// manifests open synchronously when every shard embeds its index (the shipped bundles do), so a
			// bundled `.br` manifest works without preload(); shards/dictionaries decompress lazily on demand
			const opened = getSharedSigSourceSync(source);
			if(opened === undefined) {
				sigDbLog.warn(`sigdb source ${source} needs preload() (only plain ${SigDbExt} files and manifests open synchronously)`);
			}
			return opened;
		} catch(e) {
			sigDbLog.warn(`Could not load sigdb source: ${(e as Error).message}`);
		}
		return undefined;
	}

	/**
	 * Open every source, including compressed bundles (`.br`/`.gz`) and manifests (`*.manifest.json`). Call once at
	 * the analyzer boundary so resolution can fall through to them. Without it, only instances + plain files are used.
	 * Mounted bundles are cached by path, so a later re-registration ({@link process}) reuses them instead of
	 * losing them (they cannot be re-opened synchronously).
	 */
	public async preload(): Promise<void> {
		for(const source of this.rawSources()) {
			if(typeof source !== 'string') {
				continue;
			}
			try {
				await getSharedSigSource(source);
			} catch(e) {
				sigDbLog.warn(`Could not load sigdb source: ${(e as Error).message}`);
			}
		}
		this.resetAssembled();
	}

	public override async addDatabaseSource(source: string): Promise<void> {
		this.addSource(source);
		await this.preload();   // mount `.br`/manifest sources (plain files are already usable synchronously)
	}

	/** Whether the given name is the analyzed project itself (so we must not shadow its own definitions). */
	private isSelfPackage(name: string): boolean {
		const desc = this.analyzerCtx?.files.getFilesByRole(FileRole.Description) ?? [];
		return desc.some(d => d.packageName() === name);
	}

	/**
	 * For a base package, the newest core version `<=` the assumed R version (see
	 * {@link FlowrAnalyzerContext.resolvedRVersion}). If the assumed version predates every recorded core
	 * release, the closest supported one (the earliest) is used and the substitution is logged once as info.
	 */
	private baseVersionFor(src: PackageSignatureSource, name: string): string | undefined {
		const versions = src.coreVersions(name);
		if(!versions || versions.length === 0) {
			return undefined;
		}
		const target = this.analyzerCtx?.resolvedRVersion ?? resolveAssumedRVersion(undefined);
		let chosen: RPackageVersion | undefined;   // versions are ascending; keep the newest core release <= target
		for(const v of versions) {
			if(RVersion.compare(v.str, target) <= 0) {
				chosen = v;
			}
		}
		if(chosen === undefined) {
			// the assumed R version is older than the earliest recorded core release: fall back to the closest one
			chosen = versions[0];
			const key = `${name}@${target}`;
			if(!this.baseFallbacksLogged.has(key)) {
				this.baseFallbacksLogged.add(key);
				sigDbLog.info(`Assumed R version ${target} predates the earliest recorded core release of ${name}; falling back to the closest supported version ${chosen.str}.`);
			}
		}
		return chosen.str;
	}

	private resolve(name: string, existing?: Package): Package | undefined {
		if(this.isSelfPackage(name)) {
			return undefined;
		}
		const pinned = existing?.derivedVersion ? minVersion(existing.derivedVersion)?.version : undefined;
		for(const src of this.loadSources()) {
			if(!src.has(name)) {
				continue;
			}
			const version = pinned ?? (src.isBaseR(name) ? this.baseVersionFor(src, name) : undefined);
			const info = src.lookup(name, version);
			if(!info) {
				continue;
			}
			if(pinned !== undefined && info.version !== pinned) {
				sigDbLog.warn(`project pins ${name}@${pinned} but the signature database only has ${info.version}; analyzing with ${info.version}`);
			}
			const namespaceInfo: NamespaceInfo = {
				exportedSymbols:      info.exported,
				exportedFunctions:    [],
				exportS3Generics:     reconstructS3Generics(info.exported),
				exportedPatterns:     [],
				importedPackages:     new Map(),
				loadsWithSideEffects: false,
				callable:             info.exported
			};
			return new Package({ name, namespaceInfo, resolvedVersion: info.version });
		}
		return undefined;
	}
}
