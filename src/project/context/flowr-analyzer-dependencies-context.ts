import { AbstractFlowrAnalyzerContext } from './abstract-flowr-analyzer-context';
import {
	FlowrAnalyzerPackageVersionsPlugin,
	type PkgDbLoadedInfo
} from '../plugins/package-version-plugins/flowr-analyzer-package-versions-plugin';
import type { Package } from '../plugins/package-version-plugins/package';
import type { FlowrAnalyzerFunctionsContext, ReadOnlyFlowrAnalyzerFunctionsContext } from './flowr-analyzer-functions-context';

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
	 * @param name - The name of the dependency to get.
	 * @returns The dependency with the given name, or undefined if it does not exist.
	 */
	getDependency(name: string): Readonly<Package> | undefined;

	/**
	 * Get all dependencies known to this context.
	 */
	getDependencies(): readonly Readonly<Package>[];

	/**
	 * Metadata of the package databases the version plugins currently have loaded.
	 */
	loadedPackageDatabases(): PkgDbLoadedInfo[];
}

/**
 * Manages the project's dependencies, their versions, and their interplay with {@link FlowrAnalyzerPackageVersionsPlugin}s.
 */
export class FlowrAnalyzerDependenciesContext extends AbstractFlowrAnalyzerContext<undefined, void, FlowrAnalyzerPackageVersionsPlugin> implements ReadOnlyFlowrAnalyzerDependenciesContext {
	public readonly name = 'flowr-analyzer-dependencies-context';

	public readonly functionsContext: FlowrAnalyzerFunctionsContext;

	private dependencies:  Map<string, Package> = new Map();
	private staticsLoaded = false;
	/** resolvers consulted lazily to fill in exports; `existing` carries version info from other plugins */
	private lazyResolvers: ((name: string, existing?: Package) => Package | undefined)[] = [];
	private resolvedMisses = new Set<string>();

	public reset(): void {
		this.dependencies = new Map();
		this.staticsLoaded = false;
		this.lazyResolvers = [];
		this.resolvedMisses = new Set();
	}

	/** Register a resolver consulted by {@link getDependency} to fill in a package's exports lazily. */
	public addLazyResolver(resolver: (name: string, existing?: Package) => Package | undefined): void {
		this.lazyResolvers.push(resolver);
	}

	public loadedPackageDatabases(): PkgDbLoadedInfo[] {
		if(!this.ctx.config.solver.pkgdb.enabled) {
			return [];
		}
		return this.plugins.flatMap(p => p.loadedDatabases());
	}

	/** Eagerly mount every version plugin's package database up front (see `solver.pkgdb.eagerlyLoad`). */
	public eagerlyLoadPackageDatabases(): void {
		for(const p of this.plugins) {
			p.preloadDatabasesSync();
		}
	}

	public constructor(functionsContext: FlowrAnalyzerFunctionsContext, plugins?: readonly FlowrAnalyzerPackageVersionsPlugin[]) {
		super(functionsContext.getAttachedContext(), FlowrAnalyzerPackageVersionsPlugin.defaultPlugin(), plugins);
		this.functionsContext = functionsContext;
	}

	public resolveStaticDependencies(): void {
		this.applyPlugins(undefined);
		this.staticsLoaded = true;
	}

	public addDependency(pkg: Package): this {
		const p = this.dependencies.get(pkg.name);
		if(p) {
			p.mergeInPlace(pkg);
		} else {
			this.dependencies.set(pkg.name, pkg);
		}
		return this;
	}

	public getDependency(name: string): Package | undefined {
		if(!this.staticsLoaded) {
			this.resolveStaticDependencies();
		}
		const existing = this.dependencies.get(name);
		// a package already carrying exports is complete; a version-only one is still enriched below
		if(existing?.namespaceInfo || (!existing && this.resolvedMisses.has(name))) {
			return existing;
		}
		if(!this.resolvedMisses.has(name)) {
			for(const resolve of this.lazyResolvers) {
				const resolved = resolve(name, existing);
				if(resolved) {
					this.addDependency(resolved);   // merges exports into any existing version info
					return this.dependencies.get(name);
				}
			}
			this.resolvedMisses.add(name);
		}
		return existing;
	}

	public getDependencies(): Package[] {
		if(!this.staticsLoaded) {
			this.resolveStaticDependencies();
		}
		return Array.from(this.dependencies.values());
	}
}
