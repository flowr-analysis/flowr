import { FlowrAnalyzerPackageVersionsPlugin, type SigDbLoadedInfo } from './flowr-analyzer-package-versions-plugin';
import { SemVer, minVersion, type Range } from 'semver';
import path from 'path';
import { Package } from './package';
import type { FlowrAnalyzerContext } from '../../context/flowr-analyzer-context';
import type { NamespaceInfo } from '../file-plugins/files/flowr-namespace-file';
import { SigDatabase, SigDatabaseSet, getSharedSigSource, getSharedSigSourceSync, type PackageSignatureSource } from '../../sigdb/reader';
import { SigDbExt, type LibraryExports } from '../../sigdb/schema';
import { defaultSigDbPaths } from '../../sigdb/manifest';
import { resolveSource } from '../../sigdb/decompress';
import { compressedExtOf } from '../../sigdb/codec';
import { log } from '../../../util/log';
import { FileRole } from '../../context/flowr-file';
import { isSigDbEnabled, resolveAssumedRVersion, VersionSelection, type FlowrConfig } from '../../../config';
import { RRange, RVersion } from '../../../util/r-version';
import { baseRPackages } from '../../../util/r-base-packages';

/** the plugin's instance name (pass to `unregisterPlugins` to disable the default sigdb resolver) */
export const SigDbPluginName = 'flowr-analyzer-package-versions-sigdb-plugin';

/** map a resolved source's compressed extension to a codec name for display (`undefined` extension is a plain file) */
function codecNameOf(ext: string | undefined): string {
	switch(ext) {
		case '.zst': return 'zstd';
		case '.br':  return 'brotli';
		case '.gz':  return 'gzip';
		default:     return 'plain';
	}
}

/** the codec name of a manifest's resolved shard + dict sources, or `mixed` when they do not all agree */
function manifestFormat(set: SigDatabaseSet): string {
	const paths = [
		...set.manifest.shards.map(s => s.path),
		...(set.manifest.dicts?.map(d => d.path) ?? [])
	];
	const codecs = new Set(paths.map(p => codecNameOf(compressedExtOf(resolveSource(set.baseDir, p)))));
	return codecs.size === 1 ? [...codecs][0] : 'mixed';
}

/** describe one loaded source for `:version` / diagnostics: a single bundle, a sharded set, or an in-memory source */
function describeLoadedDatabase(src: PackageSignatureSource): SigDbLoadedInfo {
	if(src instanceof SigDatabase) {
		return { scope: 'signatures', version: src.content?.version ?? 0, date: src.content?.date ?? '', hash: src.content?.hash ?? '' };
	}
	if(src instanceof SigDatabaseSet) {
		// the scope (base/current/history) is the leading segment of the manifest's own shard/dict filenames
		const file = src.manifest.dicts?.[0]?.path ?? src.manifest.shards[0]?.path ?? '';
		const scope = file.split('.')[0] || 'signatures';
		return { scope, version: src.manifest.schema, date: src.manifest.date, hash: src.manifest.shards.map(s => s.hash).join(','), format: manifestFormat(src) };
	}
	// an in-memory source carries no bundle version/date
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

	private readonly extraSources:    SigDbSource[];
	private sources:                  PackageSignatureSource[] | undefined;
	/** the `additionalPaths` the current {@link sources} were assembled with, so a later config resolves a rebuild */
	private sourcesKey:               string | undefined;
	private analyzerCtx:              FlowrAnalyzerContext | undefined;
	/** cached reverse index `export name -> packages exporting it`, built once per source set (see {@link packagesExporting}) */
	private exportIndex:              Map<string, string[]> | undefined;
	/** `pkg@assumedR` keys already reported via {@link baseVersionFor}'s fallback, so the info is logged once */
	private readonly baseFallbacksLogged = new Set<string>();
	/** installed package versions for `versionSelection: 'system'`, read once from R (see {@link warmInstalledVersions}) */
	private installedVersions:        ReadonlyMap<string, string> | undefined;
	/** guards the one-time async warm-up of {@link installedVersions} */
	private installedVersionsPromise: Promise<void> | undefined;

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
	 * manifest paths). Added sources take precedence over the bundled default, so they can override or extend it.
	 */
	public addSource(...sources: readonly SigDbSource[]): void {
		this.extraSources.push(...sources);
		this.resetAssembled();   // invalidate the caches so the next resolve picks the new sources up
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
			if(ctx.config.solver.sigdb.versionSelection === VersionSelection.System) {
				this.warmInstalledVersions();
			}
		}
	}

	private syncPromise: Promise<void> | undefined;

	/**
	 * Opt-in (`solver.sigdb.autoSync`) startup re-sync.
	 * If the committed `sigdb.remote.json` link file lists shards whose cached copies are missing or hash-mismatched,
	 * this will sync them.
	 */
	private startBackgroundSync(ctx: FlowrAnalyzerContext): void {
		if(this.syncPromise !== undefined) {
			return;
		}
		this.syncPromise = (async() => {
			// dynamic import: sigdb-download pulls in node http/https, keep it off the hot load path
			const dl = await import('../../sigdb/sigdb-download');
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
			sigDbLog.warn(`background sigdb sync failed (keeping the cached shards): ${(e as Error).message}`);
		});
	}

	private warmPromise: Promise<void> | undefined;

	/**
	 * Warm the hot shards (base + most-downloaded packages) of any sharded source in a background task, so the
	 * first `library()` lookup no longer blocks on decompression. Idempotent.
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

	/**
	 * Read the system's installed package versions once (for `versionSelection: 'system'`), off the hot path. Only
	 * an R-backed parser exposes `installedPackageVersions`; a tree-sitter (no-R) parser skips this, so `system`
	 * gracefully falls back to `newest` in {@link resolve}. Idempotent; failures leave the map empty (same fallback).
	 */
	private warmInstalledVersions(): void {
		if(this.installedVersionsPromise !== undefined || this.installedVersions !== undefined) {
			return;
		}
		const info = this.analyzerCtx?.analyzer?.parserInformation();
		if(!info || !('installedPackageVersions' in info) || typeof info.installedPackageVersions !== 'function') {
			return;   // no R available: system selection falls back to newest
		}
		this.installedVersionsPromise = info.installedPackageVersions()
			.then(versions => {
				this.installedVersions = versions;
			})
			.catch((e: unknown) => {
				this.installedVersions = new Map();
				sigDbLog.warn(`sigdb: could not read installed package versions for system version selection, falling back to newest: ${(e as Error).message}`);
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
			// `additionalPaths` from the config are prioritized
			const extra = (config ?? this.analyzerCtx?.config)?.solver.sigdb.additionalPaths ?? [];
			sources.push(...defaultSigDbPaths(extra));
			sources.push(...extra.filter(p => /\.(manifest\.json|sigs\.ndjson)(\.br|\.gz)?$/.test(p)));
		}
		return sources;
	}

	/** synchronously openable sources (instances + plain `.sigs.ndjson`); `.br`/manifests are added by {@link preload}. */
	private loadSources(config?: FlowrConfig): PackageSignatureSource[] {
		const cfg = config ?? this.analyzerCtx?.config;
		// `solver.sigdb.enabled: false` disables the database for this analyzer only: drop any loaded sources so it
		// frees memory and every consumer (resolve, base-R link, queries) sees nothing -- other analyzers are untouched.
		// An absent config is the pre-analysis query path (default enabled), so only an explicit `false` disables.
		if(cfg !== undefined && !isSigDbEnabled(cfg)) {
			if(this.sources !== undefined) {
				this.resetAssembled();
			}
			return [];
		}
		// a query may run before an analysis has set `analyzerCtx`, memoizing sources without the config's
		// `additionalPaths`; re-key on them so the config-aware call rebuilds rather than reusing the stale set
		const key = (cfg?.solver.sigdb.additionalPaths ?? []).join('\0');
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
	 * Open every source, including compressed bundles (`.br`/`.gz`) and manifests (`*.manifest.json`).
	 * Call once at the analyzer boundary so resolution can fall through to them.
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
		await this.preload();
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
		let chosen: RVersion | undefined;   // versions are ascending; keep the newest core release <= target
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
		const sigdb = this.analyzerCtx?.config.solver.sigdb;
		const override = sigdb?.versionOverrides?.[name];
		const selection = sigdb?.versionSelection ?? VersionSelection.Newest;
		const range = existing?.derivedVersion;
		let fallback: LibraryExports | undefined;
		for(const src of this.loadSources()) {
			if(!src.has(name)) {
				continue;
			}
			// base R always resolves against the assumed R version, independent of override/selection
			if(src.isBaseR(name)) {
				const info = src.lookup(name, this.baseVersionFor(src, name)) ?? src.lookup(name);
				if(info && (range === undefined || RRange.satisfies(info.version, range))) {
					return this.toResolvedPackage(name, info);
				}
				fallback ??= info;
				continue;
			}
			// a per-package override wins over both the constraint and the newest/oldest/system policy
			if(override !== undefined) {
				const info = src.lookup(name, override);
				if(info) {
					return this.toResolvedPackage(name, info);
				}
				fallback ??= src.lookup(name);
				continue;
			}
			const info = this.selectVersion(src, name, range, selection);
			if(info) {
				return this.toResolvedPackage(name, info);
			}
			fallback ??= src.lookup(name);   // only a version outside the constraint is stored; keep it as a last resort
		}
		if(fallback !== undefined) {
			const constraint = override !== undefined ? `override ${override}` : (range?.raw ?? 'a version');
			sigDbLog.warn(`project constrains ${name} to ${constraint} but the signature database only has ${fallback.version}; analyzing with ${fallback.version}`);
			return this.toResolvedPackage(name, fallback);
		}
		return undefined;
	}

	/** the concrete export view for a non-base package under the active {@link VersionSelection} policy, or `undefined` if none satisfies */
	private selectVersion(src: PackageSignatureSource, name: string, range: Range | undefined, selection: VersionSelection): LibraryExports | undefined {
		if(selection === VersionSelection.System) {
			const installed = this.installedVersions?.get(name);
			const info = installed !== undefined ? src.lookup(name, installed) : undefined;
			if(info) {
				return info;   // the version that actually runs on this system (even if outside the declared constraint)
			}
			// not installed, not in the db, or no R available: fall through to newest-satisfying
		}
		if(selection === VersionSelection.Oldest) {
			return this.oldestSatisfying(src, name, range);
		}
		return this.newestSatisfying(src, name, range);
	}

	/**
	 * Newest version satisfying the constraint. Fast path: prefer the source's latest (no history decompression for
	 * the common `>=` case) and accept it when it satisfies; only otherwise enumerate the stored versions and pick
	 * the highest satisfying one (e.g. an upper-bound or exact-old pin).
	 */
	private newestSatisfying(src: PackageSignatureSource, name: string, range: Range | undefined): LibraryExports | undefined {
		const pinned = range ? minVersion(range)?.version : undefined;
		const info = src.lookup(name, pinned) ?? src.lookup(name);
		if(info && (range === undefined || RRange.satisfies(info.version, range))) {
			return info;
		}
		if(range !== undefined) {
			const versions = this.availableVersions(src, name);
			for(let i = versions.length - 1; i >= 0; i--) {
				if(RRange.satisfies(versions[i], range)) {
					return src.lookup(name, versions[i]);
				}
			}
		}
		return undefined;
	}

	/** Lowest stored version satisfying the constraint (using the store's actual R-form version strings). */
	private oldestSatisfying(src: PackageSignatureSource, name: string, range: Range | undefined): LibraryExports | undefined {
		for(const version of this.availableVersions(src, name)) {   // ascending
			if(range === undefined || RRange.satisfies(version, range)) {
				return src.lookup(name, version);
			}
		}
		return undefined;
	}

	/** the versions the source can answer for a package (dated releases, base-R core releases, and the latest), ascending */
	private availableVersions(src: PackageSignatureSource, pkg: string): string[] {
		const set = new Set<string>();
		for(const r of src.releaseDates(pkg)) {
			set.add(r.version.str);
		}
		for(const v of src.coreVersions(pkg) ?? []) {
			set.add(v.str);
		}
		const latest = src.latestVersion(pkg);
		if(latest) {
			set.add(latest.str);
		}
		return [...set].sort((a, b) => RVersion.compare(a, b));
	}

	/** build the resolved {@link Package} (namespace + version) from a source's export view */
	private toResolvedPackage(name: string, info: LibraryExports): Package {
		const exported = info.exported.slice();
		const namespaceInfo: NamespaceInfo = {
			exportedSymbols:      exported,
			exportedFunctions:    [],
			exportS3Generics:     reconstructS3Generics(exported),
			exportedPatterns:     [],
			importedPackages:     new Map(),
			loadsWithSideEffects: false,
			callable:             exported
		};
		return new Package({ name, namespaceInfo, resolvedVersion: info.version });
	}
}
