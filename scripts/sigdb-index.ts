/**
 * Reads the bundled signature database into the two flat tables both generated pages search:
 * one line per package, one line per exported name. Shared so the landing page and the full
 * signature browser never disagree about what flowR knows.
 */
import zlib from 'zlib';
import { MergedSignatureSource, SigDatabase, SigDatabaseSet, type PackageSignatureSource } from '../src/project/sigdb/reader';
import { defaultSigDbPaths } from '../src/project/sigdb/manifest';
/* the plain function lists rather than the query module, which would pull in half the analyzer */
import { LibraryFunctions } from '../src/queries/catalog/dependencies-query/function-info/library-functions';
import { SourceFunctions } from '../src/queries/catalog/dependencies-query/function-info/source-functions';
import { ReadFunctions } from '../src/queries/catalog/dependencies-query/function-info/read-functions';
import { WriteFunctions } from '../src/queries/catalog/dependencies-query/function-info/write-functions';
import { VisualizeFunctions } from '../src/queries/catalog/dependencies-query/function-info/visualize-functions';
import { TestFunctions } from '../src/queries/catalog/dependencies-query/function-info/test-functions';
import { statisticsFunctions } from '../src/queries/catalog/dependencies-query/function-info/statistics-functions';
import { DefaultBuiltinConfig, statedSignatures, type StatedSignature } from '../src/dataflow/environments/default-builtin-config';
import { Identifier } from '../src/dataflow/environments/identifier';

export interface PackageEntry {
	readonly name:      string;
	readonly version:   string;
	readonly base:      boolean;
	/** monthly CRAN downloads, the one popularity number the database carries */
	readonly downloads: number;
	/** how many releases the database holds, and the year of the first one */
	readonly releases:  number;
	readonly since:     number;
	/** CRAN no longer ships it: its newest source tarball only exists under `src/contrib/Archive` */
	readonly archived:  boolean;
	/** when its newest known release came out, as a timestamp */
	readonly latest:    number;
	/** every exported name, with what the database records about it */
	readonly exports:   ReadonlyMap<string, ExportEntry>;
}

export interface SigIndex {
	/** the newest release the database knows (`Aug 2026`), which is how current it is */
	readonly updated:  string;
	/** base R first, then by downloads, so `read.csv` answers `utils` before anything else exporting it */
	readonly packages: readonly PackageEntry[];
	readonly names:    number;
	/** what flowR itself treats a name as: `read`, `write`, `visualize`, ... (see {@link DefaultDependencyCategories}) */
	readonly kinds:    ReadonlyMap<string, string[]>;
	/** what flowR states about the functions it defines itself, see {@link statedSignatures} */
	readonly stated:   ReadonlyMap<string, StatedSignature[]>;
	/** the formals the database records for base R, `name -> [package, parameters][]`, see {@link baseFormals} */
	readonly formals:  ReadonlyMap<string, [pkg: string, params: string][]>;
}

/** one exported name, as much of it as fits in a page */
export interface ExportEntry {
	/** one letter per property flowR recorded (`t` can-throw, `n` non-deterministic, ...) */
	readonly flags:  string;
	readonly params: number;
	/** the help topic documenting it, when that is not simply its name */
	readonly topic?: string;
}

/**
 * Every bundled database at once: the `current` shards answer what a package exports today, and the
 * `history` shards are what knows how many releases there have been.
 */
export async function openDatabase(): Promise<PackageSignatureSource | undefined> {
	const sources: PackageSignatureSource[] = [];
	for(const source of defaultSigDbPaths()) {
		sources.push(source.includes('.manifest.json')
			? await SigDatabaseSet.openManifest(source)
			: await SigDatabase.open(source));
	}
	return sources.length === 0 ? undefined : new MergedSignatureSource(sources);
}

/** Everything both pages need from the database, read once. */
/**
 * The packages CRAN currently ships, from its own index. Anything the database knows that is missing
 * here was archived or removed; `undefined` when CRAN cannot be reached, and then the stored
 * archive-URL is all we have to go on.
 */
async function currentOnCran(): Promise<Set<string> | undefined> {
	try {
		const answer = await fetch('https://cran.r-project.org/src/contrib/PACKAGES.gz');
		const listing = zlib.gunzipSync(Buffer.from(await answer.arrayBuffer())).toString();
		return new Set([...listing.matchAll(/^Package:\s*(\S+)/gm)].map(m => m[1]));
	} catch{
		return undefined;
	}
}

/**
 *
 */
export async function readSigIndex(): Promise<SigIndex | undefined> {
	const db = await openDatabase();
	if(db === undefined) {
		return undefined;
	}
	const letters: Record<string, string> = {
		'can-throw':         't',
		's3-method':         '3',
		'non-deterministic': 'n',
		'calls-deprecated':  'd',
		'recursive':         'r',
		'calls-internal':    'i',
		's3-owner':          'o',
		's4-owner':          '4',
		'higher-order':      'h',
		'deprecated':        'x',
		'no-doc':            'u'
	};
	const onCran = await currentOnCran();
	const all: PackageEntry[] = [];
	for(const name of db.packageNames()) {
		const library = db.lookup(name);
		if(library === undefined) {
			continue;
		}
		const exports = new Map<string, ExportEntry>();
		for(const fn of db.functions(name) ?? []) {
			if(fn.exported) {
				/* a constant has no body to point at: no file, and a line of -1 (`pi`, `LETTERS`) */
				const isValue = fn.file === undefined && fn.line < 0;
				exports.set(fn.name, {
					flags:  fn.props.map(p => letters[p] ?? '').join('') + (isValue ? 'v' : ''),
					params: fn.signature.length,
					topic:  fn.topic !== fn.name ? fn.topic : undefined
				});
			}
		}
		for(const exported of library.exported) {
			if(!exports.has(exported)) {
				/* exported, but the database holds no function for it: a constant, a dataset, a class */
				exports.set(exported, { flags: 'v', params: 0 });
			}
		}
		const releases = db.releaseDates(name);
		const base = db.isBaseR(name);
		all.push({
			archived:  !base && (onCran ? !onCran.has(name) : (library.cranUrl?.includes('/Archive/') ?? false)),
			name, exports,
			version:   library.version,
			base,
			downloads: db.downloads(name),
			releases:  releases.length,
			since:     releases.length > 0 ? releases[0].date.getFullYear() : 0,
			latest:    releases.length > 0 ? releases[releases.length - 1].date.getTime() : 0
		});
	}
	/* the formals of base R, which is the part of the database small enough for a page to carry: nothing
	   else can tell a reader what `stats::filter(x, filter, method, ...)` takes */
	const formals = new Map<string, [pkg: string, params: string][]>();
	for(const pkg of db.packageNames().filter(name => db.isBaseR(name))) {
		const exported = new Set(db.lookup(pkg)?.exported ?? []);
		for(const fn of db.functions(pkg) ?? []) {
			if(exported.has(fn.name) && fn.signature.length > 0) {
				formals.set(fn.name, [...(formals.get(fn.name) ?? []), [pkg, fn.signature.map(p => p.name).join(', ')]]);
			}
		}
	}
	db.close();
	all.sort((a, b) => Number(b.base) - Number(a.base) || b.downloads - a.downloads);
	const newest = all.reduce((latest, p) => p.latest > latest ? p.latest : latest, 0);
	return {
		packages: all,
		names:    new Set(all.flatMap(p => [...p.exports.keys()])).size,
		kinds:    builtInKinds(),
		stated:   statedSignatures(),
		formals,
		updated:  newest > 0 ? new Date(newest).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'an unknown date'
	};
}

/**
 * What flowR's own dependency query says a name does. A few hundred entries, and the only part of this
 * index that comes from flowR's configuration rather than from the database.
 */
function builtInKinds(): Map<string, string[]> {
	const categories: Record<string, readonly { name: string }[]> = {
		library:    LibraryFunctions,
		source:     SourceFunctions,
		read:       ReadFunctions,
		write:      WriteFunctions,
		visualize:  VisualizeFunctions,
		test:       TestFunctions,
		statistics: statisticsFunctions()
	};
	const kinds = new Map<string, string[]>();
	/* flowR's own built-in definitions: `:`, `<-`, `TRUE` and the rest of what it understands without
	   any package, which the export lists of the database do not cover */
	for(const definition of DefaultBuiltinConfig) {
		for(const id of definition.names) {
			/* a name may carry several definitions, and one badge per name is enough */
			kinds.set(String(Identifier.getName(id)), ['builtin']);
		}
	}
	for(const [kind, functions] of Object.entries(categories)) {
		for(const fn of functions) {
			/* a name the dependency query knows is one flowR knows, whether or not it also has a
			   built-in definition: `read_csv` is readr's, and flowR still recognizes the call */
			const known = kinds.get(fn.name) ?? ['builtin'];
			kinds.set(fn.name, known);
			if(!known.includes(kind)) {
				known.push(kind);
			}
		}
	}
	return kinds;
}

/**
 * The two blobs a page searches: `name\tversion\tbase` per package, and `name\towner,owner` per
 * exported name. Plain text beats JSON by about a third here, and a page only has to `split` it.
 */
export function encode(packages: readonly PackageEntry[]): { packages: string, names: string, count: number } {
	const owners = new Map<string, string[]>();
	for(const [index, pkg] of packages.entries()) {
		for(const [name, entry] of pkg.exports) {
			const list = owners.get(name) ?? [];
			owners.set(name, list);
			/* `12` is package twelve; `12:tn:3:topic` adds its flags, its parameter count, and the help
			   topic when that differs from the name. Trailing parts are left off when there is nothing to say. */
			/* a topic can hold a comma or a colon (`[,hyperSpec-method`), which are exactly the separators
			   this list uses, so it travels encoded */
			const parts = [String(index), entry.flags, entry.params > 0 ? String(entry.params) : '',
				entry.topic ? encodeURIComponent(entry.topic) : ''];
			while(parts.length > 1 && parts[parts.length - 1] === '') {
				parts.pop();
			}
			list.push(parts.join(':'));
		}
	}
	owners.delete('');   // an empty name would split the blob apart when the page reads it back
	return {
		packages: packages.map(p => [p.name, p.version, p.base ? '1' : '0', p.downloads, p.exports.size,
			p.releases, p.since, p.archived ? '1' : '0'].join('\t')).join('\n'),
		/* alphabetical, which is what lets gzip fold the shared prefixes; a page ranks its own hits */
		names: [...owners.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
			.map(([name, list]) => `${name}\t${list.join(',')}`).join('\n'),
		count: owners.size
	};
}

/** the two blobs as one gzipped, base64 payload a page can unpack in the browser */
export function pack(packages: string, names: string): string {
	return zlib.gzipSync(Buffer.from(`${names}\n\n${packages}`), { level: 9 }).toString('base64');
}
