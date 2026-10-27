import { blank, el } from '../page-lib/dom';
import { argsOf, norm, shortOf, wordsOf } from './query';
import type { Entry, Package } from './database';
import { ExportFlag } from './export-flags';

/** how a flag reads on the page, and what it says on hover where its name alone does not; a meta flag is about the database entry, not the function */
const Flags: Readonly<Record<ExportFlag, { readonly name: string, readonly short?: string, readonly about?: string, readonly meta?: boolean }>> = {
	[ExportFlag.CanThrow]:         { name: 'can throw' },
	[ExportFlag.S3Method]:         { name: 'S3 method', short: 's3' },
	[ExportFlag.NonDeterministic]: { name: 'non-deterministic', short: 'nondet' },
	[ExportFlag.CallsDeprecated]:  { name: 'calls something deprecated', short: 'calls depr' },
	[ExportFlag.Recursive]:        { name: 'recursive', short: 'rec' },
	[ExportFlag.CallsInternal]:    { name: 'calls internals', short: 'internal' },
	[ExportFlag.S3Owner]:          { name: 'owns an S3 class', short: 's3 class' },
	[ExportFlag.S4Owner]:          { name: 'owns an S4 class', short: 's4 class' },
	[ExportFlag.S4Method]:         { name: 'S4 method', short: 's4' },
	[ExportFlag.HigherOrder]:      { name: 'higher order', short: 'hof' },
	[ExportFlag.Deprecated]:       { name: 'deprecated', short: 'depr' },
	[ExportFlag.Value]:            { name: 'value', meta: true, about: 'the database records it as a value rather than a function' },
	[ExportFlag.NoLocation]:       { name:  'no loc', meta:  true, about: 'no location: the database records no file and line for it in this package. Usually a constant, a dataset '
		+ 'or a class object, sometimes a function nothing wrote down, like an S4 generic setGeneric builds' },
	[ExportFlag.NoDoc]:  { name: 'no docs', meta: true, about: 'no manual page for this name in this package' },
	[ExportFlag.Stated]: { name: '', meta: true }
};

function flagsOf(flags: string): readonly (typeof Flags)[ExportFlag][] {
	return [...flags].map(flag => Flags[flag as ExportFlag]).filter(info => info !== undefined && info.name !== '');
}

const KindNames: Record<string, string> = {
	library:   'can load a package', source:    'can source a file', read:      'can read a file',
	write:     'can write a file', visualize: 'can draw a plot', test:      'a test', remote:    'can use the network',
	builtin:   'flowR'
};

/** the properties that say how the result comes back rather than what the call does */
const Returns: readonly string[] = ['invisible'];

/** at most this many owners are linked in the row of a name */
const Shown = 3;

type Part = string | Node;

function link(className: string | undefined, text: string, href: string, title?: string): HTMLAnchorElement {
	const node = el('a', className, text);
	node.href = href;
	if(title !== undefined) {
		node.title = title;
	}
	return node;
}

function titled<T extends HTMLElement>(node: T, title: string | undefined): T {
	if(title) {
		node.title = title;
	}
	return node;
}

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

/** toggles `detailOf` below `row` on a click that is not on a link */
function opens(row: HTMLElement, detailOf: () => Node): void {
	row.addEventListener('click', event => {
		if((event.target as HTMLElement | null)?.closest('a')) {
			return;
		}
		const open = row.querySelector('.detail');
		if(open) {
			open.remove();
		} else {
			row.append(detailOf());
		}
	});
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
	constructor(private readonly list: HTMLElement, private readonly asked: Asked) {}

	name(entry: Entry, at: number): void {
		const { name } = entry;
		const owners = entry.shown;
		const row = el('li');
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
		const known = entry.kinds;
		for(const kind of [...known.filter(k => k !== 'builtin'), ...known.filter(k => k === 'builtin')]) {
			head.append(el('span', kind === 'builtin' ? 'kindtag flowr' : 'kindtag', KindNames[kind] ?? kind));
			const words = short(wordsOf(own?.props ?? ''));
			if(kind === 'builtin' && words.length > 0 && !own) {
				head.append(titled(el('span', 'kindtag props', '+' + words.length), 'flowR states ' + words.join(', ') + ' about this call; open the entry to see which package for'));
			}
		}
		const dispatches = entry.dispatches;
		const said = dispatches.map(([system]) => system.toLowerCase() + ' method');
		const args = own?.args || entry.declaredIn(chosen?.pkg.name) || '';
		const props = wordsOf(mergedWords(own?.props, flagWords(chosen?.flags ?? ''))).filter(word => !said.includes(word.toLowerCase())).join('|');
		if(args !== '' || props !== '') {
			head.append(this.signature(name, args, props));
		}
		for(const [system, generic] of dispatches) {
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
		opens(row, () => this.owners(entry));
		this.list.append(row);
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
	private owners(entry: Entry): HTMLDivElement {
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
				marks.append(this.signature(name, args, props));
			}
			const { file, line } = owner;
			const src = blank(file === undefined
				? link('src nofile', 'sources', owner.sourceUrl ?? '', 'the database records no file for ' + name + ' in ' + pkg.name + ', so this links to its sources')
				: link('src', file + (line === undefined ? '' : ':' + line), owner.sourceUrl ?? '', 'where ' + pkg.name + '::' + name + ' is written, in ' + pkg.name + ' ' + pkg.version));
			const version = titled(el('span', 'ver', pkg.downloads > 0 ? pkg.version + ' · ' + pkg.usage : pkg.version), pkg.usageTitle);
			row.append(who, marks, src, version, el('span', 'tag', pkg.base ? 'base R' : 'CRAN'), el('a', 'go', '↗'));
			row.addEventListener('click', event => {
				if(!(event.target as HTMLElement | null)?.closest('a')) {
					window.open(who.href, '_blank', 'noopener');
				}
			});
			list.append(row);
		}
		const command = el('span');
		const asks = (qualified: string) => command.textContent = ':query @signature ' + qualified;
		const anyPackage = '* ' + name;
		asks(anyPackage);
		list.addEventListener('mouseover', event => {
			const row = (event.target as HTMLElement | null)?.closest('.own');
			asks(row ? (row.querySelector('.pkg')?.textContent ?? '') + '::' + name : anyPackage);
		});
		list.addEventListener('mouseleave', () => asks(anyPackage));
		const note = el('p', 'ask');
		note.append(el('span', undefined, 'for parameters and the call graph, ask flowR:'), command);
		const box = el('div', 'detail');
		box.append(list, note);
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
		return words.flatMap((word, at) => [at > 0 ? separator : '', asking.has(norm(raw[at])) ? el('mark', 'want ' + kind, word) : word]);
	}

	private signature(name: string, args: string, props: string): HTMLElement {
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
			list.append('(', ...argsOf(args).flatMap((arg, at) => [at > 0 ? ', ' : '', this.formal(arg)]), ')');
			said.append(list);
		}
		if(returns.length > 0) {
			said.append(el('i', 'ret', ': ' + short(returns).join(',')));
		}
		return said;
	}

	private formal([name, roles]: readonly [string, readonly string[]]): HTMLSpanElement {
		const part = el('span', 'formal', name);
		if(roles.length > 0) {
			const role = el('i', 'role');
			role.append(': ', ...this.marks(roleWords(name, roles), '+', this.asked.roles, roles, 'role'));
			part.append(role);
		}
		return part;
	}
}

function packageLink(pkg: Package): HTMLAnchorElement {
	return blank(link(pkg.base ? 'base' : '', pkg.name, pkg.home ?? '',
		pkg.name + ' ' + pkg.version + (pkg.base ? ' (base R, always available)' : ' (' + pkg.repository.label + ')')));
}
