import type { RRepository } from '../../src/util/r-package-urls';
import { baseManualIndexUrl, baseManualTopicUrl, cranMirrorSourceUrl, rdrrPackageUrl, rdrrTopicUrl, RRepositories, rSourceUrl } from '../../src/util/r-package-urls';
import { argsOf, wordsOf } from './query';
import { ExportFlag } from './export-flags';
import { FilterKind, filterOf } from './filters';

/** the element the page template gives `id`, which it must have */
export function byId<T extends Element = HTMLElement>(id: string): T {
	const found = document.getElementById(id);
	if(found === null) {
		throw new Error(`the sigdb page has no element #${id}`);
	}
	return found as unknown as T;
}

function readJson<T>(id: string): T {
	return JSON.parse(byId(id).textContent ?? 'null') as T;
}

function readMap<T>(id: string): ReadonlyMap<string, T> {
	return new Map(Object.entries(readJson<Record<string, T>>(id)));
}

const BaseRepository: RRepository = { label: 'base R', home: baseManualIndexUrl };

/** one line of the package blob, see `encode` in `scripts/sigdb-index.ts` */
export class Package {
	private constructor(
		readonly name: string,
		readonly version: string,
		readonly base: boolean,
		readonly downloads: number,
		readonly exports: number,
		readonly releases: number,
		readonly since: number,
		readonly archived: boolean,
		private readonly files: string,
		private readonly source: string
	) {}

	static read(line: string): Package {
		const [name, version, base, downloads, exports, releases, since, archived, files, source] = line.split('\t');
		return new Package(name, version, base === '1', Number(downloads), Number(exports), Number(releases), Number(since), archived === '1', files ?? '', source ?? '');
	}

	get repository(): RRepository {
		const stated = this.source.toLowerCase();
		return this.base ? BaseRepository : RRepositories[stated] ?? (stated === '' ? RRepositories['cran'] : { label: this.source, home: () => undefined });
	}

	get home(): string | undefined {
		return this.repository.home(this.name);
	}

	/** the manual page `topic`, or the index of the manual without one */
	manual(topic?: string): string {
		if(topic === undefined) {
			return this.base ? baseManualIndexUrl(this.name) : rdrrPackageUrl(this.name);
		}
		return this.base ? baseManualTopicUrl(this.name, topic) : rdrrTopicUrl(this.name, topic);
	}

	sourceUrl(file: string | undefined, line: number | undefined): string | undefined {
		if(this.base) {
			return rSourceUrl(this.name, this.version, file, line);
		}
		const repository = this.repository;
		return repository === RRepositories['cran'] ? cranMirrorSourceUrl(this.name, this.version, file, line) : repository.home(this.name);
	}

	file(at: number): string | undefined {
		return this.files.split('|')[at] || undefined;
	}

	/** the downloads in short, like `12k/month` */
	get usage(): string {
		const n = this.downloads;
		return (n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? Math.round(n / 1e3) + 'k' : String(n)) + '/month';
	}

	get usageTitle(): string {
		return this.downloads > 0 ? this.downloads.toLocaleString('en-US') + ' CRAN downloads in the last month' : 'ships with R, so CRAN counts nothing';
	}
}

/** what flowR states about a name in one package */
export interface Stated {
	readonly pkg:   string;
	readonly props: string;
	readonly args:  string;
}

/** a package exporting a name, see `encode` in `scripts/sigdb-index.ts` for the `index:flags:params:topic:file:line` it is read from */
export class Owner {
	constructor(
		readonly pkg: Package,
		readonly flags: string,
		readonly topic?: string,
		private readonly fileAt?: number,
		readonly line?: number
	) {}

	static parse(entry: string): Owner | undefined {
		const [index, flags, , topic, file, line] = entry.split(':');
		const pkg = db.packages[Number(index)] as Package | undefined;
		return pkg && new Owner(pkg, flags ?? '', topic ? decodeURIComponent(topic) : undefined,
			file ? parseInt(file, 36) : undefined, line ? parseInt(line, 36) : undefined);
	}

	get file(): string | undefined {
		return this.fileAt === undefined ? undefined : this.pkg.file(this.fileAt);
	}

	has(flag: ExportFlag): boolean {
		return this.flags.includes(flag);
	}

	documented(name: string): boolean {
		if(this.has(ExportFlag.NoDoc) || !/^[A-Za-z.][A-Za-z0-9._-]*$/.test(db.topics.get(this.pkg.name + '::' + name) || name)) {
			return false;
		}
		return this.pkg.base ? !db.topicsComplete || db.topics.has(this.pkg.name + '::' + name) : !this.has(ExportFlag.Stated);
	}

	manual(name: string): string {
		return this.pkg.manual(this.topic || db.topics.get(this.pkg.name + '::' + name) || name);
	}

	get sourceUrl(): string | undefined {
		return this.pkg.sourceUrl(this.file, this.line);
	}
}

/** one exported name and the packages it comes from */
export class Entry {
	private listed?: readonly Owner[];
	private all?:    readonly Owner[];

	constructor(readonly name: string, private readonly raw: string) {}

	/** the packages the database lists for the name */
	get owners(): readonly Owner[] {
		return this.listed ??= this.raw === '' ? [] : this.raw.split(',').map(entry => Owner.parse(entry)).filter(owner => owner !== undefined);
	}

	/** the listed packages, after those flowR states a signature for that the database does not list */
	get shown(): readonly Owner[] {
		if(this.all === undefined) {
			const listed = new Set(this.owners.map(owner => owner.pkg.name));
			const missing = this.stated.filter(entry => !listed.has(entry.pkg)).map(entry => db.package(entry.pkg)).filter(pkg => pkg !== undefined);
			this.all = [...missing.map(pkg => new Owner(pkg, ExportFlag.Stated)), ...this.owners];
		}
		return this.all;
	}

	get stated(): readonly Stated[] {
		return db.stated.get(this.name) ?? [];
	}

	get kinds(): readonly string[] {
		return db.kinds.get(this.name) ?? [];
	}

	/** whether flowR knows what kind of call the name is */
	get known(): boolean {
		return db.kinds.has(this.name);
	}

	get group(): string | undefined {
		return db.groups.get(this.name);
	}

	flagged(flag: ExportFlag): boolean {
		return this.owners.some(owner => owner.has(flag));
	}

	/** what flowR states for `pkg`, else for base, else for anything */
	statedFor(pkg: string | undefined): Stated | undefined {
		return this.stated.find(entry => entry.pkg === pkg) ?? this.stated.find(entry => entry.pkg === 'base') ?? this.stated[0];
	}

	declaredIn(pkg: string | undefined): string | undefined {
		return (db.formals.get(this.name) ?? []).find(entry => entry[0] === pkg)?.[1];
	}

	/** the generics the name is a method for, by dispatch system */
	get dispatches(): readonly (readonly [system: string, generic: string])[] {
		const found: [string, string][] = [];
		if(this.flagged(ExportFlag.S3Method)) {
			let s3: string | undefined;
			for(let at = this.name.indexOf('.'); at > 0; at = this.name.indexOf('.', at + 1)) {
				s3 = db.generics.has(this.name.slice(0, at)) ? this.name.slice(0, at) : s3;
			}
			if(s3 !== undefined) {
				found.push(['S3', s3]);
			}
		}
		const comma = this.name.indexOf(',');
		if(this.flagged(ExportFlag.S4Method) && comma > 0) {
			found.push(['S4', this.name.slice(0, comma)]);
		}
		return found;
	}

	/** whether the name has the trait the filter chip `id` stands for */
	holds(id: string): boolean {
		const [kind, key] = filterOf(id);
		switch(kind) {
			case FilterKind.Only:    return false;
			case FilterKind.Name:    return this.group !== undefined;
			case FilterKind.Package: return this.owners.some(owner => owner.pkg.archived);
			case FilterKind.Prop:    return this.stated.some(entry => wordsOf(entry.props).includes(key));
			case FilterKind.Arg:     return this.stated.some(entry => argsOf(entry.args).some(([, roles]) => roles.includes(key)));
			case FilterKind.Kind:    return this.kinds.includes(key);
			case FilterKind.Flag:    return this.flagged(key as ExportFlag);
			default:                 return false;
		}
	}
}

class Database {
	readonly kinds = readMap<string[]>('kinds');
	readonly stated = new Map([...readMap<readonly (readonly [string, string, string])[]>('stated')]
		.map(([name, entries]) => [name, entries.map(([pkg, props, args]): Stated => ({ pkg, props, args }))]));
	readonly topics = readMap<string>('topics');
	readonly generics: ReadonlySet<string> = new Set(readJson<string>('generics').split('\n').filter(Boolean));
	readonly topicsComplete = readJson<boolean>('topics-complete');
	readonly formals = readMap<[pkg: string, params: string][]>('formals');
	readonly groups = readMap<string>('groups');

	packages: readonly Package[] = [];
	/** `name\towner,owner` per line, kept as the one string it arrives as since a search only slices out what it hits */
	names = '';
	loaded = false;
	private byName = new Map<string, Package>();

	async load(): Promise<void> {
		const encoded = (byId('data').textContent ?? '').trim();
		const text = await inWorker(encoded).catch(() => unzip(encoded));
		const between = text.indexOf('\n\n');
		this.names = text.slice(0, between);
		this.packages = text.slice(between + 2).split('\n').map(line => Package.read(line));
		this.byName = new Map(this.packages.map(pkg => [pkg.name, pkg]));
		this.loaded = true;
	}

	package(name: string | undefined): Package | undefined {
		return name === undefined ? undefined : this.byName.get(name);
	}
}

async function unzip(encoded: string): Promise<string> {
	const raw = Uint8Array.from(atob(encoded), c => c.charCodeAt(0));
	return new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
}

/** {@link unzip} off the main thread, so the page stays responsive while the database unpacks */
function inWorker(encoded: string): Promise<string> {
	return new Promise((resolve, reject) => {
		const url = URL.createObjectURL(new Blob([`self.onmessage = async ({ data }) => self.postMessage(await (${unzip.toString()})(data));`], { type: 'text/javascript' }));
		const worker = new Worker(url);
		const done = () => {
			worker.terminate();
			URL.revokeObjectURL(url);
		};
		worker.onmessage = (event: MessageEvent<string>) => {
			resolve(event.data);
			done();
		};
		worker.onerror = error => {
			reject(new Error(error.message));
			done();
		};
		worker.postMessage(encoded);
	});
}

export const db = new Database();
