/**
 * Signature browser: search everything flowR knows, from a 12 MB page that fetches nothing.
 * gen-sigdb-index.ts embeds the database as a gzipped base64 blob; this unpacks and searches it.
 */
import { rankName } from '../../src/util/text/name-rank';
import type { SigIndex } from '../sigdb-index';

/**
 * One row of the packages table: the columns encode() in sigdb-index.ts writes for a PackageEntry
 * (exports collapsed to a count, files joined by |); booleans travel as '0'/'1' strings.
 */
type PackedPackage = readonly [
	name:      string,
	version:   string,
	base:      string,
	downloads: string,
	exports:   string,
	releases:  string,
	since:     string,
	archived:  string,
	files:     string,
	source:    string
];

/** one name's owner, decoded from encode()'s packed form: package index plus recorded flags/params/etc. */
interface OwnerEntry {
	readonly index:  number;
	readonly flags:  readonly string[];
	readonly params: number;
	readonly topic?: string;
	readonly file?:  number;
	readonly line?:  number;
}

/**
 * one row of the stated table: flowR's statement about a name in a package, as gen-sigdb-index.ts
 * encodes a StatedSignature -- package, joined property words, and formals as one string.
 */
type EncodedStatedSignature = readonly [pkg: string, props: string, args: string];

/** where a package comes from: CRAN unless a version states another repository */
interface Repository {
	readonly label: string;
	readonly home:  (pkg: string) => string | undefined;
}

/** one candidate hit while a search runs */
interface Match {
	readonly name:   string;
	/** where the needle starts in `name`, `-1` for a fuzzy hit that matched no contiguous run */
	readonly at:     number;
	/** the raw, comma-joined owner tokens for this name, exactly as the names blob stores them */
	readonly owners: string;
	/** the cheap sort key: found at the start, cased right, fuzzy, ... (lower is better) */
	rank:            number;
	/** the full rank from {@link score}, only meaningful for the names the search bothered to compute it for */
	score:           number;
}

/** an element the page is known to have; throws instead of silently returning null */
function byId<T extends Element = HTMLElement>(id: string): T {
	const found = document.getElementById(id);
	if(found === null) {
		throw new Error(`the sigdb page has no element #${id}`);
	}
	return found as unknown as T;
}

/** the payload of a `<script type="application/json">` tag the build wrote, parsed as `T` */
function readJson<T>(id: string): T {
	return JSON.parse(byId(id).textContent ?? 'null') as T;
}

/** a new element with its class and text set in one line, the two properties most creations here want */
function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
	const node = document.createElement(tag);
	if(className) {
		node.className = className;
	}
	if(text !== undefined) {
		node.textContent = text;
	}
	return node;
}

/** opens `link` in a new tab, safely: the target/rel pair every outbound link on this page sets */
function blank<T extends HTMLAnchorElement>(link: T): T {
	link.target = '_blank';
	link.rel = 'noopener';
	return link;
}

/* The table is unpacked once, on the first search, so opening the page stays cheap. */
let packages: readonly PackedPackage[] = [];
let names = '';
let byName = new Map<string, number>();
let loaded = false;

async function unpack(): Promise<void> {
	const encoded = (byId('data').textContent ?? '').trim();
	/* the decode is the slow part, so it happens in a worker built from a blob: no extra file to ship */
	const text = await inWorker(encoded).catch(() => decode(encoded));
	/* split at the first blank line only: a stray one further in must not cut the package table short */
	const between = text.indexOf('\n\n');
	const nameBlob = text.slice(0, between), packageBlob = text.slice(between + 2);
	/* the name table stays one string: splitting it into 577k entries is what used to freeze the page */
	names = nameBlob;
	packages = packageBlob.split('\n').map(line => line.split('\t') as unknown as PackedPackage);
	/* a package name back to its row, so `dplyr::` can be answered without scanning the table */
	byName = new Map(packages.map(([name], index) => [name, index]));
	loaded = true;
}

const q = byId<HTMLInputElement>('q'), mode = byId<HTMLSelectElement>('mode');
const sort = byId<HTMLSelectElement>('sort');
/** each filter, with what it says when the pointer rests on it */
const Filters: readonly (readonly [what: string, key: string, label: string, about: string])[] = [
	['only', 'package', 'packages', 'list packages rather than the names they export'],
	['pkg', 'archive', 'archived', 'names from a package CRAN no longer carries'],
	['flag', 't', 'throw', 'may raise an error, so a caller cannot count on getting a value back'],
	['flag', 'n', 'non-det.', 'non-deterministic: may answer differently for the same arguments, like random draws or the clock'],
	['flag', '3', 'S3', 'S3 method: an implementation of a generic for one class, like print.data.frame'],
	['flag', 'x', 'depr.', 'marked as deprecated by the package itself'],
	['flag', 'd', 'calls depr.', 'calls deprecated: calls something deprecated, so it may stop working when that goes'],
	['flag', 'c', 'value', 'a value rather than a function, like pi or LETTERS'],
	['flag', 'v', 'no loc', 'no location: the database records no file and line for it. Usually a constant, a dataset or a class object, sometimes a function nothing wrote down, like an S4 generic setGeneric builds'],
	['name', 'group', 'S4', 'S4 group member: a member of an S4 group generic (Math, Arith, Summary, ...), which a package usually exports because it answered the group for one of its classes'],
	['kind', 'read', 'read', 'reads data from somewhere outside the program, like read.csv'],
	['kind', 'write', 'write', 'writes data out of the program, like write.csv'],
	['kind', 'visualize', 'plot', 'draws something, like plot or ggsave'],
	['kind', 'library', 'load', 'attaches a package, like library or require']
];
const active = new Set<string>();
const filters = byId('filters');
const scope = byId<HTMLButtonElement>('scope');
scope.addEventListener('click', () => {
	q.value = q.value.replace(/^[\w.]+:::?/, '');
	void search();
});
const picks = [...document.querySelectorAll<HTMLButtonElement>('.pick')];
let how = 'all';
const buttons = new Map<string, HTMLButtonElement>();
for(const [what, key, label, about] of Filters) {
	const button = el('button', undefined, label);
	button.type = 'button';
	button.title = about + '. Click to filter by it, click again to drop it';
	button.setAttribute('aria-pressed', 'false');
	button.addEventListener('click', () => {
		const id = what + ':' + key;
		if(active.has(id)) {
			active.delete(id);
		} else {
			active.add(id);
		}
		button.setAttribute('aria-pressed', String(active.has(id)));
		void search();
	});
	buttons.set(what + ':' + key, button);
	filters.append(button);
}
for(const pick of picks) {
	pick.addEventListener('click', () => {
		how = pick.dataset.mix ?? 'all';
		picks.forEach(other => other.setAttribute('aria-pressed', String(other === pick)));
		void search();
	});
}

/** drops every active filter, which is what asking for a whole package means */
function clearFilters(): void {
	active.clear();
	for(const button of buttons.values()) {
		button.setAttribute('aria-pressed', 'false');
	}
}

/** does one filter hold for this name? */
function holds(id: string, name: string, owners: readonly string[]): boolean {
	const [what, key] = id.split(':');
	if(what === 'only') {
		return false;   // it selects what is listed, not which names qualify
	}
	if(what === 'name') {
		/* a property of the name itself, so no owner has to agree for it to hold */
		return groups.has(name);
	}
	if(what === 'pkg') {
		/* a property of the package rather than of the name: archived means CRAN dropped it */
		return owners.some(entry => packages[owner(entry).index]?.[7] === '1');
	}
	return what === 'kind'
		? (kinds.get(name) ?? []).includes(key)
		: owners.some(entry => owner(entry).flags.includes(key));
}

/** `all of` wants every active filter, `any of` wants one of them */
function passes(name: string, owners: readonly string[]): boolean {
	if(active.size === 0) {
		return true;
	}
	const matched = [...active].filter(id => holds(id, name, owners)).length;
	return how === 'any' ? matched > 0 : how === 'none' ? matched === 0 : matched === active.size;
}

/** a filter that would leave nothing behind is greyed out rather than silently emptying the list */
function offerFilters(matches: readonly Match[]): void {
	for(const [id, button] of buttons) {
		/* `match none` is about what to exclude, so a filter that matches nothing is still useful there */
		const would = id.startsWith('only:') || how === 'none' || matches.some(match => holds(id, match.name, match.owners.split(',')));
		button.disabled = !would && !active.has(id);
	}
}
const status = byId('status'), hits = byId<HTMLUListElement>('hits');
const Step = 100;
let limit = Step;

/** base64 to gzip to text, the plain way */
async function decode(encoded: string): Promise<string> {
	const raw = Uint8Array.from(atob(encoded), c => c.charCodeAt(0));
	return new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
}

/** the same, on a worker thread, so the page stays usable while several megabytes are unpacked */
function inWorker(encoded: string): Promise<string> {
	const source = `self.onmessage = async ({ data }) => {
		const raw = Uint8Array.from(atob(data), c => c.charCodeAt(0));
		const text = await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
		self.postMessage(text);
	};`;
	return new Promise((resolve, reject) => {
		const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
		const worker = new Worker(url);
		worker.onmessage = (event: MessageEvent<string>) => {
			resolve(event.data);
			worker.terminate();
			URL.revokeObjectURL(url);
		};
		worker.onerror = error => {
			/* the caller only falls back to the plain decode on any rejection, so the reason itself is never read */
			reject(new Error(error.message));
			worker.terminate();
			URL.revokeObjectURL(url);
		};
		worker.postMessage(encoded);
	});
}

/** whether this name has a manual page; `?` (unknown) is only guessed where the alias table confirms it */
function documented(name: string, flags: readonly string[], index: number): boolean {
	if(flags.includes('u')) {
		return false;
	}
	/* detail() already confirmed the row exists; fallback only affects an already-broken lookup's output */
	const pkg = packages[index]?.[0] ?? '';
	/* what a link would name: the topic when one is recorded, else the name itself */
	const page = topics.get(pkg + '::' + name) || name;
	if(!/^[A-Za-z.][A-Za-z0-9._-]*$/.test(page)) {
		return false;
	}
	/* base R's alias table lists every page it has; undocumented exports (locals, internals) have none */
	if(packages[index]?.[2] === '1') {
		return !topicsKnown || topics.has(pkg + '::' + name);
	}
	/* `?` means the database knows nothing; outside base R there's no table to confirm a page, so don't guess */
	return !flags.includes('?');
}

/** the file an export lives in, undefined if the database records none; see sourceUrl below */
function sourceFile(index: number, file: number | undefined): string | undefined {
	return file === undefined ? undefined : (packages[index]?.[8] ?? '').split('|')[file] || undefined;
}

/** source url for an export: R's mirror for base R, the CRAN mirror otherwise, else just the repository */
function sourceUrl(pkg: string, version: string | undefined, base: boolean, file: string | undefined, line: number | undefined, repository: Repository | undefined): string | undefined {
	const at = line === undefined ? '' : '#L' + line;
	if(base) {
		const series = /^(\d+)\.(\d+)/.exec(version ?? '');
		const ref = series ? 'R-' + series[1] + '-' + series[2] + '-branch' : 'trunk';
		const root = 'https://github.com/wch/r-source/' + (file ? 'blob' : 'tree') + '/' + ref
			+ '/src/library/' + encodeURIComponent(pkg);
		return file ? root + '/' + file + at : root + '/R';
	}
	if(repository !== undefined && repository !== Repositories['cran']) {
		return repository.home(pkg);
	}
	const root = 'https://github.com/cran/' + encodeURIComponent(pkg) + '/' + (file ? 'blob' : 'tree') + '/'
		+ encodeURIComponent(version ?? 'master');
	return file ? root + '/' + file + at : root;
}

/** where a package comes from, as the database records it; CRAN unless a version states another repository */
const Repositories: Record<string, Repository> = {
	'cran':         { label: 'CRAN',          home: pkg => 'https://cran.r-project.org/package=' + encodeURIComponent(pkg) },
	'bioc':         { label: 'Bioconductor',  home: pkg => 'https://bioconductor.org/packages/' + encodeURIComponent(pkg) },
	'bioconductor': { label: 'Bioconductor',  home: pkg => 'https://bioconductor.org/packages/' + encodeURIComponent(pkg) },
	'github':       { label: 'GitHub',        home: pkg => 'https://github.com/search?q=' + encodeURIComponent(pkg) + '+language%3AR&type=repositories' },
	'r-universe':   { label: 'R-universe',    home: pkg => 'https://r-universe.dev/search?q=' + encodeURIComponent(pkg) },
	'runiverse':    { label: 'R-universe',    home: pkg => 'https://r-universe.dev/search?q=' + encodeURIComponent(pkg) },
	'omegahat':     { label: 'Omegahat',      home: pkg => 'https://www.omegahat.net/' + encodeURIComponent(pkg) + '/' },
	'rforge':       { label: 'R-Forge',       home: pkg => 'https://r-forge.r-project.org/projects/' + encodeURIComponent(pkg) + '/' }
};

/** the repository of the package at `index`; base R comes with R itself, and an unrecorded one is CRAN */
function repositoryOf(index: number): Repository {
	const row = packages[index];
	if(row?.[2] === '1') {
		return { label: 'base R', home: pkg => 'https://stat.ethz.ch/R-manual/R-devel/library/' + encodeURIComponent(pkg) + '/html/00Index.html' };
	}
	const source = row?.[9] ?? '';
	const stated = source.toLowerCase();
	/* a repository the page has no address for still says its name, which beats claiming CRAN */
	return Repositories[stated] ?? (stated === '' ? Repositories['cran'] : { label: source, home: () => undefined });
}

/** where a package documents itself, for a name that has no page of its own */
function packageDocUrl(index: number): string {
	const [pkg, , base] = packages[index];
	/* rdrr.io has no index page for a base package, but the R manual does */
	return base === '1' ? 'https://stat.ethz.ch/R-manual/R-devel/library/' + encodeURIComponent(pkg) + '/html/00Index.html'
		: 'https://rdrr.io/cran/' + encodeURIComponent(pkg) + '/';
}

/* base R links to its own manual, not rdrr.io, which is stale and lacks recent additions like array2DF */
function docUrl(name: string, entry: { readonly index: number, readonly topic?: string }): string {
	const { index, topic } = entry;
	const [pkg, , base] = packages[index];
	const page = encodeURIComponent(topic || topics.get(pkg + '::' + name) || name);
	return base === '1' ? 'https://stat.ethz.ch/R-manual/R-devel/library/' + encodeURIComponent(pkg) + '/html/' + page + '.html'
		: 'https://rdrr.io/cran/' + encodeURIComponent(pkg) + '/man/' + page + '.html';
}

/** a name with the matched part marked, built as nodes so a function name can never inject markup */
function marked(name: string, needle: string, at: number): HTMLSpanElement {
	const span = el('span', 'name');
	span.title = 'click for every package that exports ' + name;
	if(at < 0) {
		/* fuzzy hits match scattered chars; adjacent ones merge into one mark instead of many tiny boxes */
		const wanted = needle.toLowerCase();
		let next = 0, run = '', plain = '';
		const flush = () => {
			if(run) {
				span.append(el('mark', undefined, run));
				run = '';
			}
		};
		for(const c of name) {
			if(next < wanted.length && c.toLowerCase() === wanted[next]) {
				span.append(plain);
				plain = '';
				run += c;
				next++;
			} else {
				flush();
				plain += c;
			}
		}
		flush();
		span.append(plain);
		return span;
	}
	span.append(name.slice(0, at));
	span.append(el('mark', undefined, name.slice(at, at + needle.length)), name.slice(at + needle.length));
	return span;
}

/** ranks a name by what the reader likely meant, using the same ranker as the playground's completion */
function score(name: string, owners: string, rank: number, needle: string): number {
	const first = owner(owners.split(',')[0]);
	const pkg = packages[first.index];
	return rankName({
		name, needle, rank,
		downloads: Number(pkg?.[3] ?? 0),
		baseR:     pkg?.[2] === '1',
		base:      pkg?.[0] === 'base',
		known:     kinds.has(name),
		s3:        first.flags.includes('3'),
		/* only a stated value ranks lower: a function the database records no definition for is still a function */
		variable:  first.flags.includes('c')
	});
}

/** every character of the needle, in order but not necessarily adjacent: `rcsv` finds `read.csv` */
function fuzzy(name: string, needle: string): boolean {
	let at = 0;
	for(const c of needle) {
		at = name.indexOf(c, at) + 1;
		if(at === 0) {
			return false;
		}
	}
	return true;
}

/** what the letters in an owner entry mean, spelled out for the reader */
const FlagNames: Record<string, string> = {
	t:   'can throw', '3': 'S3 method', n:   'non-deterministic', d:   'calls something deprecated',
	r:   'recursive', i:   'calls internals', o:   'owns an S3 class', '4': 'owns an S4 class',
	m:   'S4 method', h:   'higher order', x:   'deprecated', c:   'value', v:   'no loc', u:   'no docs'
};

/** the flags recording something about the entry rather than about the call, which no signature states */
const MetaFlags: readonly string[] = ['c', 'v', 'u'];

/** the few flags whose short form does not speak for itself */
const FlagAbout: Record<string, string> = {
	c: 'the database records it as a value rather than a function',
	v: 'no location: the database records no file and line for it in this package. Usually a constant, a dataset '
		+ 'or a class object, sometimes a function nothing wrote down, like an S4 generic setGeneric builds',
	u: 'no manual page for this name in this package'
};

/** an owner reads `12` or `12:tn:4:topic:5:2g`: package, flags, params, topic, file, line (base 36) */
function owner(entry: string): OwnerEntry {
	const [index, flags, params, topic, file, line] = entry.split(':');
	return {
		index:  Number(index),
		flags:  [...(flags ?? '')],
		params: Number(params) || 0,
		topic:  topic ? decodeURIComponent(topic) : undefined,
		file:   file ? parseInt(file, 36) : undefined,
		line:   line ? parseInt(line, 36) : undefined
	};
}

/* a Map, not the parsed object: R exports names like `toString`, and those would hit Object's prototype */
const kinds: SigIndex['kinds'] = new Map(Object.entries(readJson<Record<string, string[]>>('kinds')));
/* name -> [package, properties, formals][]; flattened wire shape, not the StatedSignature objects */
const stated = new Map(Object.entries(readJson<Record<string, readonly EncodedStatedSignature[]>>('stated')));
/* package::alias -> topic for every documented base R name; keys double as the set with a manual page */
const topics: SigIndex['topics'] = new Map(Object.entries(readJson<Record<string, string>>('topics')));
/* names something dispatches on: makes `format.Date` a method, `is.datacggm` just a function */
const generics: SigIndex['generics'] = new Set(readJson<string>('generics').split('\n').filter(Boolean));
/* whether generics is complete; without an R to read alias tables from, it holds only the primitives */
const topicsKnown = readJson<boolean>('topics-complete');
/* `name -> [package, parameters][]`: what base R itself declares, which flowR states nothing about */
const formals: SigIndex['formals'] = new Map(Object.entries(readJson<Record<string, [pkg: string, params: string][]>>('formals')));
/* name -> S4 group generic: `sin` belongs to `Math`, exported by answering `Math` for a class */
const groups: SigIndex['groups'] = new Map(Object.entries(readJson<Record<string, string>>('groups')));
/** how flowR describes what one of its known functions does */
const KindNames: Record<string, string> = {
	library:   'can load a package', source:    'can source a file', read:      'can read a file',
	write:     'can write a file', visualize: 'can draw a plot', test:      'a test', remote:    'can use the network',
	builtin:   'flowR'
};

/** CRAN downloads over the last month (what `cran_downloads(when = "last-month")` reported) */
function count(downloads: string): string {
	const n = Number(downloads);
	return (n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? Math.round(n / 1e3) + 'k' : String(n)) + '/month';
}

function ownerLink(index: number): HTMLAnchorElement {
	const [name, version, base] = packages[index];
	const link = blank(el('a', base === '1' ? 'base' : '', name));
	const repository = repositoryOf(index);
	link.title = name + ' ' + version + (base === '1' ? ' (base R, always available)' : ' (' + repository.label + ')');
	link.href = (base === '1' ? 'https://stat.ethz.ch/R-manual/R-devel/library/' + encodeURIComponent(name) + '/html/00Index.html'
		: repository.home(name)) ?? '';
	return link;
}

const Shown = 3;

/** one aligned row per owning package, each one a link to that package's manual page for this name */
function detail(name: string, owners: readonly string[]): HTMLDivElement {
	/* the packages flowR itself states something about, so its words land on the right row */
	const statedFor = new Map((stated.get(name) ?? []).map(entry => [entry[0], entry] as const));
	const box = el('div', 'detail');
	const list = el('div', 'owns');
	for(const entry of owners) {
		const { index, flags, topic, file, line } = owner(entry);
		const packageRow = packages[index];
		if(packageRow === undefined) {
			continue;   // an index the table does not have: never expected, never fatal
		}
		const [pkg, version, base, downloads] = packageRow;
		const row = el('div', 'own');
		if(documented(name, flags, index)) {
			row.title = 'the manual page for ' + name + ' in ' + pkg;
		} else {
			/* no page of its own, so the package's documentation is the next best thing */
			row.classList.add('undocumented');
			/* an S4 group member is usually documented under its alias, e.g. `sin,float32-method` on float's `trig` */
			row.title = groups.has(name) && base !== '1'
				? name + ' has no manual page of its own in ' + pkg + ': an S4 method is documented under its '
					+ name + ',<class>-method alias, so this links to the package documentation'
				: name + ' has no manual page in ' + pkg + ', so this links to the package documentation';
		}
		/* the name and the arrow open the manual page; the row is not one link so the source can sit within it */
		const docs: HTMLAnchorElement[] = [];
		const who = el('a', 'pkg', pkg);
		docs.push(who);
		row.append(who);
		const marks = el('span', 'flags');
		/* one signature per package version: flowR's formals if declared, merged with both statements' labels */
		const own = statedFor.get(pkg);
		const here = {
			args:  own?.[2] || declaredIn(name, pkg) || '',
			props: mergedWords(own?.[1], flagWords(flags))
		};
		/* the signature spells these out a moment later, and a badge saying it once more only costs the line */
		const said = new Set(wordsOf(here.props));
		for(const flag of flags) {
			if(FlagNames[flag] && !said.has(FlagNames[flag])) {
				const one = el('span', 'flag', FlagNames[flag]);
				if(FlagAbout[flag]) {
					one.title = FlagAbout[flag];
				}
				marks.append(one);
			}
		}
		const ver = el('span', 'ver', Number(downloads) > 0 ? version + ' · ' + count(downloads) : version);
		ver.title = Number(downloads) > 0
			? Number(downloads).toLocaleString('en-US') + ' CRAN downloads in the last month'
			: 'ships with R, so CRAN counts nothing';
		const tag = el('span', 'tag', base === '1' ? 'base R' : 'CRAN');
		if(here.args !== '' || here.props !== '') {
			marks.append(signature(name, here.args, here.props));
		}
		const go = el('a', 'go', '↗');
		for(const link of docs) {
			link.target = '_blank';
			link.rel = 'noopener';
			if(documented(name, flags, index)) {
				link.href = docUrl(name, { index, topic });
				link.title = 'the manual page for ' + name + ' in ' + pkg;
			} else {
				/* no page of its own, so the package's documentation is the next best thing */
				link.href = packageDocUrl(index);
				row.classList.add('undocumented');
				link.title = 'no manual page is recorded for ' + name + ' in ' + pkg + ', so this links to the package documentation';
			}
		}
		/* where this very function is written, which the manual page never shows */
		const where = sourceFile(index, file);
		const src = blank(el('a', 'src'));
		src.href = sourceUrl(pkg, version, base === '1', where, line, repositoryOf(index)) ?? '';
		src.textContent = where === undefined ? '' : where + (line === undefined ? '' : ':' + line);
		src.title = where === undefined
			? 'the database records no file for ' + name + ' in ' + pkg + ', so this links to its sources'
			: 'where ' + pkg + '::' + name + ' is written, in ' + pkg + ' ' + version;
		if(where === undefined) {
			src.classList.add('nofile');
			src.textContent = 'sources';
		}
		row.append(marks, src, ver, tag, go);
		/* the row reads as one thing, so anything on it that is not a link of its own opens the manual page */
		row.addEventListener('click', event => {
			if(!(event.target as HTMLElement | null)?.closest('a')) {
				window.open(who.href, '_blank', 'noopener');
			}
		});
		list.append(row);
	}
	const note = el('p', 'ask');
	const command = document.createElement('span');
	/* pointing at a package means asking about that one, so the command says which */
	const asks = (qualified: string) => command.textContent = ':query @signature ' + qualified;
	/* a lone word names a package, so asking about the function in any package needs the `*` glob in front */
	const anyPackage = '* ' + name;
	asks(anyPackage);
	note.append(el('span', undefined, 'for parameters and the call graph, ask flowR:'), command);
	list.addEventListener('mouseover', event => {
		const row = (event.target as HTMLElement | null)?.closest('.own');
		asks(row ? (row.querySelector('.pkg')?.textContent ?? '') + '::' + name : anyPackage);
	});
	list.addEventListener('mouseleave', () => asks(anyPackage));
	box.append(list, note);
	return box;
}

/** `print.rema` dispatches for `print`: the longest prefix before a dot that is itself a known name */
function genericOf(name: string, owners: readonly string[]): string | undefined {
	if(!owners.some(entry => owner(entry).flags.includes('3'))) {
		return undefined;
	}
	/* the longest prefix something dispatches on: `is` is a name, but `is.datacggm` is not a method of it */
	let found: string | undefined;
	for(let at = name.indexOf('.'); at > 0; at = name.indexOf('.', at + 1)) {
		if(generics.has(name.slice(0, at))) {
			found = name.slice(0, at);
		}
	}
	return found;
}

/** the generic an S4 method answers (from `generic,signature-method`), undefined if not an S4 method */
function s4GenericOf(name: string, owners: readonly string[]): string | undefined {
	if(!owners.some(entry => owner(entry).flags.includes('m'))) {
		return undefined;
	}
	const at = name.indexOf(',');
	return at > 0 ? name.slice(0, at) : undefined;
}

/** a package is a thing to find too: searching `dplyr` should offer the package, not only its names */
function showPackage(index: number, needle: string, at: number): void {
	const [name, version, base, downloads, exports, releases, , archived] = packages[index];
	const row = el('li', 'pkghit');
	const head = el('div', 'head');
	const title = el('span', 'name');
	title.append(name.slice(0, at));
	title.append(el('mark', undefined, name.slice(at, at + needle.length)), name.slice(at + needle.length));
	const badge = el('span', 'kindtag', base === '1' ? 'base R package' : archived === '1' ? 'archived package' : 'package');
	if(archived === '1') {
		badge.classList.add('gone');
	}
	const facts = el('span', 'owners');
	facts.textContent = [
		version,
		Number(downloads) > 0 ? count(downloads) : null,
		exports + ' exports',
		Number(releases) > 0 ? releases + (Number(releases) === 1 ? ' release' : ' releases') : null
	].filter(Boolean).join(' · ');
	facts.title = Number(downloads) > 0
		? Number(downloads).toLocaleString('en-US') + ' CRAN downloads in the last month'
		: 'ships with R, so CRAN counts nothing';
	head.append(title, badge, facts);
	row.append(head);
	/* the button scopes the search; the row itself opens what flowR knows about the package */
	row.addEventListener('click', event => {
		if((event.target as HTMLElement | null)?.closest('a')) {
			return;
		}
		const open = row.querySelector('.detail');
		if(open) {
			open.remove();
		} else {
			row.append(aboutPackage(index));
		}
	});
	hits.append(row);
}

/** what the database holds about one package, in the same shape as the per-name detail */
function aboutPackage(index: number): HTMLDivElement {
	const [name, version, base, downloads, exports, releases, since, archived] = packages[index];
	const box = el('div', 'detail');
	const facts: readonly (readonly [string, string])[] = [
		['latest version', version],
		['exported names', Number(exports).toLocaleString('en-US')],
		['releases known', Number(releases) > 0
			? Number(releases).toLocaleString('en-US') + (Number(since) > 0 ? ', the first in ' + since : '')
			: 'none recorded'],
		['downloads', Number(downloads) > 0 ? Number(downloads).toLocaleString('en-US') + ' in the last month' : 'ships with R'],
		['comes from', base === '1' ? 'base R'
			: repositoryOf(index).label + (archived === '1' ? ', since archived' : '')]
	];
	for(const [label, value] of facts) {
		const line = document.createElement('p');
		line.append(el('span', 'kind', label), value);
		box.append(line);
	}
	const links = el('p', 'links');
	const repository = repositoryOf(index);
	const where: readonly [string | undefined, string] = base === '1'
		? ['https://stat.ethz.ch/R-manual/R-devel/library/' + encodeURIComponent(name) + '/html/00Index.html', 'the R manual']
		: [repository.home(name), repository.label];
	const offered: readonly (readonly [string | undefined, string])[] =
		[where, ['?q=' + encodeURIComponent(name + '::'), 'everything it exports']];
	for(const [href, text] of offered.filter((entry): entry is readonly [string, string] => Boolean(entry[0]))) {
		const link = el('a', undefined, text);
		link.href = href;
		if(href.startsWith('http')) {
			blank(link);
		} else {
			link.addEventListener('click', event => {
				event.preventDefault();
				clearFilters();
				q.value = name + '::';
				void search();
			});
		}
		links.append(link);
	}
	box.append(links);
	return box;
}

/** moves flowR's stated package to the front when the database omits it, e.g. `+` (no NAMESPACE) */
function withStatedOwner(name: string, owners: readonly string[]): readonly string[] {
	/* a name no package exports has one empty entry, which is a row rather than an owner */
	const known = owners.filter(entry => entry !== '');
	const mine = stated.get(name) ?? [];
	if(mine.length === 0) {
		return known;
	}
	const already = new Set(known.map(entry => packages[owner(entry).index]?.[0]));
	const missing = mine.map(entry => entry[0]).filter(pkg => pkg !== '' && !already.has(pkg));
	/* `?` says the database holds nothing about it, so nothing about its manual page is guessed either */
	const found = missing.map(pkg => packages.findIndex(entry => entry[0] === pkg)).filter(at => at >= 0);
	return found.length === 0 ? known : [...found.map(at => at + ':?'), ...known];
}

/** short forms of what a call does and its argument roles; the full words show as a tooltip */
const Words: Record<string, string> = {
	/* what a call is and does, flowR's words and the database's for the same thing alike */
	'can throw':                  'throws', 'invisible':                  'invis', 's3 method':                  's3', 'S3 method':                  's3', 'S4 method':                  's4',
	'changes scope':              'scope', 'non deterministic':          'nondet', 'non-deterministic':          'nondet',
	'ambient state':              'ambient', 'file system':                'file', 'network':                    'net', 'concurrent':                 'async',
	'calls something deprecated': 'calls depr', 'calls internals':            'internal', 'recursive':                  'rec',
	'owns an S3 class':           's3 class', 'owns an S4 class':           's4 class', 'higher order':               'hof', 'deprecated':                 'depr',
	'maybe pure':                 'maypure', 'sets ambient state':         'configures', 'calls native code':          'ffi',
	'produces language object':   'lang',
	/* the semantic labels, which flowR states as the words its configuration spells them with */
	'temp-file':                  'tmpfile', 'asks-user':                  'user', 'command-line':               'argv', 'draws-graphics':             'plot',
	'opens-handle':               'opens', 'closes-handle':              'closes', 'narrows-args':               'narrows', 'statistics':                 'stats',
	'javascript':                 'js',
	/* when an argument is evaluated is a letter (`F+val`), what it is used for stays a word */
	'forced':                     'F', 'no default':                 'R', 'lazy':                       'L',
	'value':                      'val', 'resource':                   'res', 'written':                    'out', 'callee':                     'fn', 'presence':                   'seen'
};

/** what a call hands back, which belongs behind the formals like a return type */
const Returns: readonly string[] = ['invisible'];

/** the `|`-joined words of the page's own encoding, as a list */
function wordsOf(joined: string): string[] {
	return joined.split('|').filter(Boolean);
}

/** the words as a reader sees them, shortened where {@link Words} has something shorter */
function short(words: readonly string[]): string[] {
	return words.map(word => Words[word] ?? word);
}

/**
 * merges several statements about a name into one word list (flowR's labels then the database's),
 * deduped after shortening so two spellings of the same thing (e.g. `file system` becomes `file`) collapse.
 */
function mergedWords(...statements: readonly (string | undefined)[]): string {
	const seen = new Set<string>();
	const kept: string[] = [];
	for(const word of statements.flatMap(statement => wordsOf(statement ?? ''))) {
		const shortened = Words[word] ?? word;
		if(!seen.has(shortened)) {
			seen.add(shortened);
			kept.push(word);
		}
	}
	return kept.join('|');
}

/** the words of `props` split into what the call is and does, and what it hands back */
function parts(props: string): { kind: string[], returns: string[] } {
	const words = wordsOf(props);
	return { kind: words.filter(word => !Returns.includes(word)), returns: words.filter(word => Returns.includes(word)) };
}

/** the formals of `args` as `[name, roles]`, the roles empty for a declaration that states none */
function argsOf(args: string): (readonly [string, readonly string[]])[] {
	return args.split(',').filter(Boolean).map((arg): readonly [string, readonly string[]] => {
		const at = arg.indexOf(':');
		return at < 0 ? [arg.trim(), []] : [arg.slice(0, at).trim(), wordsOf(arg.slice(at + 1))];
	});
}

/** one `name: roles` part of a signature, the roles set apart from the formal they belong to */
function formal([name, roles]: readonly [string, readonly string[]]): HTMLSpanElement {
	const part = el('span', 'formal');
	part.append(name);
	if(roles.length > 0) {
		part.append(el('i', 'role', ': ' + short(roles).join('+')));
	}
	return part;
}

/** the same signature spelled out, which is what a reader gets on hovering the short one */
function readable(name: string, args: string, props: string): string {
	const spelled = argsOf(args).map(([formalName, roles]) => roles.length === 0 ? formalName : formalName + ': ' + roles.join(' + ')).join(', ');
	const { kind, returns } = parts(props);
	return name + (kind.length > 0 ? '[' + kind.join(',') + ']' : '') + (args === '' ? '' : '(' + spelled + ')')
		+ (returns.length > 0 ? ', returns ' + returns.join(' and ') : '');
}

/** signature as `name<kind>(formal: role): returns`; parens omitted only when no formals are known at all */
function signature(name: string, args: string, props: string): HTMLElement {
	const said = el('code', 'stated');
	const { kind, returns } = parts(props);
	said.append(el('b', undefined, name));
	if(kind.length > 0) {
		said.append(el('i', 'kind', '[' + short(kind).join(',') + ']'));
	}
	if(args !== '') {
		/* the formals are what gets cut when the line is too long; what the call is and does stays */
		const list = el('span', 'args');
		list.append('(');
		argsOf(args).forEach((arg, at) => list.append(at > 0 ? ', ' : '', formal(arg)));
		list.append(')');
		said.append(list);
	}
	if(returns.length > 0) {
		said.append(el('i', 'ret', ': ' + short(returns).join(',')));
	}
	/* the short form is for the glance, the words for the reader who stops on it */
	said.title = readable(name, args, props);
	return said;
}

/** the flags the database records about the call itself, as the `|`-joined words a signature states */
function flagWords(flags: readonly string[]): string {
	return flags.filter(flag => !MetaFlags.includes(flag)).map(flag => FlagNames[flag]).filter(Boolean).join('|');
}

/** what base R declares for `name` in `pkg`, which the page carries for base R alone */
function declaredIn(name: string, pkg: string | undefined): string | undefined {
	return (formals.get(name) ?? []).find(entry => entry[0] === pkg)?.[1];
}

/** the package the current search is scoped to, `dplyr` in `dplyr::filter` */
let scoped: string | undefined;

function show(name: string, needle: string, at: number, owners: readonly string[]): void {
	const row = document.createElement('li');
	const head = el('div', 'head');
	/* decided by the likely package: `pi` reads as a constant even though something else exports `pi()` */
	const value = owner(owners[0]).flags.includes('c');
	head.append(marked(name, needle, at));
	if(value) {
		(head.firstChild as HTMLElement).classList.add('value');
		const badge = el('span', 'kindtag value', 'value');
		badge.title = 'the database records it as a value rather than a function';
		head.append(badge);
	}
	/* flowR's own statement, the one thing the database can't tell; shown for whichever package is meant */
	const mine = stated.get(name) ?? [];
	/* the package the search named, else the one a reader most likely means */
	const chosen = owners.find(entry => packages[owner(entry).index]?.[0] === scoped) ?? owners[0];
	const first = packages[owner(chosen).index];
	const own = mine.find(entry => entry[0] === first?.[0]) ?? mine.find(entry => entry[0] === 'base') ?? mine[0];
	const words = short(wordsOf(own?.[1] ?? ''));
	/* what the name does comes first, that flowR knows it at all comes after */
	const known = kinds.get(name) ?? [];
	for(const kind of [...known.filter(k => k !== 'builtin'), ...known.filter(k => k === 'builtin')]) {
		head.append(el('span', kind === 'builtin' ? 'kindtag flowr' : 'kindtag', KindNames[kind] ?? kind));
		/* the signature below states them where flowR carries one, and repeating them as a count says nothing */
		if(kind === 'builtin' && words.length > 0 && !own) {
			const more = el('span', 'kindtag props', '+' + words.length);
			more.title = 'flowR states ' + words.join(', ') + ' about this call; open the entry to see which package for';
			head.append(more);
		}
	}
	/* the generics this name answers, which the row states in words rather than the signature in short */
	const dispatches = (
		[['S3', genericOf(name, owners)], ['S4', s4GenericOf(name, owners)]] as readonly (readonly [string, string | undefined])[]
	).filter((entry): entry is readonly [string, string] => entry[1] !== undefined);
	/* skip `s3` in the signature when the row already says `S3 method for format` next to it */
	const said = dispatches.map(([kind]) => kind.toLowerCase() + ' method');
	/* one signature for the likely package: flowR's formals leading, both statements' labels merged in */
	const shown = {
		args:  own?.[2] || declaredIn(name, first?.[0]) || '',
		props: wordsOf(mergedWords(own?.[1], flagWords(owner(chosen).flags)))
			.filter(word => !said.includes(word.toLowerCase())).join('|')
	};
	if(shown.args !== '' || shown.props !== '') {
		head.append(signature(name, shown.args, shown.props));
	}
	for(const [kind, generic] of dispatches) {
		const link = el('a', 'generic', kind + ' method for ' + generic);
		link.href = '?q=' + encodeURIComponent(generic);
		link.title = 'search for the generic this method dispatches for';
		head.append(link);
	}
	/* an S4 group member is exported via the whole group for one class, so it says little about the package */
	const group = groups.get(name);
	if(group) {
		const link = el('a', 'generic', group + ' group');
		link.href = '?q=' + encodeURIComponent(group);
		link.title = name + ' belongs to R\'s ' + group + ' group generic: a package may answer it for its own '
			+ 'class with setMethod("' + name + '", ...) or setMethod("' + group + '", ...) instead of defining a '
			+ 'function of its own. Click to search for ' + group + '.';
		head.append(link);
	}
	const list = el('span', 'owners');
	for(const entry of owners.slice(0, Shown)) {
		list.append(ownerLink(owner(entry).index));
	}
	if(owners.length > Shown) {
		const rest = el('button', 'more', '+' + (owners.length - Shown) + ' more');
		rest.type = 'button';
		list.append(rest);
	}
	head.append(list);
	row.append(head);
	row.addEventListener('click', event => {
		if((event.target as HTMLElement | null)?.closest('a')) {
			return;   // a link is a link, not a toggle
		}
		const open = row.querySelector('.detail');
		if(open) {
			open.remove();
		} else {
			row.append(detail(name, owners));
		}
	});
	hits.append(row);
}

/* names per scan chunk before yielding, and the max hit count still worth counting packages for */
const Chunk = 40000;
const Countable = 50000;

let pending = 0;
async function search(): Promise<void> {
	/* `dplyr::filter` asks about that package, not about every `filter` there is */
	const typed = q.value.trim().replace(/^\?/, '').replace(/\(\s*\)$/, '').trim();
	const qualified = /^([\w.]+):::?(.*)$/.exec(typed);
	const inPackage = qualified?.[1];
	/* a search for `dplyr::filter` is about dplyr's, so that is the one a hit answers for */
	scoped = inPackage;
	const needle = (qualified?.[2] ?? typed).trim();
	const run = ++pending;
	hits.replaceChildren();

	if(!loaded) {
		await ready;   // set up at the bottom of this script, so the first listing waits for it
		if(run !== pending) {
			return;   // the reader typed on while it was being read
		}
	}
	const lower = needle.toLowerCase();
	const matches: Match[] = [];
	/* 577k names is more than one frame can hold; yield periodically and bail if a newer keystroke started */
	let breathe = Chunk;
	for(let start = 0; start < names.length;) {
		if(--breathe === 0) {
			breathe = Chunk;
			await new Promise(resume => setTimeout(resume, 0));
			if(run !== pending) {
				return;
			}
		}
		const tab = names.indexOf('\t', start);
		const stop = names.indexOf('\n', tab);
		const end = stop < 0 ? names.length : stop;
		const name = names.slice(start, tab);
		start = end + 1;
		const at = needle.length === 0 ? 0 : name.toLowerCase().indexOf(lower);
		const hit = needle.length === 0 || (mode.value === 'prefix' ? at === 0 : at >= 0);
		if(!hit && mode.value !== 'fuzzy') {
			continue;   // the owners are only sliced out for a name that survives
		}
		const owners = names.slice(tab + 1, end);
		if(hit) {
			/* `print` should beat `PRINT`: a match that also matches in case ranks ahead of one that does not */
			const cased = name.slice(at, at + needle.length) === needle ? 0 : 1;
			matches.push({ name, at, owners, rank: (at === 0 ? 0 : 2) + cased, score: 0 });
		} else if(mode.value === 'fuzzy' && fuzzy(name.toLowerCase(), lower)) {
			/* `flter` should find `filter` before `Filter`: a fuzzy hit that also matches in case ranks first */
			matches.push({ name, at: -1, owners, rank: fuzzy(name, needle) ? 4 : 5, score: 0 });
		}
	}
	if(sort.value === 'auto') {
		/* scoring parses an owner per hit, so huge match sets are cut by the cheap key before scoring the head */
		/* the cut must weigh the badge too, or `ggplot` never survives to be scored; `kinds` lookup stays cheap */
		const key = (name: string, rank: number) => (kinds.has(name) ? 0 : 1000) + rank;
		/* comparison-sorting six figures of matches is slow; bucketing by the few key values is much faster */
		const buckets = new Map<number, Match[]>();
		for(const match of matches) {
			const at = key(match.name, match.rank);
			const bucket = buckets.get(at);
			if(bucket === undefined) {
				buckets.set(at, [match]);
			} else {
				bucket.push(match);
			}
		}
		let into = 0;
		for(const at of [...buckets.keys()].sort((a, b) => a - b)) {
			for(const match of buckets.get(at) ?? []) {
				matches[into++] = match;
			}
		}
		const scored = matches.slice(0, 2000);
		scored.sort((a, b) => a.name.length - b.name.length);
		for(const match of scored) {
			match.score = score(match.name, match.owners, match.rank, needle);
		}
		scored.sort((a, b) => b.score - a.score);
		matches.splice(0, scored.length, ...scored);
	} else {
		matches.sort((a, b) => a.rank - b.rank || a.name.length - b.name.length
			|| (a.name.toLowerCase() < b.name.toLowerCase() ? -1 : a.name.toLowerCase() > b.name.toLowerCase() ? 1 : a.name < b.name ? -1 : 1));
	}
	/* a package was named, so only the names it exports count */
	scope.hidden = true;
	const wanted = inPackage === undefined ? undefined : byName.get(inPackage);
	/* `base::sin` is base R's whatever the database holds, so the scope asks the same owners a row shows */
	const inScope = wanted === undefined ? matches
		: matches.filter(match => withStatedOwner(match.name, match.owners.split(',')).some(entry => owner(entry).index === wanted));
	/* the packages whose own name matches; `packages` asks for those alone */
	const onlyPackages = active.has('only:package') || (needle.length === 0 && active.size === 0 && inPackage === undefined);
	type PackageHit = readonly [name: string, index: number, at: number];
	const allPackages: readonly PackageHit[] = inPackage !== undefined || (active.size > 0 && !onlyPackages) ? [] : packages
		.map((row, index): PackageHit => [row[0], index, row[0].toLowerCase().indexOf(lower)])
		/* only an exact package name matches; near-misses would bury `plot` under `plotly`/`plotrix` */
		.filter(([name, , at]) => onlyPackages ? at >= 0 : name.toLowerCase() === lower)
		.sort(sort.value === 'auto'
			? ([, a], [, b]) => Number(packages[b][3]) - Number(packages[a][3])
			: ([a], [b]) => a.length - b.length || (a < b ? -1 : 1));
	const asPackage = allPackages.slice(0, onlyPackages ? limit : 3);
	for(const [, index, at] of asPackage) {
		showPackage(index, needle, at);
	}
	offerFilters(inScope);
	const kept = onlyPackages ? [] : inScope.filter(match => passes(match.name, match.owners.split(',')));
	const found = kept.length;
	/* package count for the matches; skip it once matches are huge, since the answer is just `all of them` */
	let inPackages: number | undefined;
	if(found > 0 && found <= Countable) {
		const seen = new Set<string>();
		for(const match of kept) {
			for(const entry of match.owners.split(',')) {
				const colon = entry.indexOf(':');
				seen.add(colon < 0 ? entry : entry.slice(0, colon));
			}
		}
		inPackages = seen.size;
	}
	for(const match of kept.slice(0, limit)) {
		show(match.name, needle, match.at, withStatedOwner(match.name, match.owners.split(',')));
	}
	const where = inPackage === undefined ? ''
		: wanted === undefined ? ` (flowR knows no package called ${inPackage})` : ` in ${inPackage}`;
	report(onlyPackages ? allPackages.length : found, onlyPackages ? 'package' : 'name', where, inPackages);
}

/** how many there are, where they live, how many are on screen, and a way to see more of them */
function report(total: number, what: string, where: string, inPackages: number | undefined): void {
	const shown = hits.children.length;
	if(total === 0) {
		status.textContent = `Nothing here goes by that name${where}.`;
		return;
	}
	/* `11 names in dplyr in 23 packages` reads as a mistake, so a scoped answer says `also in` */
	const countLabel = inPackages === undefined ? undefined
		: `${inPackages.toLocaleString('en-US')} package${inPackages === 1 ? '' : 's'}`;
	const from = countLabel === undefined ? '' : where.length > 0 ? ` (also in ${countLabel})` : ` in ${countLabel}`;
	status.textContent = `${total.toLocaleString('en-US')} ${what}${total === 1 ? '' : 's'}${where}${from}`
		+ (shown < total ? ` · showing ${shown.toLocaleString('en-US')}` : '');
	if(shown < total) {
		const more = el('button', 'more-hits', `show ${Math.min(Step, total - shown)} more`);
		more.type = 'button';
		more.addEventListener('click', () => {
			limit += Step;
			void search();
		});
		hits.append(more);
	}
}

let timer = 0;
q.addEventListener('input', () => {
	clearTimeout(timer);
	limit = Step;   // a new question starts from the top again
	timer = window.setTimeout(() => void search(), 120);
});
mode.addEventListener('change', () => void search());
sort.addEventListener('change', () => void search());

q.value = new URLSearchParams(location.search).get('q') ?? '';
/* the table is read once, in the background, and the first listing follows on its own */
status.textContent = 'Unpacking the database…';
const ready = unpack().then(() => search(), (error: unknown) => {
	status.textContent = `This browser could not unpack the database, sorry (${String(error)}).`;
});
q.addEventListener('change', () => history.replaceState(null, '', q.value ? '?q=' + encodeURIComponent(q.value) : location.pathname));
