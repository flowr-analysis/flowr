import { rankName } from '../../src/util/text/name-rank';
import type { SigIndex } from '../sigdb-index';
import { blank, button, el } from '../page-lib/dom';
import type { Spec } from './query';
import { Words, argsOf, PropWords, RoleWords, WordInfo, closed, completeAt, explainAt, problemsOf, globOf, isIncomplete, highlight, matchArgs, norm, parseSpec, wordsOf } from './query';
import type { RRepository } from '../../src/util/r-package-urls';
import { baseManualIndexUrl, baseManualTopicUrl, cranMirrorSourceUrl, rdrrPackageUrl, rdrrTopicUrl, RRepositories, rSourceUrl } from '../../src/util/r-package-urls';

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

interface OwnerEntry {
	readonly index:  number;
	readonly flags:  readonly string[];
	readonly params: number;
	readonly topic?: string;
	readonly file?:  number;
	readonly line?:  number;
}

type EncodedStatedSignature = readonly [pkg: string, props: string, args: string];

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

function byId<T extends Element = HTMLElement>(id: string): T {
	const found = document.getElementById(id);
	if(found === null) {
		throw new Error(`the sigdb page has no element #${id}`);
	}
	return found as unknown as T;
}

function readJson<T>(id: string): T {
	return JSON.parse(byId(id).textContent ?? 'null') as T;
}

let packages: readonly PackedPackage[] = [];
let names = '';
let byName = new Map<string, number>();
let loaded = false;

async function unpack(): Promise<void> {
	const encoded = (byId('data').textContent ?? '').trim();
	const text = await inWorker(encoded).catch(() => decode(encoded));
	const between = text.indexOf('\n\n');
	const nameBlob = text.slice(0, between), packageBlob = text.slice(between + 2);
	names = nameBlob;
	packages = packageBlob.split('\n').map(line => line.split('\t') as unknown as PackedPackage);
	byName = new Map(packages.map(([name], index) => [name, index]));
	loaded = true;
}

const q = byId<HTMLInputElement>('q'), mode = byId<HTMLSelectElement>('mode');
const sort = byId<HTMLSelectElement>('sort');
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
	['kind', 'library', 'load', 'attaches a package, like library or require'],
	['prop', 'pure', 'pure', 'computes a result and nothing else: no side effects, no reads of outside state'],
	['prop', 'maybe pure', 'maybe pure', 'pure as long as the functions it calls are'],
	['prop', 'invisible', 'invisible', 'the result is returned invisibly, so it does not print at top level, like invisible(x)'],
	['prop', 'changes scope', 'changes scope', 'defines or removes variables in an environment, like assign'],
	['prop', 'ambient state', 'ambient state', 'reads state outside its arguments, like options or the working directory'],
	['arg', 'alias', 'alias arg', 'an argument is handed back as the result, like x in identity(x)'],
	['arg', 'forced', 'forced arg', 'an argument is evaluated whenever the call happens, like x in force(x)'],
	['arg', 'value', 'value arg', 'an argument contributes its value to the result, like x in sum(x)'],
	['arg', 'written', 'written arg', 'an argument names something the call may modify, like envir in assign'],
	['arg', 'callee', 'callee arg', 'an argument is called as a function, like FUN in lapply'],
	['arg', 'presence', 'presence arg', 'only whether an argument was supplied matters, like in missing()']
];
const active = new Set<string>();
const filters = byId('filters');
const scope = byId<HTMLButtonElement>('scope');
scope.addEventListener('click', () => {
	q.value = q.value.trim().replace(/^\?/, '').replace(/^[\w.]+:::?/, '');
	void search();
});
const picks = [...document.querySelectorAll<HTMLButtonElement>('.pick')];
let how = 'all';
const buttons = new Map<string, HTMLButtonElement>();
const Groups: Record<string, readonly [title: string, about: string]> = {
	traits: ['traits', 'what the name is: a method, deprecated, a reader, a writer, ...'],
	prop:   ['function', 'what the call as a whole does or returns'],
	arg:    ['arguments', 'what the call does with its arguments']
};
const groupOf = (what: string): string => what === 'prop' || what === 'arg' ? what : 'traits';
const groupBoxes = new Map(Object.entries(Groups).map(([group, [title, about]]) => {
	const box = el('span', 'group');
	const heading = button('groupbtn', title, about, () => setOpen(box, box.dataset.open !== 'true'));
	box.append(heading);
	filters.append(box);
	return [group, box] as const;
}));
function setOpen(box: HTMLElement, open: boolean): void {
	box.dataset.open = String(open);
	box.firstElementChild?.setAttribute('aria-expanded', String(open));
	for(const chip of [...box.children].slice(1)) {
		(chip as HTMLElement).hidden = !open;
	}
}
for(const [what, key, label, about] of Filters) {
	const id = what + ':' + key;
	const filter = button(undefined, label, about + '. Click to filter by it, click again to drop it', () => {
		void (active.delete(id) || active.add(id));
		filter.setAttribute('aria-pressed', String(active.has(id)));
		void search();
	});
	filter.setAttribute('aria-pressed', 'false');
	buttons.set(id, filter);
	groupBoxes.get(groupOf(what))?.append(filter);
	filter.hidden = true;
}
function openGroups(): void {
	for(const [what, box] of groupBoxes) {
		if([...active].some(id => groupOf(id.split(':')[0]) === what)) {
			setOpen(box, true);
		}
	}
}
for(const pick of picks) {
	pick.addEventListener('click', () => {
		how = pick.dataset.mix ?? 'all';
		picks.forEach(other => other.setAttribute('aria-pressed', String(other === pick)));
		void search();
	});
}

function clearFilters(): void {
	active.clear();
	for(const button of buttons.values()) {
		button.setAttribute('aria-pressed', 'false');
	}
}

function holds(id: string, name: string, owners: readonly string[]): boolean {
	const [what, key] = id.split(':');
	if(what === 'only') {
		return false;   // it selects what is listed, not which names qualify
	}
	if(what === 'name') {
		return groups.has(name);
	}
	if(what === 'pkg') {
		return owners.some(entry => packages[owner(entry).index]?.[7] === '1');
	}
	if(what === 'prop') {
		return (stated.get(name) ?? []).some(([, props]) => wordsOf(props).includes(key));
	}
	if(what === 'arg') {
		return (stated.get(name) ?? []).some(([, , args]) => argsOf(args).some(([, roles]) => roles.includes(key)));
	}
	return what === 'kind'
		? (kinds.get(name) ?? []).includes(key)
		: owners.some(entry => owner(entry).flags.includes(key));
}

function passes(name: string, owners: readonly string[]): boolean {
	if(active.size === 0) {
		return true;
	}
	const matched = [...active].filter(id => holds(id, name, owners)).length;
	return how === 'any' ? matched > 0 : how === 'none' ? matched === 0 : matched === active.size;
}

function offerFilters(matches: readonly Match[]): void {
	for(const [id, button] of buttons) {
		const would = id.startsWith('only:') || how === 'none' || matches.some(match => holds(id, match.name, match.owners.split(',')));
		button.disabled = !would && !active.has(id);
	}
}
const status = byId('status'), hits = byId<HTMLUListElement>('hits');
const Step = 100;
let limit = Step;

async function decode(encoded: string): Promise<string> {
	const raw = Uint8Array.from(atob(encoded), c => c.charCodeAt(0));
	return new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
}

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
			reject(new Error(error.message));
			worker.terminate();
			URL.revokeObjectURL(url);
		};
		worker.postMessage(encoded);
	});
}

function documented(name: string, flags: readonly string[], index: number): boolean {
	if(flags.includes('u')) {
		return false;
	}
	const pkg = packages[index]?.[0] ?? '';
	const page = topics.get(pkg + '::' + name) || name;
	if(!/^[A-Za-z.][A-Za-z0-9._-]*$/.test(page)) {
		return false;
	}
	if(packages[index]?.[2] === '1') {
		return !topicsKnown || topics.has(pkg + '::' + name);
	}
	return !flags.includes('?');
}

function sourceFile(index: number, file: number | undefined): string | undefined {
	return file === undefined ? undefined : (packages[index]?.[8] ?? '').split('|')[file] || undefined;
}

function sourceUrl(pkg: string, version: string | undefined, base: boolean, file: string | undefined, line: number | undefined, repository: RRepository | undefined): string | undefined {
	if(base) {
		return rSourceUrl(pkg, version, file, line);
	}
	if(repository !== undefined && repository !== RRepositories['cran']) {
		return repository.home(pkg);
	}
	return cranMirrorSourceUrl(pkg, version, file, line);
}

function repositoryOf(index: number): RRepository {
	const row = packages[index];
	if(row?.[2] === '1') {
		return { label: 'base R', home: baseManualIndexUrl };
	}
	const source = row?.[9] ?? '';
	const stated = source.toLowerCase();
	return RRepositories[stated] ?? (stated === '' ? RRepositories['cran'] : { label: source, home: () => undefined });
}

function packageDocUrl(index: number): string {
	const [pkg, , base] = packages[index];
	return base === '1' ? baseManualIndexUrl(pkg) : rdrrPackageUrl(pkg);
}

function docUrl(name: string, entry: { readonly index: number, readonly topic?: string }): string {
	const { index, topic } = entry;
	const [pkg, , base] = packages[index];
	const page = topic || topics.get(pkg + '::' + name) || name;
	return base === '1' ? baseManualTopicUrl(pkg, page) : rdrrTopicUrl(pkg, page);
}

function marked(name: string, needle: string, at: number): HTMLSpanElement {
	const span = el('span', 'name');
	if(at < 0) {
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
		variable:  first.flags.includes('c')
	});
}

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

const FlagNames: Record<string, string> = {
	t:   'can throw', '3': 'S3 method', n:   'non-deterministic', d:   'calls something deprecated',
	r:   'recursive', i:   'calls internals', o:   'owns an S3 class', '4': 'owns an S4 class',
	m:   'S4 method', h:   'higher order', x:   'deprecated', c:   'value', v:   'no loc', u:   'no docs'
};

const MetaFlags: readonly string[] = ['c', 'v', 'u'];

const FlagAbout: Record<string, string> = {
	c: 'the database records it as a value rather than a function',
	v: 'no location: the database records no file and line for it in this package. Usually a constant, a dataset '
		+ 'or a class object, sometimes a function nothing wrote down, like an S4 generic setGeneric builds',
	u: 'no manual page for this name in this package'
};

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

const kinds: SigIndex['kinds'] = new Map(Object.entries(readJson<Record<string, string[]>>('kinds')));
const stated = new Map(Object.entries(readJson<Record<string, readonly EncodedStatedSignature[]>>('stated')));
const topics: SigIndex['topics'] = new Map(Object.entries(readJson<Record<string, string>>('topics')));
const generics: SigIndex['generics'] = new Set(readJson<string>('generics').split('\n').filter(Boolean));
const topicsKnown = readJson<boolean>('topics-complete');
const formals: SigIndex['formals'] = new Map(Object.entries(readJson<Record<string, [pkg: string, params: string][]>>('formals')));
const groups: SigIndex['groups'] = new Map(Object.entries(readJson<Record<string, string>>('groups')));
const KindNames: Record<string, string> = {
	library:   'can load a package', source:    'can source a file', read:      'can read a file',
	write:     'can write a file', visualize: 'can draw a plot', test:      'a test', remote:    'can use the network',
	builtin:   'flowR'
};

function downloadsTitle(downloads: string): string {
	return Number(downloads) > 0
		? Number(downloads).toLocaleString('en-US') + ' CRAN downloads in the last month'
		: 'ships with R, so CRAN counts nothing';
}

function count(downloads: string): string {
	const n = Number(downloads);
	return (n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? Math.round(n / 1e3) + 'k' : String(n)) + '/month';
}

function ownerLink(index: number): HTMLAnchorElement {
	const [name, version, base] = packages[index];
	const link = blank(el('a', base === '1' ? 'base' : '', name));
	const repository = repositoryOf(index);
	link.title = name + ' ' + version + (base === '1' ? ' (base R, always available)' : ' (' + repository.label + ')');
	link.href = (base === '1' ? baseManualIndexUrl(name) : repository.home(name)) ?? '';
	return link;
}

const Shown = 3;

function opens(row: HTMLElement, detailOf: () => Node): void {
	row.addEventListener('click', event => {
		if((event.target as HTMLElement | null)?.closest('a')) {
			return;   // a link is a link, not a toggle
		}
		const open = row.querySelector('.detail');
		if(open) {
			open.remove();
		} else {
			row.append(detailOf());
		}
	});
}

function detail(name: string, owners: readonly string[]): HTMLDivElement {
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
		const who = blank(el('a', 'pkg', pkg));
		if(documented(name, flags, index)) {
			row.title = who.title = 'the manual page for ' + name + ' in ' + pkg;
			who.href = docUrl(name, { index, topic });
		} else {
			row.classList.add('undocumented');
			row.title = groups.has(name) && base !== '1'
				? name + ' has no manual page of its own in ' + pkg + ': an S4 method is documented under its '
					+ name + ',<class>-method alias, so this links to the package documentation'
				: name + ' has no manual page in ' + pkg + ', so this links to the package documentation';
			who.href = packageDocUrl(index);
			who.title = 'no manual page is recorded for ' + name + ' in ' + pkg + ', so this links to the package documentation';
		}
		row.append(who);
		const marks = el('span', 'flags');
		const own = statedFor.get(pkg);
		const here = {
			args:  own?.[2] || declaredIn(name, pkg) || '',
			props: mergedWords(own?.[1], flagWords(flags))
		};
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
		ver.title = downloadsTitle(downloads);
		const tag = el('span', 'tag', base === '1' ? 'base R' : 'CRAN');
		if(here.args !== '' || here.props !== '') {
			marks.append(signature(name, here.args, here.props));
		}
		const go = el('a', 'go', '↗');
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
		row.addEventListener('click', event => {
			if(!(event.target as HTMLElement | null)?.closest('a')) {
				window.open(who.href, '_blank', 'noopener');
			}
		});
		list.append(row);
	}
	const note = el('p', 'ask');
	const command = document.createElement('span');
	const asks = (qualified: string) => command.textContent = ':query @signature ' + qualified;
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

function genericOf(name: string, owners: readonly string[]): string | undefined {
	if(!owners.some(entry => owner(entry).flags.includes('3'))) {
		return undefined;
	}
	let found: string | undefined;
	for(let at = name.indexOf('.'); at > 0; at = name.indexOf('.', at + 1)) {
		if(generics.has(name.slice(0, at))) {
			found = name.slice(0, at);
		}
	}
	return found;
}

function s4GenericOf(name: string, owners: readonly string[]): string | undefined {
	if(!owners.some(entry => owner(entry).flags.includes('m'))) {
		return undefined;
	}
	const at = name.indexOf(',');
	return at > 0 ? name.slice(0, at) : undefined;
}

function showPackage(index: number, needle: string, at: number): void {
	const [name, version, base, downloads, exports, releases, , archived] = packages[index];
	const row = el('li', 'pkghit');
	const head = el('div', 'head');
	const title = marked(name, needle, at);
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
	facts.title = downloadsTitle(downloads);
	head.append(title, badge, facts);
	row.append(head);
	opens(row, () => aboutPackage(index));
	hits.append(row);
}

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
		const line = el('p');
		line.append(el('span', 'kind', label), value);
		box.append(line);
	}
	const links = el('p', 'links');
	const repository = repositoryOf(index);
	const where: readonly [string | undefined, string] = base === '1'
		? [baseManualIndexUrl(name), 'the R manual']
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

function withStatedOwner(name: string, owners: readonly string[]): readonly string[] {
	const known = owners.filter(entry => entry !== '');
	const mine = stated.get(name) ?? [];
	if(mine.length === 0) {
		return known;
	}
	const already = new Set(known.map(entry => packages[owner(entry).index]?.[0]));
	const missing = mine.map(entry => entry[0]).filter(pkg => pkg !== '' && !already.has(pkg));
	const found = missing.map(pkg => packages.findIndex(entry => entry[0] === pkg)).filter(at => at >= 0);
	return found.length === 0 ? known : [...found.map(at => at + ':?'), ...known];
}

const Returns: readonly string[] = ['invisible'];

function short(words: readonly string[]): string[] {
	return words.map(word => Words[word] ?? word);
}

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

function parts(props: string): { kind: string[], returns: string[] } {
	const words = wordsOf(props);
	return { kind: words.filter(word => !Returns.includes(word)), returns: words.filter(word => Returns.includes(word)) };
}

/** An alias on `...` hands back the last argument only, which the reader is told. */
function roleWords(name: string, roles: readonly string[]): string[] {
	return short(roles).map(role => role === 'alias' && name === '...' ? 'alias (last)' : role);
}

/** the roles and properties the query asks for, which the signatures shown mark as what made them match */
let asked: { readonly roles: ReadonlySet<string>, readonly props: ReadonlySet<string> } = { roles: new Set(), props: new Set() };

/** `words` joined by `separator`, the ones the query asked for set apart */
function marks(words: readonly string[], separator: string, asking: ReadonlySet<string>, raw: readonly string[], kind: 'role' | 'prop'): (string | HTMLElement)[] {
	return words.flatMap((word, at) => [at > 0 ? separator : '', asking.has(norm(raw[at])) ? el('mark', 'want ' + kind, word) : word]);
}

function formal([name, roles]: readonly [string, readonly string[]]): HTMLSpanElement {
	const part = el('span', 'formal');
	part.append(name);
	if(roles.length > 0) {
		part.append(el('i', 'role'));
		part.lastElementChild?.append(': ', ...marks(roleWords(name, roles), '+', asked.roles, roles, 'role'));
	}
	return part;
}

function readable(name: string, args: string, props: string): string {
	const spelled = argsOf(args).map(([formalName, roles]) => roles.length === 0 ? formalName : formalName + ': ' + roleWords(formalName, roles).join(' + ')).join(', ');
	const { kind, returns } = parts(props);
	return name + (kind.length > 0 ? '[' + kind.join(',') + ']' : '') + (args === '' ? '' : '(' + spelled + ')')
		+ (returns.length > 0 ? ', returns ' + returns.join(' and ') : '');
}

function signature(name: string, args: string, props: string): HTMLElement {
	const said = el('code', 'stated');
	const { kind, returns } = parts(props);
	said.append(el('b', undefined, name));
	if(kind.length > 0) {
		const label = el('i', 'kind');
		label.append('[', ...marks(short(kind), ',', asked.props, kind, 'prop'), ']');
		said.append(label);
	}
	if(args !== '') {
		const list = el('span', 'args');
		list.append('(');
		argsOf(args).forEach((arg, at) => list.append(at > 0 ? ', ' : '', formal(arg)));
		list.append(')');
		said.append(list);
	}
	if(returns.length > 0) {
		said.append(el('i', 'ret', ': ' + short(returns).join(',')));
	}
	said.title = readable(name, args, props);
	return said;
}

function flagWords(flags: readonly string[]): string {
	return flags.filter(flag => !MetaFlags.includes(flag)).map(flag => FlagNames[flag]).filter(Boolean).join('|');
}

function declaredIn(name: string, pkg: string | undefined): string | undefined {
	return (formals.get(name) ?? []).find(entry => entry[0] === pkg)?.[1];
}

let scoped: string | undefined;

function show(name: string, needle: string, at: number, owners: readonly string[]): void {
	const row = el('li');
	const head = el('div', 'head');
	const value = owner(owners[0]).flags.includes('c');
	const named = marked(name, needle, at);
	named.title = 'click for every package that exports ' + name;
	head.append(named);
	if(value) {
		(head.firstChild as HTMLElement).classList.add('value');
		const badge = el('span', 'kindtag value', 'value');
		badge.title = 'the database records it as a value rather than a function';
		head.append(badge);
	}
	const mine = stated.get(name) ?? [];
	const chosen = owners.find(entry => packages[owner(entry).index]?.[0] === scoped) ?? owners[0];
	const first = packages[owner(chosen).index];
	const own = mine.find(entry => entry[0] === first?.[0]) ?? mine.find(entry => entry[0] === 'base') ?? mine[0];
	const words = short(wordsOf(own?.[1] ?? ''));
	const known = kinds.get(name) ?? [];
	for(const kind of [...known.filter(k => k !== 'builtin'), ...known.filter(k => k === 'builtin')]) {
		head.append(el('span', kind === 'builtin' ? 'kindtag flowr' : 'kindtag', KindNames[kind] ?? kind));
		if(kind === 'builtin' && words.length > 0 && !own) {
			const more = el('span', 'kindtag props', '+' + words.length);
			more.title = 'flowR states ' + words.join(', ') + ' about this call; open the entry to see which package for';
			head.append(more);
		}
	}
	const dispatches = (
		[['S3', genericOf(name, owners)], ['S4', s4GenericOf(name, owners)]] as readonly (readonly [string, string | undefined])[]
	).filter((entry): entry is readonly [string, string] => entry[1] !== undefined);
	const said = dispatches.map(([kind]) => kind.toLowerCase() + ' method');
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
	opens(row, () => detail(name, owners));
	hits.append(row);
}

const Chunk = 40000;
const Countable = 50000;

function fitsEntry([, props, args]: EncodedStatedSignature, spec: Spec): boolean {
	const have = wordsOf(props).map(norm);
	return spec.props.every(prop => have.includes(prop)) && (spec.args === undefined || matchArgs(spec.args, argsOf(args)));
}

function fits(name: string, spec: Spec, glob: RegExp | undefined): boolean {
	if(glob?.test(name) === false) {
		return false;
	}
	return (spec.args === undefined && spec.props.length === 0) || (stated.get(name) ?? []).some(entry => fitsEntry(entry, spec));
}

/** whether any name flowR states a signature for would match the query, which is all that argument and property words can ask about */
function anyMatch(text: string): boolean {
	const spec = parseSpec(closed(text).trim().replace(/^\?/, '').trim());
	const named = (/^([\w.]+):::?(.*)$/.exec(spec.rest)?.[2] ?? spec.rest).trim();
	const glob = spec.nameRegex ?? globOf(named);
	const needle = glob === undefined ? named.toLowerCase() : '';
	for(const name of stated.keys()) {
		if((needle === '' || name.toLowerCase().includes(needle)) && fits(name, spec, glob)) {
			return true;
		}
	}
	return false;
}

let pending = 0;
let answered = false;
async function search(): Promise<void> {
	/* a query that is still being typed asks for nothing yet, so the last answer and its filters stay */
	if(answered && isIncomplete(q.value)) {
		return;
	}
	const spec = parseSpec(q.value.trim().replace(/^\?/, '').trim());
	const typed = spec.rest;
	asked = { roles: new Set(spec.args?.flatMap(arg => arg.roles)), props: new Set(spec.props) };
	const qualified = /^([\w.]+):::?(.*)$/.exec(typed);
	const inPackage = qualified?.[1];
	scoped = inPackage;
	const named = (qualified?.[2] ?? typed).trim();
	const glob = spec.nameRegex ?? globOf(named);
	const needle = glob === undefined ? named : '';
	const constrained = glob !== undefined || spec.args !== undefined || spec.props.length > 0;
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
			const cased = name.slice(at, at + needle.length) === needle ? 0 : 1;
			matches.push({ name, at, owners, rank: (at === 0 ? 0 : 2) + cased, score: 0 });
		} else if(mode.value === 'fuzzy' && fuzzy(name.toLowerCase(), lower)) {
			matches.push({ name, at: -1, owners, rank: fuzzy(name, needle) ? 4 : 5, score: 0 });
		}
	}
	if(sort.value === 'auto') {
		const key = (name: string, rank: number) => (kinds.has(name) ? 0 : 1000) + rank;
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
	scope.hidden = inPackage === undefined;
	if(inPackage !== undefined) {
		scope.textContent = 'in ' + inPackage;
		scope.title = 'only names ' + inPackage + ' exports; click to search every package instead';
	}
	const wanted = inPackage === undefined ? undefined : byName.get(inPackage);
	const inScope = wanted === undefined ? matches
		: matches.filter(match => withStatedOwner(match.name, match.owners.split(',')).some(entry => owner(entry).index === wanted));
	const onlyPackages = active.has('only:package') || (needle.length === 0 && active.size === 0 && !constrained && inPackage === undefined);
	type PackageHit = readonly [name: string, index: number, at: number];
	const allPackages: readonly PackageHit[] = inPackage !== undefined || ((active.size > 0 || constrained) && !onlyPackages) ? [] : packages
		.map((row, index): PackageHit => [row[0], index, row[0].toLowerCase().indexOf(lower)])
		.filter(([name, , at]) => onlyPackages ? at >= 0 : name.toLowerCase() === lower)
		.sort(sort.value === 'auto'
			? ([, a], [, b]) => Number(packages[b][3]) - Number(packages[a][3])
			: ([a], [b]) => a.length - b.length || (a < b ? -1 : 1));
	const asPackage = allPackages.slice(0, onlyPackages ? limit : 3);
	for(const [, index, at] of asPackage) {
		showPackage(index, needle, at);
	}
	const fitting = constrained ? inScope.filter(match => fits(match.name, spec, glob)) : inScope;
	offerFilters(fitting);
	const kept = onlyPackages ? [] : fitting.filter(match => passes(match.name, match.owners.split(',')));
	const found = kept.length;
	let inPackages: number | undefined;
	if(found > 0 && found <= Countable) {
		const seen = new Set<string>();
		for(const match of kept) {
			if(spec.args !== undefined || spec.props.length > 0) {
				/* a signature is stated per package, so only the packages whose own signature fits count */
				(stated.get(match.name) ?? []).filter(entry => entry[0] !== '' && fitsEntry(entry, spec)).forEach(entry => seen.add(entry[0]));
				continue;
			}
			for(const entry of match.owners.split(',')) {
				const colon = entry.indexOf(':');
				seen.add(colon < 0 ? entry : entry.slice(0, colon));
			}
		}
		inPackages = seen.size === 0 ? undefined : seen.size;
	}
	for(const match of kept.slice(0, limit)) {
		show(match.name, needle, match.at, withStatedOwner(match.name, match.owners.split(',')));
	}
	const where = inPackage === undefined ? ''
		: wanted === undefined ? ` (flowR knows no package called ${inPackage})` : ` in ${inPackage}`;
	report(onlyPackages ? allPackages.length : found, onlyPackages ? 'package' : 'name', where, inPackages);
	answered = true;
}

function report(total: number, what: string, where: string, inPackages: number | undefined): void {
	const shown = hits.children.length;
	if(total === 0) {
		status.textContent = `Nothing here goes by that name${where}.`;
		return;
	}
	const countLabel = inPackages === undefined ? undefined
		: `${inPackages.toLocaleString('en-US')} package${inPackages === 1 ? '' : 's'}`;
	const from = countLabel === undefined ? '' : where.length > 0 ? ` (also in ${countLabel})` : ` in ${countLabel}`;
	status.textContent = `${total.toLocaleString('en-US')} ${what}${total === 1 ? '' : 's'}${where}${from}`
		+ (shown < total ? ` · showing ${shown.toLocaleString('en-US')}` : '');
	if(shown < total) {
		hits.append(button('more-hits', `show ${Math.min(Step, total - shown)} more`, '', () => {
			limit += Step;
			void search();
		}));
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

const params = new URLSearchParams(location.search);
q.value = params.get('q') ?? '';
for(const id of (params.get('f') ?? '').split(',')) {
	buttons.get(id)?.setAttribute('aria-pressed', String(active.add(id).has(id)));
}
openGroups();
const wantedHow = params.get('how');
if(picks.some(p => p.dataset.mix === wantedHow)) {
	how = wantedHow as string;
	picks.forEach(p => p.setAttribute('aria-pressed', String(p.dataset.mix === how)));
}
for(const [select, key] of [[sort, 'sort'], [mode, 'mode']] as const) {
	const value = params.get(key);
	if(value !== null && [...select.options].some(o => o.value === value)) {
		select.value = value;
	}
}
status.textContent = 'Unpacking the database…';
const ready = unpack().then(() => search(), (error: unknown) => {
	status.textContent = `This browser could not unpack the database, sorry (${String(error)}).`;
});
function persist(): void {
	const next = new URLSearchParams();
	const state: [string, string][] = [['q', q.value], ['f', [...active].join(',')], ['how', how === 'all' ? '' : how], ['sort', sort.selectedIndex > 0 ? sort.value : ''], ['mode', mode.selectedIndex > 0 ? mode.value : '']];
	for(const [key, value] of state.filter(([, value]) => value !== '')) {
		next.set(key, value);
	}
	history.replaceState(null, '', next.size > 0 ? '?' + next.toString() : location.pathname);
}
for(const control of [q, mode, sort]) {
	control.addEventListener('change', persist);
}
for(const control of [filters, ...picks]) {
	control.addEventListener('click', persist);
}

const suggest = byId('suggest'), helpDialog = byId<HTMLDialogElement>('helpdialog');
byId('help').addEventListener('click', () => {
	if(typeof helpDialog.showModal === 'function') {
		helpDialog.showModal();
	} else {
		helpDialog.setAttribute('open', '');
	}
});
let chosen = -1;
function take(row: Element | undefined): void {
	(row as HTMLElement | undefined)?.dispatchEvent(new MouseEvent('mousedown', { cancelable: true }));
}
function pick(at: number): void {
	const rows = [...suggest.children];
	chosen = rows.length === 0 ? -1 : (at + rows.length) % rows.length;
	rows.forEach((row, i) => row.setAttribute('aria-selected', String(i === chosen)));
	rows[chosen]?.scrollIntoView({ block: 'nearest' });
}
const measure = document.createElement('canvas').getContext('2d');
/** where the word being completed starts in the box, so the list opens under it like an editor's does */
function leftOf(at: number): number {
	const style = getComputedStyle(q);
	if(measure === null) {
		return 0;
	}
	measure.font = `${style.fontSize} ${style.fontFamily}`;
	return Math.max(0, parseFloat(style.paddingLeft) + measure.measureText(q.value.slice(0, at)).width - q.scrollLeft);
}
function offer(): void {
	const found = completeAt(q.value, q.selectionStart ?? q.value.length);
	suggest.replaceChildren();
	suggest.hidden = found === undefined;
	if(found === undefined) {
		chosen = -1;
		return;
	}
	const typed = q.value.slice(found.from, found.to);
	for(const word of found.options) {
		const row = el('li', undefined);
		const next = q.value.slice(0, found.from) + word + q.value.slice(found.to);
		/* a word that would leave nothing to find is shown grayed, and can still be chosen */
		row.classList.toggle('none', !anyMatch(next));
		row.setAttribute('role', 'option');
		const label = el('span', 'label');
		label.append(el('b', undefined, word.slice(0, typed.length)), word.slice(typed.length));
		row.append(label, el('span', 'detail', WordInfo[word] ?? ''));
		/* mousedown, not click: the box keeps its focus and caret while a row is chosen */
		row.addEventListener('mousedown', event => {
			event.preventDefault();
			q.value = q.value.slice(0, found.from) + word + q.value.slice(found.to);
			const caret = found.from + word.length;
			q.focus();
			q.setSelectionRange(caret, caret);
			offer();
			paint();
			persist();
			void search();
		});
		suggest.append(row);
	}
	suggest.style.left = `${leftOf(found.from)}px`;
	chosen = -1;
}
q.addEventListener('keydown', event => {
	/* a search field clears itself on escape, which would throw the query away; it only closes the list */
	if(event.key === 'Escape') {
		event.preventDefault();
		suggest.hidden = true;
		return;
	}
	if(suggest.hidden) {
		return;
	}
	if(event.key === 'ArrowDown' || event.key === 'ArrowUp') {
		event.preventDefault();
		pick(chosen < 0 && event.key === 'ArrowUp' ? -1 : chosen + (event.key === 'ArrowDown' ? 1 : -1));
	} else if(event.key === 'Tab' || (event.key === 'Enter' && chosen >= 0)) {
		event.preventDefault();
		take(suggest.children[Math.max(chosen, 0)]);
	}
});
for(const type of ['input', 'click']) {
	q.addEventListener(type, offer);
}
q.addEventListener('keyup', event => {
	if(!['ArrowDown', 'ArrowUp', 'Enter', 'Tab', 'Escape'].includes(event.key)) {
		offer();
	}
});
q.addEventListener('blur', () => window.setTimeout(() => void (suggest.hidden = true), 150));

const hl = byId('hl');
const QueryHint = q.title;
const problem = byId('problem');
function paint(): void {
	const found = problemsOf(q.value);
	problem.hidden = found.length === 0;
	problem.textContent = found.length === 0 ? '' : found.join(' · ') + (answered ? ' (showing the last answer)' : '');
	const pieces = highlight(q.value);
	const colored = pieces.some(([, kind]) => kind !== 'plain');
	q.parentElement?.classList.toggle('colored', colored);
	hl.replaceChildren(...(colored ? pieces.map(([text, kind]) => el('span', kind, text)) : []));
	hl.scrollLeft = q.scrollLeft;
}
for(const type of ['input', 'scroll', 'keyup', 'click', 'focus']) {
	q.addEventListener(type, paint);
}
paint();

const opts = byId('opts'), optButton = byId('optbtn');
function showOptions(open: boolean): void {
	opts.hidden = !open;
	optButton.setAttribute('aria-expanded', String(open));
}
optButton.addEventListener('click', () => showOptions(opts.hidden));
showOptions(sort.selectedIndex > 0 || mode.selectedIndex > 0);

/** the character under the pointer, so a piece of the colored query can say what it means */
q.addEventListener('mousemove', event => {
	const style = getComputedStyle(q);
	if(measure === null) {
		return;
	}
	measure.font = `${style.fontSize} ${style.fontFamily}`;
	const x = event.clientX - q.getBoundingClientRect().left - parseFloat(style.paddingLeft) + q.scrollLeft;
	let at = 0;
	while(at < q.value.length && measure.measureText(q.value.slice(0, at + 1)).width < x) {
		at++;
	}
	q.title = (x >= 0 ? explainAt(q.value, at) : undefined) ?? QueryHint;
});

for(const [id, words, kind] of [['helproles', RoleWords, 'role'], ['helpprops', PropWords, 'prop']] as const) {
	byId(id).append(...words.flatMap(word => [el('dt', kind, word), el('dd', undefined, WordInfo[word] ?? '')]));
}
for(const example of document.querySelectorAll<HTMLButtonElement>('.try')) {
	example.addEventListener('click', () => {
		q.value = example.dataset.q ?? '';
		helpDialog.close();
		paint();
		persist();
		limit = Step;
		void search();
	});
}
