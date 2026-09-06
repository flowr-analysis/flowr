/**
 * Reads the bundled signature database into the two flat tables both generated pages search:
 * one line per package, one line per exported name. Shared so the landing page and the full
 * signature browser never disagree about what flowR knows.
 */
import zlib from 'zlib';
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
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
import { BasePrimitiveTopics, DefaultBuiltinConfig, statedSignatures, type StatedSignature } from '../src/dataflow/environments/default-builtin-config';
import { Identifier, PkgName } from '../src/dataflow/environments/identifier';
import { baseRExportOwner } from '../src/util/r-base-packages';
import { RGroupGenerics, S4GroupOfMember } from '../src/dataflow/environments/group-generics';
import { RBasePackageStore } from '../src/data/r-base-packages.generated';

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
	/** the source files its exports live in, which each of them names by position rather than by path */
	readonly files:     readonly string[];
	/** the repository the newest known release came from (`cran`, `bioc`, ...), where the database records one */
	readonly source?:   string;
	/** every exported name, with what the database records about it */
	readonly exports:   ReadonlyMap<string, ExportEntry>;
}

export interface SigIndex {
	/** the newest release the database knows (`Aug 2026`), which is how current it is */
	readonly updated:        string;
	/** base R first, then by downloads, so `read.csv` answers `utils` before anything else exporting it */
	readonly packages:       readonly PackageEntry[];
	readonly names:          number;
	/** what flowR itself treats a name as: `read`, `write`, `visualize`, ... (see {@link DefaultDependencyCategories}) */
	readonly kinds:          ReadonlyMap<string, string[]>;
	/** what flowR states about the functions it defines itself, see {@link statedSignatures} */
	readonly stated:         ReadonlyMap<string, StatedSignature[]>;
	/** every name some package records as a generic, which is what makes a dotted name a method of it */
	readonly generics:       ReadonlySet<string>;
	/** the formals the database records for base R, `name -> [package, parameters][]`; only base R fits on a page */
	readonly formals:        ReadonlyMap<string, [pkg: string, params: string][]>;
	/**
	 * `package::alias -> topic` for every documented base R name, the topic empty where it is the name itself.
	 * Doubles as the set of base R names that have a manual page at all, see {@link baseTopics}.
	 */
	readonly topics:         ReadonlyMap<string, string>;
	/** whether {@link topics} is that full set: without an R to read the alias tables from it holds the primitives alone */
	readonly topicsComplete: boolean;
	/** the S4 group generic a name belongs to (`sin` to `Math`), see {@link S4GroupOfMember} */
	readonly groups:         ReadonlyMap<string, string>;
}

/** one exported name, as much of it as fits in a page */
export interface ExportEntry {
	/** one letter per property flowR recorded (`t` can-throw, `n` non-deterministic, ...) */
	readonly flags:  string;
	readonly params: number;
	/** the help topic documenting it, when that is not simply its name */
	readonly topic?: string;
	/** which of the package's {@link PackageEntry#files|files} holds it, and the line it starts on */
	readonly file?:  number;
	readonly line?:  number;
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

/** Everything both pages need from the database, read once. */
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
		's4-method':         'm',
		'value':             'c',
		'higher-order':      'h',
		'deprecated':        'x',
		'no-doc':            'u'
	};
	const onCran = await currentOnCran();
	const all: PackageEntry[] = [];
	/* the names something dispatches on, so `is.datacggm` is not read as a method of `is`, which dispatches
	   nothing. R's own are known; a package's are whatever the database records as a generic */
	const generics = new Set<string>([...RBasePackageStore.generics, ...Object.keys(RGroupGenerics)]);
	for(const name of db.packageNames()) {
		const library = db.lookup(name);
		if(library === undefined) {
			continue;
		}
		const exports = new Map<string, ExportEntry>();
		/* the same handful of paths carry a whole package, so each is named once and pointed at by position */
		const files = new Map<string, number>();
		for(const fn of db.functions(name) ?? []) {
			if(fn.exported) {
				/*
				 * No body to point at. Usually a constant (`pi`, `LETTERS`) or a class object, but equally a
				 * function the extractor could not locate because nothing wrote it down: an S4 generic that
				 * `setGeneric` builds, a `Vectorize` result. Which of the two it is only the extractor knows
				 * (`value` above, once the bundle carries it), so the flag says what is known and no more:
				 * the database has no file and line for the name.
				 */
				const noLocation = fn.file === undefined && fn.line < 0;
				if(fn.file !== undefined && !files.has(fn.file)) {
					files.set(fn.file, files.size);
				}
				if(fn.props.includes('generic')) {
					generics.add(fn.name);
				}
				exports.set(fn.name, {
					flags:  fn.props.map(p => letters[p] ?? '').join('') + (noLocation ? 'v' : ''),
					params: fn.signature.length,
					topic:  fn.topic !== fn.name ? fn.topic : undefined,
					file:   fn.file !== undefined ? files.get(fn.file) : undefined,
					line:   fn.file !== undefined && fn.line >= 0 ? fn.line : undefined
				});
			}
		}
		for(const exported of library.exported) {
			if(!exports.has(exported)) {
				/* exported, but the database holds no entry for it at all, so there is no location either */
				exports.set(exported, { flags: 'v', params: 0 });
			}
		}
		const releases = db.releaseDates(name);
		const base = db.isBaseR(name);
		all.push({
			archived:  !base && (onCran ? !onCran.has(name) : (library.cranUrl?.includes('/Archive/') ?? false)),
			source:    db.sourceOf(name, library.version),
			name, exports,
			files:     [...files.keys()],
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
	const baseNames = db.packageNames().filter(name => db.isBaseR(name));
	const { topics, complete: topicsComplete } = baseTopics(baseNames);
	db.close();
	const stated = statedWithRealPackages(new Set(baseNames), topics, topicsComplete);
	/* flowR labels every name R dispatches on, which is where the internal generics (`c`, `as.character`) come from */
	for(const [name, entries] of stated) {
		if(entries.some(entry => entry.props.includes('generic'))) {
			generics.add(name);
		}
	}
	all.sort((a, b) => Number(b.base) - Number(a.base) || b.downloads - a.downloads);
	const newest = all.reduce((latest, p) => p.latest > latest ? p.latest : latest, 0);
	return {
		packages: all,
		generics,
		names:    new Set(all.flatMap(p => [...p.exports.keys()])).size,
		kinds:    builtInKinds(),
		stated,
		formals,
		topics,
		topicsComplete,
		groups:   S4GroupOfMember,
		updated:  newest > 0 ? new Date(newest).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'an unknown date'
	};
}

/**
 * What flowR states, with the package corrected wherever its built-in configuration had to guess one.
 *
 * A definition that names no namespace is attributed to base R, which is right for the operators, primitives and
 * reserved words and wrong for every name flowR merely recognizes: R has no `sinkplot`, plotrix does, and a page
 * that believed the attribution offered a `base` chip and a dead manual link with it. A base attribution stands
 * when a base package exports the name or R's own alias table documents it, moves when a different base package
 * owns it (`setNames` is stats'), and otherwise names no package at all, which leaves what flowR says about the
 * call intact while the packages that really export it are the only ones a reader is shown.
 *
 * Without an alias table to check against (no R at hand) nothing is corrected: the export lists alone would
 * throw out `NULL`, `TRUE` and the rest of what R documents but no NAMESPACE carries.
 */
function statedWithRealPackages(baseNames: ReadonlySet<string>, topics: ReadonlyMap<string, string>, complete: boolean): ReadonlyMap<string, StatedSignature[]> {
	const stated = statedSignatures();
	if(!complete) {
		return stated;
	}
	const settled = (name: string, entry: StatedSignature): StatedSignature => {
		const owner = baseRExportOwner(name);
		if(owner !== undefined) {
			return owner === entry.pkg ? entry : { ...entry, pkg: owner };
		}
		return topics.has(entry.pkg + '::' + name) ? entry : { ...entry, pkg: '' };
	};
	return new Map([...stated].map(([name, entries]) =>
		[name, entries.map(entry => baseNames.has(entry.pkg) ? settled(name, entry) : entry)]));
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
 * Which manual page documents a base R name: `sin` lives under `Trig`, `paste0` under `paste`, and most under
 * their own name. {@link BasePrimitiveTopics} carries the primitives, which the database cannot hold; a local R
 * adds the rest from the plain `alias\ttopic` table it ships per package.
 *
 * Every alias is in the result, those documented under their own name with an empty topic, so a caller can also
 * use it the other way round: a base R name the map does not carry has no manual page, and linking to one only
 * produces a dead link (flowR states `sinkplot`, R has never had it).
 * @returns the map, and whether an alias table was read at all
 */
function baseTopics(packages: readonly string[]): { topics: ReadonlyMap<string, string>, complete: boolean } {
	/* what flowR states itself, which is the part that never depends on an R being around */
	const topics = new Map<string, string>(
		Object.entries(BasePrimitiveTopics).map(([name, topic]) => [`${PkgName.Base}::${name}`, topic]));
	let home: string;
	try {
		home = execFileSync('R', ['RHOME'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
	} catch{
		return { topics, complete: false };
	}
	let read = false;
	for(const pkg of packages) {
		let table: string;
		try {
			table = fs.readFileSync(path.join(home, 'library', pkg, 'help', 'AnIndex'), 'utf8');
		} catch{
			continue;
		}
		read = true;
		for(const row of table.split('\n')) {
			const [alias, topic] = row.split('\t');
			if(alias && topic) {
				topics.set(pkg + '::' + alias, alias === topic ? '' : topic);
			}
		}
	}
	return { topics, complete: read };
}

/**
 * The two blobs a page searches: `name\tversion\tbase` per package, and `name\towner,owner` per
 * exported name. Plain text beats JSON by about a third here, and a page only has to `split` it.
 */
export function encode(packages: readonly PackageEntry[], stated: ReadonlyMap<string, unknown> = statedSignatures()): { packages: string, names: string, count: number } {
	const owners = new Map<string, string[]>();
	for(const [index, pkg] of packages.entries()) {
		for(const [name, entry] of pkg.exports) {
			const list = owners.get(name) ?? [];
			owners.set(name, list);
			/* `12` is package twelve; `12:tn:3:topic:4:88` adds its flags, its parameter count, the help
			   topic when that differs from the name, and which of the package's files holds it at which
			   line, both in base 36. Trailing parts are left off when there is nothing to say. */
			/* a topic can hold a comma or a colon (`[,hyperSpec-method`), which are exactly the separators
			   this list uses, so it travels encoded */
			/* the file and the line are read back as numbers either way, so they travel in the shortest base */
			const parts = [String(index), entry.flags, entry.params > 0 ? String(entry.params) : '',
				entry.topic ? encodeURIComponent(entry.topic) : '',
				entry.file !== undefined ? entry.file.toString(36) : '',
				entry.line !== undefined ? entry.line.toString(36) : ''];
			while(parts.length > 1 && parts[parts.length - 1] === '') {
				parts.pop();
			}
			list.push(parts.join(':'));
		}
	}
	/*
	 * A name no package exports is in no list, and a search would never see it: `if` and `NULL` are R itself
	 * rather than anything's export, and a primitive is in no NAMESPACE either. flowR states them, so they get
	 * a row of their own with no owner, which the page fills in from what flowR says (see `withStatedOwner`).
	 */
	for(const name of stated.keys()) {
		if(!owners.has(name)) {
			owners.set(name, []);
		}
	}
	owners.delete('');   // an empty name would split the blob apart when the page reads it back
	return {
		packages: packages.map(p => [p.name, p.version, p.base ? '1' : '0', p.downloads, p.exports.size,
			p.releases, p.since, p.archived ? '1' : '0', p.files.join('|'), p.source ?? ''].join('\t')).join('\n'),
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
