import { blank, button, el } from '../page-lib/dom';
import { argsOf, norm, shortOf, wordsOf } from './query';
import { db, Owner, type AmbientFamily, type Entry, type Guards, type Package, type RawAnswers } from './database';
import { contractFormals, spokenOf } from './contract-formals';
import { ExportFlag } from './export-flags';
import { aboutFlagNamed, aboutOf, Flags, Kinds, Origins } from './about';
import { contract as contractView, formalChip, formalMark, hueOf, light, link, originTag, originWords, related, titled, type Part } from './contract-view';
import { uniqueArray } from '../../src/util/collections/arrays';

/** a word of a signature with what it means, for its hover */
function described(word: string): string {
	const about = aboutOf(word) ?? aboutFlagNamed(word);
	return about === undefined ? word : word + ': ' + about;
}

function flagsOf(flags: string): readonly (typeof Flags)[ExportFlag][] {
	return [...flags].map(flag => Flags[flag as ExportFlag]).filter(info => info !== undefined && info.name !== '');
}


/** the properties that say how the result comes back rather than what the call does */
const Returns: readonly string[] = ['invisible'];

/** at most this many owners are linked in the row of a name */
const Shown = 3;

const search = (q: string): string => '?q=' + encodeURIComponent(q);

/** the short forms of the flag names, which the built-in configuration does not word */
const FlagShorts: ReadonlyMap<string, string> = new Map(Object.values(Flags).flatMap(({ name, short }) => short === undefined ? [] : [[name, short] as const]));

const shortWord = (word: string): string => FlagShorts.get(word) ?? shortOf(word);

function short(words: readonly string[]): string[] {
	return words.map(shortWord);
}

/** the words of all `statements`, each meaning kept once */
function mergedWords(...statements: readonly (string | undefined)[]): string {
	const seen = new Set<string>();
	return statements.flatMap(statement => wordsOf(statement ?? '')).filter(word => !seen.has(shortWord(word)) && seen.add(shortWord(word))).join('|');
}

function flagWords(flags: string): string {
	return flagsOf(flags).filter(flag => !flag.meta).map(flag => flag.name).join('|');
}

function parts(props: string): { kind: string[], returns: string[] } {
	const words = wordsOf(props);
	return { kind: words.filter(word => !Returns.includes(word)), returns: words.filter(word => Returns.includes(word)) };
}

/** An alias on `...` hands back the last argument only, which the reader is told. */
function roleWords(name: string, roles: readonly string[]): string[] {
	return short(roles).map(role => role === 'alias' && name === '...' ? 'alias (last)' : role);
}

function readable(name: string, args: string, props: string): string {
	const spelled = argsOf(args).map(([formal, roles]) => roles.length === 0 ? formal : formal + ': ' + roleWords(formal, roles).join(' + ')).join(', ');
	const { kind, returns } = parts(props);
	return name + (kind.length > 0 ? '[' + kind.join(',') + ']' : '') + (args === '' ? '' : '(' + spelled + ')')
		+ (returns.length > 0 ? ', returns ' + returns.join(' and ') : '');
}

/** `name` with the part `needle` matched marked, contiguous from `at` or, for a fuzzy hit (`at < 0`), letter by letter */
function marked(name: string, needle: string, at: number): HTMLSpanElement {
	const span = el('span', 'name');
	if(at >= 0) {
		span.append(name.slice(0, at), el('mark', undefined, name.slice(at, at + needle.length)), name.slice(at + needle.length));
		return span;
	}
	const wanted = needle.toLowerCase();
	let next = 0;
	/* runs alternate between plain and marked text, a fresh run starting whenever a letter switches sides */
	const runs: [mark: boolean, text: string][] = [];
	for(const c of name) {
		const mark = next < wanted.length && c.toLowerCase() === wanted[next];
		next += mark ? 1 : 0;
		const last = runs.at(-1);
		if(last?.[0] === mark) {
			last[1] += c;
		} else {
			runs.push([mark, c]);
		}
	}
	span.append(...runs.map(([mark, text]) => mark ? el('mark', undefined, text) : text));
	return span;
}

/** toggles `detailOf` below `row` on a click that is not on a link, and returns what opens it right away */
function opens(row: HTMLElement, detailOf: () => Node): () => void {
	const toggle = () => {
		const open = row.querySelector('.detail');
		if(open) {
			open.remove();
		} else {
			row.append(detailOf());
		}
	};
	row.addEventListener('click', event => {
		if(!(event.target as HTMLElement | null)?.closest('a')) {
			toggle();
		}
	});
	return toggle;
}

/** what a search asks for, which its hits are rendered against */
export interface Asked {
	readonly needle:  string;
	/** the package a qualified query names, whose owner a row shows first */
	readonly scoped?: string;
	/** the roles and properties the query asks for, which the signatures shown mark as what made them match */
	readonly roles:   ReadonlySet<string>;
	readonly props:   ReadonlySet<string>;
	/** lists what `pkg` exports, as the link in its detail offers */
	readonly browse:  (pkg: string) => void;
}

/** renders the hits of one search */
export class Hits {
	/** whether a hit has opened on its own already */
	private expanded = false;

	constructor(private readonly list: HTMLElement, private readonly asked: Asked) {}

	name(entry: Entry, at: number): void {
		const { name } = entry;
		const owners = entry.shown;
		const row = el('li');
		/* hovering a formal in the teaser or signature lights it up in the opened contract as well */
		row.addEventListener('mouseover', event => light(row, (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-formal]')?.dataset.formal));
		row.addEventListener('mouseout', () => light(row, undefined));
		const head = el('div', 'head');
		const named = titled(marked(name, this.asked.needle, at), 'click for every package that exports ' + name);
		head.append(named);
		/* a name only flowR itself knows has no owner at all */
		if(owners[0]?.has(ExportFlag.Value)) {
			named.classList.add('value');
			head.append(titled(el('span', 'kindtag value', 'value'), Flags[ExportFlag.Value].about));
		}
		const chosen = owners.find(owner => owner.pkg.name === this.asked.scoped) ?? owners[0];
		const own = entry.statedFor(chosen?.pkg.name);
		const guards = chosen === undefined ? undefined : entry.guardsIn(chosen.pkg.name);
		const known = entry.kinds;
		for(const kind of [...known.filter(k => k !== 'builtin'), ...known.filter(k => k === 'builtin')]) {
			head.append(titled(el('span', kind === 'builtin' ? 'kindtag flowr' : 'kindtag', Kinds[kind]?.label ?? kind), Kinds[kind]?.about));
			const words = short(wordsOf(own?.props ?? ''));
			if(kind === 'builtin' && words.length > 0 && !own) {
				head.append(titled(el('span', 'kindtag props', '+' + words.length), 'flowR states ' + words.join(', ') + ' about this call; open the entry to see which package for'));
			}
		}
		const dispatches = entry.dispatches;
		const said = dispatches.map(([system]) => system.toLowerCase() + ' method');
		const declared = entry.declaredIn(chosen?.pkg.name);
		const args = own?.args || declared || '';
		const props = wordsOf(mergedWords(own?.props, flagWords(chosen?.flags ?? ''))).filter(word => !said.includes(word.toLowerCase())).join('|');
		if(args !== '' || props !== '') {
			head.append(this.signature(name, args, props, guards));
		}
		/* an S3 method has a line of its own below */
		for(const [system, generic] of dispatches.filter(([system]) => system !== 'S3')) {
			head.append(link('generic', system + ' method for ' + generic, search(generic), 'search for the generic this method dispatches for'));
		}
		const group = entry.group;
		if(group) {
			head.append(link('generic', group + ' group', search(group), name + ' belongs to R\'s ' + group + ' group generic: a package may answer it for its own '
				+ 'class with setMethod("' + name + '", ...) or setMethod("' + group + '", ...) instead of defining a '
				+ 'function of its own. Click to search for ' + group + '.'));
		}
		const list = el('span', 'owners');
		list.append(...owners.slice(0, Shown).map(owner => packageLink(owner.pkg)));
		if(owners.length > Shown) {
			const rest = el('button', 'more', '+' + (owners.length - Shown) + ' more');
			rest.type = 'button';
			list.append(rest);
		}
		head.append(list);
		row.append(head);
		const formals = guards === undefined ? [] : contractFormals(formalsOf(args), formalsOf(declared ?? ''), guards);
		const ambient = entry.ambientIn(chosen?.pkg.name);
		/* the card names what the contract and the global state are about in one line, the opened view says what holds and what is done */
		if(guards !== undefined || ambient.length > 0) {
			row.append(teaser(name, guards, formals, ambient));
		}
		/* how it takes part in S3 dispatch is for the opened view, the card stays one line or two */
		const open = opens(row, () => {
			const contracted = guards === undefined ? undefined : contract(name, guards, formals, chosen);
			const detail = this.owners(entry, contracted, s3Line(entry), chosen?.pkg.name);
			if(ambient.length > 0) {
				const block = ambientBlock(name, ambient, (entry.statedFor(chosen?.pkg.name)?.pkg ?? '') + '::' + name);
				if(contracted === undefined) {
					detail.prepend(block);
				} else {
					contracted.after(block);
				}
			}
			return detail;
		});
		this.list.append(row);
		/* the name asked for, plain or qualified, opens right away, the first such hit only */
		if(!this.expanded && name === this.asked.needle) {
			this.expanded = true;
			open();
		}
	}

	package(pkg: Package, at: number): void {
		const row = el('li', 'pkghit');
		const head = el('div', 'head');
		const badge = el('span', 'kindtag', pkg.base ? 'base R package' : pkg.archived ? 'archived package' : 'package');
		badge.classList.toggle('gone', pkg.archived);
		const facts = el('span', 'owners', [
			pkg.version,
			pkg.downloads > 0 ? pkg.usage : null,
			pkg.exports + ' exports',
			pkg.releases > 0 ? pkg.releases + (pkg.releases === 1 ? ' release' : ' releases') : null
		].filter(Boolean).join(' · '));
		facts.title = pkg.usageTitle;
		head.append(marked(pkg.name, this.asked.needle, at), badge, facts);
		row.append(head);
		opens(row, () => this.aboutPackage(pkg));
		this.list.append(row);
	}

	/** one line per package exporting the name, with its signature there and where it is written */
	private owners(entry: Entry, contracted?: HTMLElement, s3?: HTMLElement, chosen?: string): HTMLDivElement {
		const { name } = entry;
		const list = el('div', 'owns');
		for(const owner of entry.shown) {
			const { pkg } = owner;
			const row = el('div', 'own');
			const who = blank(el('a', 'pkg', pkg.name));
			if(owner.documented(name)) {
				row.title = who.title = 'the manual page for ' + name + ' in ' + pkg.name;
				who.href = owner.manual(name);
			} else {
				row.classList.add('undocumented');
				row.title = entry.group !== undefined && !pkg.base
					? name + ' has no manual page of its own in ' + pkg.name + ': an S4 method is documented under its '
						+ name + ',<class>-method alias, so this links to the package documentation'
					: name + ' has no manual page in ' + pkg.name + ', so this links to the package documentation';
				who.href = pkg.manual();
				who.title = 'no manual page is recorded for ' + name + ' in ' + pkg.name + ', so this links to the package documentation';
			}
			const own = entry.stated.find(stated => stated.pkg === pkg.name);
			const args = own?.args || entry.declaredIn(pkg.name) || '';
			const props = mergedWords(own?.props, flagWords(owner.flags));
			const said = new Set(wordsOf(props));
			const marks = el('span', 'flags');
			marks.append(...flagsOf(owner.flags).filter(flag => !said.has(flag.name)).map(flag => titled(el('span', 'flag', flag.name), flag.about)));
			if(args !== '' || props !== '') {
				marks.append(this.signature(name, args, props, entry.guardsIn(pkg.name)));
			}
			const { file, line } = owner;
			const src = blank(file === undefined
				? link('src nofile', 'sources', owner.sourceUrl ?? '', 'the database records no file for ' + name + ' in ' + pkg.name + ', so this links to its sources')
				: link('src', file + (line === undefined ? '' : ':' + line), owner.sourceUrl ?? '', 'where ' + pkg.name + '::' + name + ' is written, in ' + pkg.name + ' ' + pkg.version));
			const version = titled(el('span', 'ver', pkg.downloads > 0 ? pkg.version + ' · ' + pkg.usage : pkg.version), pkg.usageTitle);
			row.append(who, marks, src, version, titled(el('span', 'tag', Origins[pkg.base ? 'base' : 'cran'].label), Origins[pkg.base ? 'base' : 'cran'].about), el('a', 'go', '↗'));
			row.addEventListener('click', event => {
				if(!(event.target as HTMLElement | null)?.closest('a')) {
					window.open(who.href, '_blank', 'noopener');
				}
			});
			list.append(row);
		}
		/* what to ask flowR for parameters and the call graph, for the hit's package or the package row last hovered, copied on a click */
		const ask = el('code', 'askcmd');
		const asks = (qualified: string) => {
			ask.textContent = ':query @signature ' + qualified;
			ask.title = 'for parameters and the call graph, ask flowR this; click to copy';
		};
		asks(chosen === undefined ? '* ' + name : chosen + '::' + name);
		ask.addEventListener('click', event => {
			event.stopPropagation();
			void navigator.clipboard?.writeText(ask.textContent ?? '').then(() => ask.title = 'copied');
		});
		list.addEventListener('mouseover', event => {
			const row = (event.target as HTMLElement | null)?.closest('.own');
			if(row) {
				asks((row.querySelector('.pkg')?.textContent ?? '') + '::' + name);
			}
		});
		const box = el('div', 'detail');
		/* without an S3 line the command joins the contract's header rather than taking a line of its own */
		const chead = s3 === undefined ? contracted?.querySelector('.chead') : undefined;
		if(chead) {
			chead.append(ask);
			box.append(contracted as HTMLElement, list);
		} else {
			const head = el('div', 'dhead');
			head.append(s3 ?? el('span'), ask);
			box.append(head, ...(contracted === undefined ? [] : [contracted]), list);
		}
		return box;
	}

	private aboutPackage(pkg: Package): HTMLDivElement {
		const box = el('div', 'detail');
		const facts: readonly (readonly [string, string])[] = [
			['latest version', pkg.version],
			['exported names', pkg.exports.toLocaleString('en-US')],
			['releases known', pkg.releases > 0
				? pkg.releases.toLocaleString('en-US') + (pkg.since > 0 ? ', the first in ' + pkg.since : '')
				: 'none recorded'],
			['downloads', pkg.downloads > 0 ? pkg.downloads.toLocaleString('en-US') + ' in the last month' : 'ships with R'],
			['comes from', pkg.base ? 'base R' : pkg.repository.label + (pkg.archived ? ', since archived' : '')]
		];
		for(const [label, value] of facts) {
			const line = el('p');
			line.append(el('span', 'kind', label), value);
			box.append(line);
		}
		const links = el('p', 'links');
		const home = pkg.home;
		if(home) {
			links.append(blank(link(undefined, pkg.base ? 'the R manual' : pkg.repository.label, home)));
		}
		const exports = link(undefined, 'everything it exports', search(pkg.name + '::'));
		exports.addEventListener('click', event => {
			event.preventDefault();
			this.asked.browse(pkg.name);
		});
		links.append(exports);
		box.append(links);
		return box;
	}

	/** `words` joined by `separator`, the ones the query asked for set apart */
	private marks(words: readonly string[], separator: string, asking: ReadonlySet<string>, raw: readonly string[], kind: 'role' | 'prop'): Part[] {
		return words.flatMap((word, at) => [at > 0 ? separator : '', titled(asking.has(norm(raw[at])) ? el('mark', 'want ' + kind, word) : el('span', 'word', word), described(raw[at]))]);
	}

	private signature(name: string, args: string, props: string, guards?: Guards): HTMLElement {
		const said = titled(el('code', 'stated'), readable(name, args, props));
		const { kind, returns } = parts(props);
		said.append(el('b', undefined, name));
		if(kind.length > 0) {
			const label = el('i', 'kind');
			label.append('[', ...this.marks(short(kind), ',', this.asked.props, kind, 'prop'), ']');
			said.append(label);
		}
		if(args !== '') {
			const list = el('span', 'args');
			const claimed = guards === undefined ? new Map<string, string[]>() : claimsByFormal(guards, formalsOf(args));
			/* with a contract, what it says nothing about steps back so the rest stands out */
			const spoken = guards === undefined ? undefined : new Set(spokenOf(guards, formalsOf(args)));
			list.append('(', ...argsOf(args).flatMap((arg, at) => [at > 0 ? ', ' : '', this.formal(arg, claimed.get(arg[0]), at, spoken !== undefined && spoken.size > 0 && !spoken.has(arg[0]))]), ')');
			said.append(list);
		}
		if(returns.length > 0) {
			said.append(titled(el('i', 'ret', ': ' + short(returns).join(',')), returns.map(described).join('; ')));
		}
		return said;
	}

	private formal([name, roles]: readonly [string, readonly string[]], claims?: readonly string[], at = 0, quiet = false): HTMLSpanElement {
		const part = el('span', quiet ? 'formal quiet' : 'formal', name);
		if(claims !== undefined) {
			part.classList.add('guarded', hueOf(at));
			part.title = name + ' of a call that returns normally: ' + claims.join(', ');
		}
		if(roles.length > 0) {
			const role = el('i', 'role');
			role.append(': ', ...this.marks(roleWords(name, roles), '+', this.asked.roles, roles, 'role'));
			part.append(role);
		}
		return part;
	}
}

/**
 * One line within the row: the formals the contract speaks of, where it comes from, and the parts of the global state a call
 * touches, each with what is said of it on hover; the row opens the rest.
 */
function teaser(name: string, guards: Guards | undefined, formals: readonly string[], ambient: readonly AmbientFamily[]): HTMLElement {
	const box = titled(el('div', 'teaser'), 'what a call of ' + name + ' has to fulfill to return normally and what it does to the global state, click to open');
	const line = el('div');
	if(guards !== undefined) {
		const [, , , origin = '', , , returns = []] = guards;
		const claimed = claimsByFormal(guards, formals);
		line.append(el('span', 'label', 'contract'), originTag(origin), ...spokenOf(guards, formals).map(formal => formalMark(guardedChip(el('code', hueOf(formals.indexOf(formal)), formal), formal, claimed.get(formal)), formal)),
			/* a function that always returns NULL says so right away, it is called for what it does */
			...(returns.length === 0 ? [] : returns.length === 1 && returns[0] === 'is.null(result)'
				? [titled(el('code', 'result null', '\u2192 NULL'), 'a call that returns normally always returns NULL')]
				: [titled(el('code', 'result', 'result'), 'what holds of the value a call returns normally')]));
	}
	if(ambient.length > 0) {
		const words = db.ambientWords.families;
		line.append(...guards === undefined ? [] : [el('span', 'sep', '\u00b7')], el('span', 'label', 'ambient'), ...ambient.map(([family, accesses]) => {
			const [label = family, description = ''] = words[family] ?? [];
			const done = uniqueArray(accesses.map(([, , verb]) => verb));
			/* what changes the state stands out from what only looks at it */
			const changes = accesses.some(([, access]) => !Looks.has(access));
			return titled(el('span', changes ? 'fam changes' : 'fam', label), `${description}${description === '' ? '' : ': '}${done.join(', ')}`);
		}));
	}
	box.append(line);
	return box;
}

/** what a contract says of each formal: that a call has to give it, its claims, and the relations it is part of */
function claimsByFormal(guards: Guards, formals: readonly string[]): Map<string, string[]> {
	const [, claims, , , relations = [], required = []] = guards;
	const said = new Map<string, string[]>();
	const add = (formal: string, claim: string) => said.set(formal, [...said.get(formal) ?? [], claim]);
	required.forEach(formal => add(formal, '!missing(' + formal + ')'));
	claims.forEach(([formal, words]) => words.forEach(word => add(formal, word)));
	relations.forEach(([holds, unless]) => related(holds, formals).forEach(formal => add(formal, holds + (unless === '' ? '' : ' unless ' + unless))));
	return said;
}

/** marks a chip of `formal` as one the contract speaks of, with what it says on hover */
function guardedChip<T extends HTMLElement>(node: T, formal: string, claims: readonly string[] | undefined): T {
	if(claims !== undefined && claims.length > 0) {
		node.classList.add('guarded');
		node.title = formal + ' of a call that returns normally: ' + claims.join(', ');
	}
	return node;
}

/** `(<lead> as json)`, its `json` a toggle showing what flowR returns for `key` below `target`, pretty-printed and copyable, unpacked on the first click */
function asJson(target: HTMLElement, of: keyof RawAnswers, key: string, what: string, lead = ''): HTMLElement {
	const said = el('span', 'asjson');
	said.append('(' + (lead === '' ? '' : lead + ' ') + 'as ', rawToggle(target, of, key, what), ')');
	return said;
}

/** the toggle of {@link asJson} */
function rawToggle(target: HTMLElement, of: keyof RawAnswers, key: string, what: string): HTMLButtonElement {
	return button('rawbtn', 'json', 'the raw JSON flowR returns: ' + what + '. Click to show or hide', event => {
		event.stopPropagation();
		const open = [...target.children].find(child => child.classList.contains('raw'));
		if(open !== undefined) {
			open.remove();
			return;
		}
		const box = el('div', 'raw');
		box.addEventListener('click', inside => inside.stopPropagation());
		const code = el('pre', undefined, 'unpacking ...');
		const copy = button('copy', 'copy', 'copy the JSON', () => void navigator.clipboard?.writeText(code.textContent ?? '').then(() => copy.textContent = 'copied'));
		box.append(copy, code);
		target.append(box);
		void db.raw().then(raw => {
			const value = raw[of][key];
			code.textContent = value === undefined ? 'flowR returns nothing for ' + key : JSON.stringify(value, null, 2);
		}, () => code.textContent = 'the answers could not be unpacked in this browser');
	});
}

/** the verbs that only look at the state, which step back behind the ones changing it */
const Looks: ReadonlySet<string> = new Set(['reads']);

/**
 * What a call does to the global state, a line per part: `graphics device  starts a new plot · reads graphics parameters`.
 * An access stated under conditions or for some entries reads as its label alone if it is also stated always and for all.
 */
function ambientBlock(name: string, families: readonly AmbientFamily[], key: string): HTMLElement {
	const { families: words, verbs } = db.ambientWords;
	const box = titled(el('div', 'ambient'), 'what a call of ' + name + ' does to the global state, as flowR declares it');
	families.forEach(([family, accesses], at) => {
		const [label = family, description = ''] = words[family] ?? [];
		const said = el('span', 'accesses');
		const byLabel = new Map<string, (typeof accesses)[number][]>();
		for(const access of accesses) {
			byLabel.set(access[2], [...byLabel.get(access[2]) ?? [], access]);
		}
		[...byLabel].forEach(([verb, variants], index) => {
			const [part, access] = variants[0];
			const about = (verbs[access]?.[1] ?? '') + (part === family ? '' : ' ' + (words[part]?.[1] ?? ''));
			const always = variants.some(([, , , members, when]) => members.length === 0 && when.length === 0);
			const details = always ? [] : variants.map(([, , , members, when]) => [...members, ...when].join(' '));
			said.append(...index > 0 ? [el('span', 'sep', ' · ')] : [], titled(el('span', Looks.has(access) ? 'acc looks' : 'acc changes', verb), about),
				...details.length === 0 ? [] : [el('span', 'when', ' (' + details.join('; ') + ')')]);
		});
		const line = el('div', 'aline');
		line.append(at === 0 ? el('span', 'label', 'ambient') : el('span'), titled(el('span', 'fam', label), description), said);
		if(at === 0) {
			/* only shown once the row is open, see the page's styles */
			said.append(asJson(box, 'ambient', key, 'the ambient summary flowR states for ' + key));
		}
		box.append(line);
	});
	return box;
}


/** at most this many methods are listed at a generic */
const ShownMethods = 4;

/**
 * How the name takes part in S3 dispatch: at a generic, the methods the database knows, those with a contract marked;
 * at a method, its generic, its class, and when dispatch reaches it. That is no claim about calls, as a method can be called directly.
 */
function s3Line(entry: Entry): HTMLElement | undefined {
	const { name } = entry;
	const generic = entry.dispatches.find(([system]) => system === 'S3')?.[1];
	const methods = entry.s3Methods;
	if(generic === undefined && methods.length === 0) {
		return undefined;
	}
	const line = el('div', 's3');
	if(methods.length > 0) {
		/* base R first, then by how much the packages defining them are used */
		const used = (method: Entry) => Math.max(...method.owners.map(owner => owner.pkg.base ? Infinity : owner.pkg.downloads));
		const ranked = [...methods].sort((a, b) => Number(b.contracted) - Number(a.contracted) || used(b) - used(a) || (a.name < b.name ? -1 : 1));
		line.append(titled(el('span', 'label', 'S3 methods'), 'the S3 methods of ' + name + ' the database knows, those flowR knows a contract for first, then those of base R, then by the downloads of their packages'),
			...ranked.slice(0, ShownMethods).map(method => methodLink(method, name)));
		if(ranked.length > ShownMethods) {
			line.append(link('more', '+' + (ranked.length - ShownMethods), search(name + '.'), 'search for every name starting with ' + name + '.'));
		}
	}
	if(generic !== undefined) {
		const cls = name.slice(generic.length + 1);
		line.append(...methods.length > 0 ? [el('br')] : [], titled(el('span', 'label', 'S3 method'), 'an implementation of the generic for one class'),
			' of ', link('generic', generic, search(generic), 'search for the generic ' + generic + ' and its other methods'),
			...cls === 'default' ? [titled(el('span', 'dflt', ' for the default case'), 'runs when no method fits the class of the dispatched value')] : [' for class ', el('code', 'cls', cls)]);
	}
	return line;
}

/** a method as a link to it, marked when flowR knows its contract */
function methodLink(method: Entry, generic: string): HTMLElement {
	/* the generic's name is implied, so a method reads as its class, followed by the packages defining it, all kept on one line */
	const group = el('span', 'mgroup');
	group.append(link('method', '.' + method.name.slice(generic.length + 1), search(method.name), method.name + ': S3 method of ' + generic + ' for class '
		+ method.name.slice(generic.length + 1) + (method.contracted ? '. flowR knows what a call of it has to fulfill' : '')),
	...method.contracted ? [titled(el('span', 'hascontract', '\u2713 contract'), 'flowR knows what a call of ' + method.name + ' has to fulfill: open it for the contract')] : [],
	...method.owners.slice(0, 1).map(owner => packageLink(owner.pkg, 'mpkg')), ...method.owners.length > 1 ? [el('span', 'mpkg more', '+' + (method.owners.length - 1))] : []);
	return group;
}


/** the contract of `name` as the database knows it of `owner`: where it is written, how it takes part in S3 dispatch, failures linking to their source */
function contract(name: string, guards: Guards, formals: readonly string[], owner?: Owner): HTMLElement {
	/* an inferred contract was read off the code of a given R, so its lines are those of that R's sources, not of the version the database lists */
	const rVersion = (guards[3] ?? '').split('@')[0] || undefined;
	const url = owner === undefined ? undefined : owner.pkg.sourceUrl(owner.file, owner.line, owner.pkg.base ? rVersion : undefined);
	return contractView(name, guards, formals, {
		head: box => {
			if(owner === undefined) {
				return dispatchOf(name, guards, formalChip(formals), owner);
			}
			const key = owner.pkg.name + '::' + name;
			const head = titled(el('p', 'chead'), originWords(guards[3] ?? ''));
			head.append('of ' + key + ' ' + owner.pkg.version, ...owner.file === undefined || url === undefined ? [] : [' \u00b7 implemented in ',
				blank(link('src', owner.file + (owner.line === undefined ? '' : ':' + owner.line), url, 'where ' + key + ' is written'))],
			' ', asJson(box, 'contracts', key, 'the builtIns entry of the inspect-fn-guards query for ' + key, 'result'));
			return [head, ...dispatchOf(name, guards, formalChip(formals), owner)];
		},
		search,
		located: fn => located(fn, owner),
		failing: (loc, raiser) => failingAt(loc, raiser, owner, rVersion)
	});
}

/** how a contract relates to others by S3 dispatch: a generic with the methods that have contracts as well, or a method with its generic and the other methods of that */
function dispatchOf(name: string, guards: Guards, chip: (formal: string) => HTMLElement, owner: Owner | undefined): HTMLElement[] {
	const [, , , , , , , , dispatch, methodOf] = guards;
	const listed = (methods: readonly string[], said: string): Part[] => {
		const shown = methods.filter(m => m !== (owner?.pkg.name ?? '') + '::' + name && db.guards.has(m));
		return shown.length === 0 ? [] : [said, ...shown.flatMap((m, at) => [...at > 0 ? ['; '] : [], ...located(m, owner)])];
	};
	const lines: HTMLElement[] = [];
	if(dispatch?.length === 2) {
		const line = el('p', 'chead');
		line.append('generic, dispatching on ', chip(dispatch[0]), ' (S3)', ...listed(dispatch[1], ' \u00b7 contracts also for: '));
		lines.push(line);
	}
	if(methodOf?.length === 2) {
		const [generic, cls] = methodOf;
		const line = el('p', 'chead');
		line.append('method of ', ...located(generic, owner), ' for class ', el('code', 'cls', cls), ...listed(db.guards.get(generic)?.[8]?.[1] ?? [], ' \u00b7 other methods: '));
		lines.push(line);
	}
	return lines;
}

/**
 * Where failing code is, from the `fn:line:column` of a reason, its line counted from the start of the definition of `fn`: as a line of the file
 * the database says `fn` is written in when it knows, else within `fn`. The line is counted in the closure as R prints it, which base R keeps
 * no source of, so in the file it is close to the failing code rather than at it.
 */
function failingAt(loc: string, fallback: string, home: Owner | undefined, rVersion?: string): { parts: Part[], url?: string } {
	const parts = loc.split(':');
	const [line, column] = loc === '' ? [] : parts.slice(-2).map(Number);
	const fn = loc === '' ? fallback : parts.slice(0, -2).join(':');
	const qualified = fn.indexOf('::');
	const [pkg, name] = qualified < 0 ? [home?.pkg.name, fn] : [fn.slice(0, qualified), fn.slice(qualified + 2)];
	const owner = db.ownersOf(name).split(',').map(entry => entry === '' ? undefined : Owner.parse(entry)).find(o => o?.pkg.name === pkg);
	const shown = titled(el('code', 'fn', name), pkg === undefined ? undefined : pkg + '::' + name);
	if(owner?.file === undefined) {
		return { parts: [shown, ...line === undefined ? [] : [', line ' + line + ':' + column]] };
	}
	const at = owner.line === undefined || line === undefined ? owner.line : owner.line + line - 1;
	const url = owner.pkg.sourceUrl(owner.file, at, owner.pkg.base ? rVersion : undefined);
	const text = owner.file + (at === undefined ? '' : ':' + at);
	const about = line === undefined ? 'where ' + name + ' is written' : 'line ' + line + ', column ' + column + ' of ' + name + ' as R prints it, which starts at ' + owner.file + ':' + owner.line + '; base R keeps no source, so the line in the file is close rather than exact';
	return { parts: [shown, ', ', url === undefined ? titled(el('span', 'src', text), about) : blank(link('src', text, url, about))], url };
}

/** a function by name, then where the database says it is written, linking there, `home` being the function the contract is of and where an unqualified name is looked for */
function located(fn: string, home: Owner | undefined): Part[] {
	const qualified = fn.indexOf('::');
	const [pkg, name] = qualified < 0 ? [home?.pkg.name, fn] : [fn.slice(0, qualified), fn.slice(qualified + 2)];
	const owner = db.ownersOf(name).split(',').map(entry => entry === '' ? undefined : Owner.parse(entry)).find(o => o?.pkg.name === pkg);
	const { file, line, sourceUrl } = owner ?? {};
	/* a function of a package R does not attach on startup is written with it, and hovering names the package in any case */
	const shown = titled(el('code', 'fn', pkg === undefined || (db.package(pkg)?.attached ?? false) ? name : pkg + '::' + name), pkg === undefined ? undefined : pkg + '::' + name);
	if(file === undefined) {
		return [shown];
	}
	const at = file + (line === undefined ? '' : ':' + line);
	return [shown, ', ', sourceUrl === undefined ? at : blank(link('src', at, sourceUrl, 'where ' + (pkg ?? '') + '::' + name + ' is written'))];
}

/** the names of the formals of a signature, in order */
function formalsOf(args: string): string[] {
	return argsOf(args).map(([formal]) => formal);
}


function packageLink(pkg: Package, cls = ''): HTMLAnchorElement {
	return blank(link([cls, pkg.base ? 'base' : ''].filter(c => c !== '').join(' '), pkg.name, pkg.home ?? '',
		pkg.name + ' ' + pkg.version + (pkg.base ? ' (base R, always available)' : ' (' + pkg.repository.label + ')')));
}
