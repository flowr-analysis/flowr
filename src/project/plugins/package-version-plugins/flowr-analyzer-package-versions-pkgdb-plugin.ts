import { FlowrAnalyzerPackageVersionsPlugin, type PkgDbLoadedInfo } from './flowr-analyzer-package-versions-plugin';
import { SemVer, minVersion } from 'semver';
import path from 'path';
import { Package } from './package';
import type { FlowrAnalyzerContext } from '../../context/flowr-analyzer-context';
import type { NamespaceInfo } from '../file-plugins/files/flowr-namespace-file';
import { PkgDatabase, defaultPkgDbPath, type PkgDb } from './pkgdb';
import { log } from '../../../util/log';
import { FileRole } from '../../context/flowr-file';
import { isPkgDbEnabled } from '../../../config';

/** the plugin's instance name (pass to `unregisterPlugins` to disable the default pkgdb resolver) */
export const PkgDbPluginName = 'flowr-analyzer-package-versions-pkgdb-plugin';

export const pkgDbLog = log.getSubLogger({ name: PkgDbPluginName });

/** a database, a parsed object, or a local file path */
export type PkgDbSource = PkgDatabase | PkgDb | string;

/** additional sources from `$FLOWR_PKGDB` (path-delimiter separated), highest priority after explicit ones */
function envSources(): string[] {
	const env = typeof process !== 'undefined' ? process.env?.FLOWR_PKGDB : undefined;
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
 * Resolves `library(pkg)` / `use(pkg, fn)` from precomputed `flowr-pkgdb` databases: the one bundled
 * with flowR plus any extra sources (constructor args or `$FLOWR_PKGDB`). Extra sources are consulted
 * first, so they override the bundle; packages only in the bundle still resolve. Everything is loaded
 * lazily on the first miss (never touched if a project uses no external packages). On by default; opt
 * out via `unregisterPlugins(PkgDbPluginName)` or `$FLOWR_DISABLE_DEFAULT_PKGDB`.
 *
 * A source may be an `http(s)` URL to a downloadable summary; call {@link preload} once at the
 * analyzer boundary to fetch it, so resolution falls through to it for packages not in the bundle.
 */
export class FlowrAnalyzerPackageVersionsPkgDbPlugin extends FlowrAnalyzerPackageVersionsPlugin {
	public readonly name        = PkgDbPluginName;
	public readonly description = 'Resolves library exports from precomputed flowr-pkgdb databases.';
	public readonly version     = new SemVer('0.1.0');

	/**
	 * Process-wide cache of parsed file databases, keyed by their source path, so a flowR session parses
	 * each file once. Parsing the bundled database is ~25ms and a fresh plugin instance is created per
	 * analyzer, so without this every analysis touching a `library()` call would re-parse the multi-MB file.
	 */
	private static readonly fileCache = new Map<string, PkgDatabase>();

	private readonly extraSources: PkgDbSource[];
	private databases:             PkgDatabase[] | undefined;
	private analyzerCtx:           FlowrAnalyzerContext | undefined;

	public constructor(...sources: PkgDbSource[]) {
		super();
		this.extraSources = sources;
	}

	public process(ctx: FlowrAnalyzerContext): void {
		this.databases = undefined;   // reload on (re)registration so config/source changes take effect
		this.analyzerCtx = ctx;
		if(isPkgDbEnabled(ctx.config)) {
			ctx.deps.addLazyResolver((name, existing) => this.resolve(name, existing));
		}
	}

	/**
	 * Whether the given name is the project's own package. When analyzing a package from source (e.g. ggplot2),
	 * we already have its actual definitions, so we must not shadow them with the (possibly stale) database entry.
	 */
	private isSelfPackage(name: string): boolean {
		const desc = this.analyzerCtx?.files.getFilesByRole(FileRole.Description) ?? [];
		return desc.some(d => d.packageName() === name);
	}

	/** Mount the databases up front (see `solver.pkgdb.eagerlyLoad`) instead of on the first library load. */
	public override preloadDatabasesSync(): void {
		this.loadDatabases();
	}

	/** metadata of the databases currently loaded (the synchronously available, non-URL sources) */
	public override loadedDatabases(): PkgDbLoadedInfo[] {
		return this.loadDatabases().map(db => ({ scope: db.scope, version: db.content.version, date: db.content.date }));
	}

	/** Packages in the loaded databases (respecting `self`-package exclusion) that export `name`. */
	public override packagesExporting(name: string): readonly string[] {
		if(!isPkgDbEnabled(this.analyzerCtx?.config)) {
			return [];
		}
		const out = new Set<string>();
		for(const db of this.loadDatabases()) {
			for(const pkg of db.packagesExporting(name)) {
				if(!this.isSelfPackage(pkg)) {
					out.add(pkg);
				}
			}
		}
		return [...out];
	}

	/**
	 * Sources in priority order: explicit constructor sources, then `$FLOWR_PKGDB`, then the bundled
	 * default. The bundled default is skipped when `$FLOWR_DISABLE_DEFAULT_PKGDB` is set (explicit
	 * sources are always honored) - the env opt-out for the shipped database.
	 */
	private sources(): PkgDbSource[] {
		const disableBundled = typeof process !== 'undefined' && process.env?.FLOWR_DISABLE_DEFAULT_PKGDB;
		const bundled = disableBundled ? undefined : defaultPkgDbPath();   // richest bundled tier (all > latest > tiny)
		return [...this.extraSources, ...envSources(), ...(bundled ? [bundled] : [])];
	}

	private static isUrl(s: PkgDbSource): s is string {
		return typeof s === 'string' && /^https?:\/\//.test(s);
	}

	/** synchronously loaded databases; remote (URL) summaries are only added by {@link preload}. */
	private loadDatabases(): PkgDatabase[] {
		if(this.databases === undefined) {
			this.databases = this.sources()
				.filter(s => !FlowrAnalyzerPackageVersionsPkgDbPlugin.isUrl(s))
				.map(s => this.load(s))
				.filter((d): d is PkgDatabase => d !== undefined);
		}
		return this.databases;
	}

	/**
	 * Download and load every source, including remote (URL) summaries. Call this once at the
	 * analyzer boundary to let `library()` resolution fall through to additional downloaded databases
	 * (e.g. the full `all` summary or a richer `latest`). Without it, only local sources are used.
	 */
	public async preload(): Promise<void> {
		const dbs: PkgDatabase[] = [];
		for(const source of this.sources()) {
			try {
				dbs.push(FlowrAnalyzerPackageVersionsPkgDbPlugin.isUrl(source) ? await PkgDatabase.fromUrl(source) : this.mustLoad(source));
			} catch(e) {
				pkgDbLog.warn(`Could not load pkgdb source: ${(e as Error).message}`);
			}
		}
		this.databases = dbs;
	}

	private load(source: PkgDbSource): PkgDatabase | undefined {
		try {
			return this.mustLoad(source);
		} catch(e) {
			pkgDbLog.warn(`Could not load pkgdb source: ${(e as Error).message}`);
			return undefined;
		}
	}

	private mustLoad(source: PkgDbSource): PkgDatabase {
		if(source instanceof PkgDatabase) {
			return source;
		}
		if(typeof source !== 'string') {
			return PkgDatabase.fromObject(source);
		}
		return FlowrAnalyzerPackageVersionsPkgDbPlugin.loadFileCached(source);
	}

	/** Load a file source once per session, reusing the parsed database across analyzer instances. */
	private static loadFileCached(file: string): PkgDatabase {
		const cache = FlowrAnalyzerPackageVersionsPkgDbPlugin.fileCache;
		let db = cache.get(file);
		if(db === undefined) {
			db = PkgDatabase.fromFileSync(file);
			cache.set(file, db);
		}
		return db;
	}

	private resolve(name: string, existing?: Package): Package | undefined {
		if(this.isSelfPackage(name)) {
			pkgDbLog.debug(`not resolving ${name} from the package database as it is the analyzed project itself`);
			return undefined;
		}
		const pinned = existing?.derivedVersion ? minVersion(existing.derivedVersion)?.version : undefined;
		for(const db of this.loadDatabases()) {
			const info = db.lookup(name, pinned);
			if(!info) {
				continue;
			}
			if(pinned && info.version !== pinned) {
				pkgDbLog.warn(`project pins ${name}@${pinned} but the export database only has ${info.version}; analyzing with ${info.version}`);
			} else if(!pinned) {
				pkgDbLog.debug(`no pinned version for ${name}; using ${info.version}`);
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
