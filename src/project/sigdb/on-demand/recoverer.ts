import fs from 'fs';
import path from 'path';
import type Parser from 'web-tree-sitter';
import type { FlowrConfig } from '../../../config';
import type { FetchBytes, OnDemandSource, PackageArchive, PackageRequest } from './remote-sources';
import { isPackageName } from './remote-sources';
import { isRecoveredFile, recoverPackage, sanitizeRecovered, type RecoveredPackage } from './package-sources';
import { readTarEntries, DefaultTarLimits } from './tar';
import { log } from '../../../util/log';

export const onDemandLog = log.getSubLogger({ name: 'sigdb-on-demand' });

/** what `solver.sigdb.onDemand` configures */
export type OnDemandOptions = NonNullable<FlowrConfig['solver']['sigdb']['onDemand']>;

/** the version of the cache entries, a different one is fetched again */
const CacheSchema = 1;

/** one package in the cache: what was asked, and what was found, or why nothing was */
interface CacheEntry {
	readonly schema:   number;
	readonly name:     string;
	readonly request:  { readonly version?: string, readonly github?: string };
	/** when it was fetched, in ms since the epoch */
	readonly at:       number;
	readonly package?: RecoveredPackage;
	readonly missing?: string;
}

/** what a {@link OnDemandRecoverer} works with, injectable so a test needs no network */
export interface OnDemandRecovererArgs {
	readonly sources:  readonly OnDemandSource[];
	readonly fetch:    FetchBytes;
	readonly parse:    (code: string) => Parser.Tree;
	readonly cacheDir: string;
	readonly now?:     () => number;
}

/** how many packages are fetched at once */
const Parallel = 4;

function isCacheEntry(value: unknown, name: string): value is CacheEntry {
	const entry = value as Partial<CacheEntry> | undefined;
	const pkg = entry?.package as Partial<RecoveredPackage> | undefined;
	return typeof entry === 'object' && entry !== null && entry.schema === CacheSchema && entry.name === name && typeof entry.at === 'number'
		&& (pkg === undefined || (pkg.name === name && Array.isArray(pkg.exported) && Array.isArray(pkg.functions) && Array.isArray(pkg.s4Classes)));
}

/** whether what was asked for back then answers what is asked now */
function answers(entry: CacheEntry, request: PackageRequest): boolean {
	return (request.version === undefined || entry.request.version === request.version)
		&& (request.github === undefined || entry.request.github === request.github);
}

/**
 * Recovers packages no signature database knows from their sources: asks each {@link OnDemandSource} in turn for
 * archives, reads `DESCRIPTION`, `NAMESPACE`, and `R/` from the first one that holds the package, and caches the
 * result (or that no source had it) as one JSON file per package, so later analyses need no network.
 */
export class OnDemandRecoverer {
	private readonly options: OnDemandOptions;
	private readonly args:    OnDemandRecovererArgs;
	private readonly now:     () => number;

	public constructor(options: OnDemandOptions, args: OnDemandRecovererArgs) {
		this.options = options;
		this.args = args;
		this.now = args.now ?? Date.now;
	}

	private cacheFile(name: string): string {
		return path.join(this.args.cacheDir, `${name}.json`);
	}

	private readEntry(name: string): CacheEntry | undefined {
		if(!isPackageName(name)) {
			return undefined;
		}
		try {
			const entry: unknown = JSON.parse(fs.readFileSync(this.cacheFile(name), 'utf8'));
			return isCacheEntry(entry, name) ? entry : undefined;
		} catch{
			return undefined;
		}
	}

	private writeEntry(entry: CacheEntry): void {
		try {
			fs.mkdirSync(this.args.cacheDir, { recursive: true });
			const file = this.cacheFile(entry.name);
			const tmp = `${file}.${process.pid}.${Math.random().toString(36).slice(2)}.part`;
			fs.writeFileSync(tmp, JSON.stringify(entry));
			fs.renameSync(tmp, file);
		} catch(e) {
			onDemandLog.warn(`cannot cache ${entry.name} in ${this.args.cacheDir}: ${(e as Error).message}`);
		}
	}

	/** The package as fetched before, `undefined` if it never was or no source had it. */
	public cached(name: string): RecoveredPackage | undefined {
		const found = sanitizeRecovered(this.readEntry(name)?.package);
		return found?.name === name ? found : undefined;
	}

	/** whether the cache answers `request`, with the package or with a recent miss */
	private settled(request: PackageRequest): boolean {
		const entry = this.readEntry(request.name);
		if(entry === undefined || !answers(entry, request)) {
			return false;
		}
		const retry = (this.options.retryAfterHours ?? 24) * 60 * 60 * 1000;
		return entry.package !== undefined || this.now() - entry.at < retry;
	}

	/**
	 * Fetches the packages of `requests` the cache does not answer yet, at most `maxPackages` of them, and returns
	 * those it recovered. A failing source is logged and the next one tried, so this never throws.
	 */
	public async recover(requests: readonly PackageRequest[]): Promise<RecoveredPackage[]> {
		if(this.options.offline) {
			return [];
		}
		const wanted = requests.filter(r => isPackageName(r.name) && !this.settled(r)).slice(0, this.options.maxPackages ?? 25);
		const recovered: RecoveredPackage[] = [];
		for(let i = 0; i < wanted.length; i += Parallel) {
			const batch = await Promise.all(wanted.slice(i, i + Parallel).map(r => this.recoverOne(r)));
			recovered.push(...batch.filter(p => p !== undefined));
		}
		return recovered;
	}

	private async recoverOne(request: PackageRequest): Promise<RecoveredPackage | undefined> {
		const failures: string[] = [];
		const tryArchive = async(archive: PackageArchive) => {
			try {
				const found = await this.fromArchive(request, archive);
				if(found !== undefined) {
					onDemandLog.info(`recovered ${found.name}${found.version ? ` ${found.version}` : ''} from ${archive.url}`);
					this.writeEntry({ schema: CacheSchema, name: request.name, request: { version: request.version, github: request.github }, at: this.now(), package: found });
				}
				return found;
			} catch(e) {
				failures.push(`${archive.url}: ${(e as Error).message}`);
				return undefined;
			}
		};
		/* in the order of the sources, but every sure archive before any fallback */
		const fallbacks: PackageArchive[] = [];
		for(const source of this.args.sources) {
			let archives: readonly PackageArchive[];
			try {
				archives = await source.archives(request, this.args.fetch);
			} catch(e) {
				failures.push(`${source.name}: ${(e as Error).message}`);
				continue;
			}
			for(const archive of archives) {
				if(archive.fallback) {
					fallbacks.push(archive);
					continue;
				}
				const found = await tryArchive(archive);
				if(found !== undefined) {
					return found;
				}
			}
		}
		for(const archive of fallbacks) {
			const found = await tryArchive(archive);
			if(found !== undefined) {
				return found;
			}
		}
		if(failures.length > 0) {
			/* a failure may be the network's rather than the package's, so the next analysis asks again */
			onDemandLog.warn(`cannot recover ${request.name}: ${failures.join(', ')}`);
			return undefined;
		}
		onDemandLog.info(`cannot recover ${request.name}: no source has it`);
		this.writeEntry({ schema: CacheSchema, name: request.name, request: { version: request.version, github: request.github }, at: this.now(), missing: 'no source has it' });
		return undefined;
	}

	private async fromArchive(request: PackageRequest, archive: PackageArchive): Promise<RecoveredPackage | undefined> {
		const maxBytes = (this.options.maxArchiveMb ?? 32) * 1024 * 1024;
		const bytes = await this.args.fetch(archive.url, maxBytes);
		if(bytes === undefined) {
			return undefined;
		}
		const prefix = archive.subdir === undefined ? '' : `${archive.subdir.replace(/\/$/, '')}/`;
		/* what an archive unpacks to is held in memory at once, so it gets a bound of its own */
		const entries = readTarEntries(bytes, p => p.startsWith(prefix) && isRecoveredFile(p.slice(prefix.length)), { ...DefaultTarLimits, maxArchiveBytes: Math.min(3 * maxBytes, DefaultTarLimits.maxArchiveBytes) });
		const files = new Map([...entries].map(([p, b]) => [p.slice(prefix.length), b.toString('utf8')]));
		const found = sanitizeRecovered(recoverPackage(files, this.args.parse, archive.origin));
		/* a mirror may hold another package under that name, a repository one named differently */
		return found?.name === request.name ? found : undefined;
	}
}
