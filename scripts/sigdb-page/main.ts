import { rankName } from '../../src/util/text/name-rank';
import { button, el } from '../page-lib/dom';
import type { Spec } from './query';
import { argsOf, aboutWord, Vocabulary, WordKind, closed, completeAt, explainAt, problemsOf, globOf, isIncomplete, highlight, matchArgs, norm, parseSpec, wordsOf } from './query';
import type { Stated } from './database';
import { byId, db, Entry } from './database';
import { Hits } from './render';
import { FilterBar, FilterKind, Mix } from './filters';
import { ExportFlag } from './export-flags';

/** names and packages listed at once, and again with every click on "show more" */
const Step = 100;
/** names scanned between two breaks that let the page react to typing */
const Chunk = 40000;
/** the most names whose packages are still counted */
const Countable = 50000;
/** the most names ranked in full, the rest stay in their cheap order */
const Scored = 2000;

const q = byId<HTMLInputElement>('q'), mode = byId<HTMLSelectElement>('mode'), sort = byId<HTMLSelectElement>('sort');
const scope = byId<HTMLButtonElement>('scope'), filters = byId('filters'), status = byId('status'), hits = byId<HTMLUListElement>('hits');
const picks = [...document.querySelectorAll<HTMLButtonElement>('.pick')];

const filterBar = new FilterBar(filters, picks, () => void search());
scope.addEventListener('click', () => {
	q.value = q.value.trim().replace(/^\?/, '').replace(/^[\w.]+:::?/, '');
	void search();
});

interface Match {
	readonly entry: Entry;
	/** where the needle starts in the name, `-1` for a fuzzy hit that matched no contiguous run */
	readonly at:    number;
	/** the cheap sort key: found at the start, cased right, fuzzy, ... (lower is better) */
	readonly rank:  number;
	/** the full rank from {@link rankName}, only computed for the names that are ranked in full */
	score:          number;
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

/** every name `needle` hits, in the order of the blob; `undefined` once a newer search `run` took over */
async function scan(needle: string, run: number): Promise<Match[] | undefined> {
	const { names } = db;
	const lower = needle.toLowerCase();
	const matches: Match[] = [];
	let breathe = Chunk;
	for(let start = 0; start < names.length;) {
		if(--breathe === 0) {
			breathe = Chunk;
			await new Promise(resume => setTimeout(resume, 0));
			if(run !== pending) {
				return undefined;
			}
		}
		const tab = names.indexOf('\t', start);
		const stop = names.indexOf('\n', tab);
		const end = stop < 0 ? names.length : stop;
		const name = names.slice(start, tab);
		start = end + 1;
		const at = needle.length === 0 ? 0 : name.toLowerCase().indexOf(lower);
		if(needle.length === 0 || (mode.value === 'prefix' ? at === 0 : at >= 0)) {
			const cased = name.slice(at, at + needle.length) === needle ? 0 : 1;
			matches.push({ entry: new Entry(name, names.slice(tab + 1, end)), at, rank: (at === 0 ? 0 : 2) + cased, score: 0 });
		} else if(mode.value === 'fuzzy' && fuzzy(name.toLowerCase(), lower)) {
			matches.push({ entry: new Entry(name, names.slice(tab + 1, end)), at: -1, rank: fuzzy(name, needle) ? 4 : 5, score: 0 });
		}
	}
	return matches;
}

function score({ entry, rank }: Match, needle: string): number {
	const first = entry.shown[0];
	return rankName({
		name:      entry.name, needle, rank,
		downloads: first?.pkg.downloads ?? 0,
		baseR:     first?.pkg.base ?? false,
		base:      first?.pkg.name === 'base',
		known:     entry.known,
		s3:        first?.has(ExportFlag.S3Method) ?? false,
		variable:  first?.has(ExportFlag.Value) ?? false
	});
}

/** `matches` in order: names flowR knows first by their cheap rank, the best of them by their full one, or plainly by name */
function order(matches: Match[], needle: string): Match[] {
	if(sort.value !== 'auto') {
		const lower = (match: Match) => match.entry.name.toLowerCase();
		return matches.sort((a, b) => a.rank - b.rank || a.entry.name.length - b.entry.name.length
			|| (lower(a) < lower(b) ? -1 : lower(a) > lower(b) ? 1 : a.entry.name < b.entry.name ? -1 : 1));
	}
	/* a bucket per key keeps this linear, which matters for the half a million names an empty query hits */
	const buckets = new Map<number, Match[]>();
	for(const match of matches) {
		const key = (match.entry.known ? 0 : 1000) + match.rank;
		const bucket = buckets.get(key);
		if(bucket === undefined) {
			buckets.set(key, [match]);
		} else {
			bucket.push(match);
		}
	}
	const ordered = [...buckets.keys()].sort((a, b) => a - b).flatMap(key => buckets.get(key) ?? []);
	const scored = ordered.slice(0, Scored).sort((a, b) => a.entry.name.length - b.entry.name.length);
	for(const match of scored) {
		match.score = score(match, needle);
	}
	scored.sort((a, b) => b.score - a.score).forEach((match, at) => ordered[at] = match);
	return ordered;
}

function fitsEntry({ props, args }: Stated, spec: Spec): boolean {
	const have = wordsOf(props).map(norm);
	return spec.props.every(prop => have.includes(prop)) && (spec.args === undefined || matchArgs(spec.args, argsOf(args)));
}

function fits(entry: Entry, spec: Spec, glob: RegExp | undefined): boolean {
	if(glob?.test(entry.name) === false) {
		return false;
	}
	return (spec.args === undefined && spec.props.length === 0) || entry.stated.some(stated => fitsEntry(stated, spec));
}

/** how many packages `kept` comes from, counting only those whose own signature fits when the query asks for one */
function packagesOf(kept: readonly Match[], spec: Spec): number | undefined {
	if(kept.length === 0 || kept.length > Countable) {
		return undefined;
	}
	const signed = spec.args !== undefined || spec.props.length > 0;
	const seen = new Set(kept.flatMap(({ entry }) => signed
		? entry.stated.filter(stated => stated.pkg !== '' && fitsEntry(stated, spec)).map(stated => stated.pkg)
		: entry.owners.map(owner => owner.pkg.name)));
	return seen.size === 0 ? undefined : seen.size;
}

/** what a query asks for, once its package and signature parts are taken apart */
function parsed(text: string): { readonly spec: Spec, readonly inPackage?: string, readonly needle: string, readonly glob?: RegExp } {
	const spec = parseSpec(text.trim().replace(/^\?/, '').trim());
	const qualified = /^([\w.]+):::?(.*)$/.exec(spec.rest);
	const named = (qualified?.[2] ?? spec.rest).trim();
	const glob = spec.nameRegex ?? globOf(named);
	return { spec, inPackage: qualified?.[1], needle: glob === undefined ? named : '', glob };
}

/** whether any name flowR states a signature for would match the query, which is all that argument and property words can ask about */
function anyMatch(text: string): boolean {
	const { spec, needle, glob } = parsed(closed(text));
	const lower = needle.toLowerCase();
	return [...db.stated.keys()].some(name => name.toLowerCase().includes(lower) && fits(new Entry(name, ''), spec, glob));
}

let limit = Step;
let pending = 0;
let answered = false;
const ready = (async() => {
	status.textContent = 'Unpacking the database…';
	await db.load();
})();

function browse(pkg: string): void {
	filterBar.clear();
	q.value = pkg + '::';
	void search();
}

async function search(): Promise<void> {
	/* a query that is still being typed asks for nothing yet, so the last answer and its filters stay */
	if(answered && isIncomplete(q.value)) {
		return;
	}
	const { spec, inPackage, needle, glob } = parsed(q.value);
	const constrained = glob !== undefined || spec.args !== undefined || spec.props.length > 0;
	const run = ++pending;
	hits.replaceChildren();
	if(!db.loaded) {
		await ready;
		if(run !== pending) {
			return;   // the reader typed on while it was being read
		}
	}
	const matches = await scan(needle, run);
	if(matches === undefined) {
		return;
	}
	const ordered = order(matches, needle);
	scope.hidden = inPackage === undefined;
	if(inPackage !== undefined) {
		scope.textContent = 'in ' + inPackage;
		scope.title = 'only names ' + inPackage + ' exports; click to search every package instead';
	}
	const wanted = db.package(inPackage);
	const inScope = wanted === undefined ? ordered : ordered.filter(({ entry }) => entry.shown.some(owner => owner.pkg === wanted));
	const onlyPackages = filterBar.has(FilterKind.Only, 'package') || (needle.length === 0 && filterBar.active.size === 0 && !constrained && inPackage === undefined);
	const lower = needle.toLowerCase();
	const packages = inPackage !== undefined || ((filterBar.active.size > 0 || constrained) && !onlyPackages) ? [] : db.packages
		.map(pkg => ({ pkg, at: pkg.name.toLowerCase().indexOf(lower) }))
		.filter(({ pkg, at }) => onlyPackages ? at >= 0 : pkg.name.toLowerCase() === lower)
		.sort(sort.value === 'auto'
			? (a, b) => b.pkg.downloads - a.pkg.downloads
			: ({ pkg: a }, { pkg: b }) => a.name.length - b.name.length || (a.name < b.name ? -1 : 1));
	const shown = new Hits(hits, { needle, scoped: inPackage, roles: new Set(spec.args?.flatMap(arg => arg.roles)), props: new Set(spec.props), browse });
	for(const { pkg, at } of packages.slice(0, onlyPackages ? limit : 3)) {
		shown.package(pkg, at);
	}
	const fitting = constrained ? inScope.filter(({ entry }) => fits(entry, spec, glob)) : inScope;
	filterBar.offer(fitting.map(({ entry }) => entry));
	const kept = onlyPackages ? [] : fitting.filter(({ entry }) => filterBar.passes(entry));
	for(const { entry, at } of kept.slice(0, limit)) {
		shown.name(entry, at);
	}
	const where = inPackage === undefined ? ''
		: wanted === undefined ? ` (flowR knows no package called ${inPackage})` : ` in ${inPackage}`;
	report(onlyPackages ? packages.length : kept.length, onlyPackages ? 'package' : 'name', where, packagesOf(kept, spec));
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

/* the state of the page lives in its address, so a search can be shared and survives a reload */
const params = new URLSearchParams(location.search);
q.value = params.get('q') ?? '';
filterBar.restore((params.get('f') ?? '').split(','), params.get('how'));
for(const [select, key] of [[sort, 'sort'], [mode, 'mode']] as const) {
	const value = params.get(key);
	if(value !== null && [...select.options].some(option => option.value === value)) {
		select.value = value;
	}
}
ready.then(() => search(), (error: unknown) => {
	status.textContent = `This browser could not unpack the database, sorry (${String(error)}).`;
});
function persist(): void {
	const state: [string, string][] = [['q', q.value], ['f', [...filterBar.active].join(',')], ['how', filterBar.how === Mix.All ? '' : filterBar.how],
		['sort', sort.selectedIndex > 0 ? sort.value : ''], ['mode', mode.selectedIndex > 0 ? mode.value : '']];
	const next = new URLSearchParams(state.filter(([, value]) => value !== ''));
	history.replaceState(null, '', next.size > 0 ? '?' + next.toString() : location.pathname);
}
for(const control of [q, mode, sort]) {
	control.addEventListener('change', persist);
}
for(const control of [filters, ...picks]) {
	control.addEventListener('click', persist);
}
let timer = 0;
q.addEventListener('input', () => {
	clearTimeout(timer);
	limit = Step;   // a new question starts from the top again
	timer = window.setTimeout(() => void search(), 120);
});
mode.addEventListener('change', () => void search());
sort.addEventListener('change', () => void search());

/* completion of the argument and property words, in a list under the word being typed */
const suggest = byId('suggest');
let chosen = -1;
function pick(at: number): void {
	const rows = [...suggest.children];
	chosen = rows.length === 0 ? -1 : (at + rows.length) % rows.length;
	rows.forEach((row, i) => row.setAttribute('aria-selected', String(i === chosen)));
	rows[chosen]?.scrollIntoView({ block: 'nearest' });
}
const measure = document.createElement('canvas').getContext('2d');
/** how far into the box the text up to `at` reaches, in pixels */
function widthTo(at: number): number {
	if(measure === null) {
		return 0;
	}
	const style = getComputedStyle(q);
	measure.font = `${style.fontSize} ${style.fontFamily}`;
	return parseFloat(style.paddingLeft) + measure.measureText(q.value.slice(0, at)).width - q.scrollLeft;
}
function offer(): void {
	const found = completeAt(q.value, q.selectionStart ?? q.value.length);
	suggest.replaceChildren();
	suggest.hidden = found === undefined;
	chosen = -1;
	if(found === undefined) {
		return;
	}
	const typed = q.value.slice(found.from, found.to);
	for(const word of found.options) {
		const next = q.value.slice(0, found.from) + word + q.value.slice(found.to);
		const row = el('li');
		/* a word that would leave nothing to find is shown grayed, and can still be chosen */
		row.classList.toggle('none', !anyMatch(next));
		row.setAttribute('role', 'option');
		const label = el('span', 'label');
		label.append(el('b', undefined, word.slice(0, typed.length)), word.slice(typed.length));
		row.append(label, el('span', 'detail', aboutWord(word) ?? ''));
		/* mousedown, not click: the box keeps its focus and caret while a row is chosen */
		row.addEventListener('mousedown', event => {
			event.preventDefault();
			q.value = next;
			const caret = found.from + word.length;
			q.focus();
			q.setSelectionRange(caret, caret);
			offer();
			ask();
		});
		suggest.append(row);
	}
	suggest.style.left = `${Math.max(0, widthTo(found.from))}px`;
}
q.addEventListener('keydown', event => {
	/* a search field clears itself on escape, which would throw the query away; it only closes the list */
	if(event.key === 'Escape') {
		event.preventDefault();
		suggest.hidden = true;
	} else if(suggest.hidden) {
		return;
	} else if(event.key === 'ArrowDown' || event.key === 'ArrowUp') {
		event.preventDefault();
		pick(chosen < 0 && event.key === 'ArrowUp' ? -1 : chosen + (event.key === 'ArrowDown' ? 1 : -1));
	} else if(event.key === 'Tab' || (event.key === 'Enter' && chosen >= 0)) {
		event.preventDefault();
		suggest.children[Math.max(chosen, 0)]?.dispatchEvent(new MouseEvent('mousedown', { cancelable: true }));
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

/* the query colored by what each piece means, under the transparent text of the box */
const hl = byId('hl'), problem = byId('problem');
const QueryHint = q.title;
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
/** the piece of the colored query under the pointer says what it means */
q.addEventListener('mousemove', event => {
	if(measure === null) {
		return;
	}
	const x = event.clientX - q.getBoundingClientRect().left;
	let at = 0;
	while(at < q.value.length && widthTo(at + 1) < x) {
		at++;
	}
	q.title = (x >= widthTo(0) ? explainAt(q.value, at) : undefined) ?? QueryHint;
});

/** runs the query in the box as if typed */
function ask(): void {
	paint();
	persist();
	limit = Step;
	void search();
}

const opts = byId('opts'), optButton = byId('optbtn');
function showOptions(open: boolean): void {
	opts.hidden = !open;
	optButton.setAttribute('aria-expanded', String(open));
}
optButton.addEventListener('click', () => showOptions(Boolean(opts.hidden)));
showOptions(sort.selectedIndex > 0 || mode.selectedIndex > 0);

const helpDialog = byId<HTMLDialogElement>('helpdialog');
byId('help').addEventListener('click', () => {
	if(typeof helpDialog.showModal === 'function') {
		helpDialog.showModal();
	} else {
		helpDialog.setAttribute('open', '');
	}
});
for(const [id, kind] of [['helproles', WordKind.Role], ['helpprops', WordKind.Prop]] as const) {
	byId(id).append(...Vocabulary[kind].flatMap(({ word, about }) => [el('dt', kind, word), el('dd', undefined, about)]));
}
for(const example of document.querySelectorAll<HTMLButtonElement>('.try')) {
	example.addEventListener('click', () => {
		q.value = example.dataset.q ?? '';
		helpDialog.close();
		ask();
	});
}
