import { blank, el } from '../page-lib/dom';
import { argsOf, norm, shortOf, wordsOf } from './query';
import type { Entry, Guards, Owner, Package } from './database';
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
		const guards = chosen === undefined ? undefined : entry.guardsIn(chosen.pkg.name);
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
			head.append(this.signature(name, args, props, guards));
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
		if(guards !== undefined) {
			row.append(teaser(name, guards, formalsOf(args)));
		}
		opens(row, () => this.owners(entry, guards === undefined ? undefined : contract(name, guards, formalsOf(args), chosen)));
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
	private owners(entry: Entry, contracted?: HTMLElement): HTMLDivElement {
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
		box.append(...(contracted === undefined ? [] : [contracted]), list, note);
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
			const claimed = new Map(guards?.[1] ?? []);
			list.append('(', ...argsOf(args).flatMap((arg, at) => [at > 0 ? ', ' : '', this.formal(arg, claimed.get(arg[0]), at)]), ')');
			said.append(list);
		}
		if(returns.length > 0) {
			said.append(el('i', 'ret', ': ' + short(returns).join(',')));
		}
		return said;
	}

	private formal([name, roles]: readonly [string, readonly string[]], claims?: readonly string[], at = 0): HTMLSpanElement {
		const part = el('span', 'formal', name);
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

/** The parts of `condition` joined by a `&&` outside of any parentheses, brackets, or strings. */
function conjuncts(condition: string): string[] {
	const parts: string[] = [];
	let depth = 0, quote: string | undefined, start = 0;
	for(let i = 0; i < condition.length; i++) {
		const c = condition[i];
		if(quote !== undefined) {
			quote = c === '\\' ? (i++, quote) : c === quote ? undefined : quote;
		} else if(c === '"' || c === "'" || c === '`') {
			quote = c;
		} else if('([{'.includes(c)) {
			depth++;
		} else if(')]}'.includes(c)) {
			depth--;
		} else if(depth === 0 && condition.startsWith(' && ', i)) {
			parts.push(condition.slice(start, i));
			start = i + 4;
			i += 3;
		}
	}
	return [...parts, condition.slice(start)];
}

/** each formal in its own color and the operators set apart, so a long condition reads at a glance */
function marker(formals: readonly string[]): (code: string) => (string | HTMLElement)[] {
	return code => code.split(/(\|\||&&|[<>=!]=|!|%in%|\b[A-Za-z.][A-Za-z0-9._]*\b(?:\()?)/).filter(part => part !== '').flatMap(part => {
		if(Operators[part] !== undefined) {
			return [titled(el('span', Operators[part][0], part), Operators[part][1])];
		} else if(formals.includes(part)) {
			return [formalMark(el('span', 'arg ' + hueOf(formals.indexOf(part)), part), part)];
		} else if(part.endsWith('(')) {
			/* a function called in the condition leads to what is known of it */
			const fn = part.slice(0, -1);
			return [link('fn', fn, search(fn), FunctionAbout[fn] ?? 'search for ' + fn), '('];
		}
		return [ClaimAbout[part] === undefined ? part : titled(el('abbr', undefined, part), ClaimAbout[part])];
	});
}

/** what the functions conditions are usually written with check, so a reader can follow a condition without the manual */
const FunctionAbout: Readonly<Record<string, string>> = {
	'length':         'the number of elements',
	'nchar':          'the number of characters of each string',
	'nrow':           'the number of rows, NULL for what has no dimensions',
	'ncol':           'the number of columns, NULL for what has no dimensions',
	'typeof':         'the internal type of a value',
	'inherits':       'whether the class attribute names one of the given classes',
	'is.numeric':     'TRUE for integer and double values without a class that says otherwise, FALSE for factors',
	'is.function':    'TRUE for closures, builtins, and specials',
	'is.null':        'TRUE only for NULL',
	'is.na':          'which elements are NA',
	'anyNA':          'whether any element is NA',
	'is.object':      'whether the value has a class attribute',
	'is.environment': 'TRUE for environments',
	'is.character':   'TRUE for character vectors',
	'is.logical':     'TRUE for logical vectors',
	'is.list':        'TRUE for lists and pairlists',
	'exists':         'whether a name is bound',
	'missing':        'whether the argument was left out of the call',
	'all':            'whether every element is TRUE',
	'any':            'whether some element is TRUE',
	'trunc':          'the number with its fraction dropped',
	'NROW':           'the number of rows, the length for a vector',
	'NCOL':           'the number of columns, 1 for a vector',
	'pmatch':         'the position of the value among the choices, matching a unique prefix as well, NA if there is none',
	'succeeds':       'flowR notation: evaluating the call does not raise an error',
	'match.arg':      'the choice the argument names, a unique prefix as well, failing for anything else',
	'match.fun':      'the function a value stands for: the function itself, or the one a name or symbol is bound to, failing otherwise'
};

/** where a contract comes from: read off the R code of the function, or stated by flowR for one written in C */
function originTag(readOff: string): HTMLElement {
	return readOff === ''
		? titled(el('span', 'origin stated', 'stated'), 'flowR states this of a function written in C')
		: titled(el('span', 'origin inferred', 'inferred'), 'inferred by reading the R code of the function in R ' + readOff + ', so another version of R may ask for less or more');
}

/** the formals a contract speaks of, in the order of the signature */
function contracted([, claims, , , relations = [], required = []]: Guards, formals: readonly string[]): string[] {
	const named = new Set([...required, ...claims.map(([formal]) => formal), ...relations.flatMap(([holds]) => formals.filter(f => new RegExp('\\b' + f.replace(/\./g, '\\.') + '\\b').test(holds)))]);
	return formals.filter(f => named.has(f));
}

/** The contract within the row: where it comes from, the formals it speaks of, and what relates them; the row opens the rest */
function teaser(name: string, guards: Guards, formals: readonly string[]): HTMLElement {
	const [, , , readOff = '', relations = []] = guards;
	const box = titled(el('div', 'teaser'), 'what a call of ' + name + ' has to fulfill to return normally, click to open');
	const line = el('div');
	line.append(el('span', 'label', 'contract'), originTag(readOff), ...contracted(guards, formals).map(formal => formalMark(el('code', hueOf(formals.indexOf(formal)), formal), formal)));
	box.append(line);
	const marked = marker(formals);
	for(const [holds, unless] of relations) {
		const related = el('div', 'related');
		related.append(...marked(holds), ...(unless === '' ? [] : [el('span', 'unless', ' unless '), ...marked(unless)]));
		box.append(related);
	}
	return box;
}

/** one row of a contract table, laid out like the rows of the packages */
function contractRow(cls: string, ...cells: readonly (string | Node)[][]): HTMLElement {
	const row = el('div', 'crow ' + cls);
	row.append(...cells.map(cell => (span => (span.append(...cell), span))(el('span'))));
	return row;
}

/** What a call has to fulfill: per formal what holds, then, opened on demand, each condition with what fails without it and where. A default of a formal has no part in this */
function contract(name: string, guards: Guards, formals: readonly string[], owner?: Owner): HTMLElement {
	const [requires, stated, because = [], , relations = [], required = []] = guards;
	const marked = marker(formals);
	const chip = (formal: string) => formalMark(el('code', 'arg ' + hueOf(formals.indexOf(formal)), formal), formal);
	const anded = (parts: readonly string[]) => parts.flatMap((part, at) => [...at > 0 ? [el('span', 'and', ' and ')] : [], ...marked(part)]);
	const box = el('div', 'contract');
	const url = owner?.sourceUrl;
	if(owner !== undefined && url !== undefined) {
		const head = el('p', 'chead');
		head.append('of ' + owner.pkg.name + '::' + name + ' ' + owner.pkg.version + ' \u00b7 implemented in ', blank(link('src', (owner.file ?? 'the sources') + (owner.line === undefined ? '' : ':' + owner.line), url, 'where ' + owner.pkg.name + '::' + name + ' is written')));
		box.append(head);
	}
	const parts = new Map(stated.map(([formal, said]) => [formal, said]));
	const rows = el('div', 'ctable');
	rows.append(contractRow('chead', ['parameter'], ['must hold, or the call fails with an error']));
	for(const formal of contracted(guards, formals).filter(f => required.includes(f) || parts.has(f))) {
		const said = el('code', 'cond');
		said.append(...anded([...required.includes(formal) ? ['!missing(' + formal + ')'] : [], ...parts.get(formal) ?? []]));
		rows.append(formalMark(contractRow('claim', [chip(formal)], [said]), formal));
	}
	for(const [holds, unless] of relations) {
		const said = el('code', 'cond');
		said.append(...marked(holds), ...(unless === '' ? [] : [el('span', 'unless', ' unless '), ...marked(unless)]));
		const related = contracted([holds, [], [], '', [[holds, '']], []], formals);
		rows.append(contractRow('claim relation', related.flatMap((f, at) => [...at > 0 ? [' '] : [], chip(f)]), [said]));
	}
	box.append(rows);
	const conditions = because.length > 0 ? because : conjuncts(requires).filter(part => part !== '').map(part => [part, '', '', '', ''] as const);
	if(conditions.length > 0) {
		const why = el('details', 'why');
		why.addEventListener('click', event => event.stopPropagation());
		why.append(el('summary', undefined, conditions.length + (conditions.length === 1 ? ' condition' : ' conditions') + ' and what fails without them'));
		const table = el('div', 'ctable');
		table.append(...conditions.map(([holds, kind, fails, via, message]) => {
			const code = el('code', 'cond');
			code.append(...marked(holds));
			const from = el('span', 'from');
			from.append(
				...(message === '' ? [] : [el('q', 'message', message)]),
				...(fails === '' ? [] : [el('span', 'where', kind === 'explicit' ? 'raised by ' : 'raised by R in '), el('code', 'at', fails)]),
				...(via === '' ? [] : [el('span', 'via', ', reached through ' + via)])
			);
			return contractRow('condition', [code], [from]);
		}));
		why.append(table);
		box.append(why);
	}
	/* hovering a formal anywhere lights it up everywhere in the contract */
	box.addEventListener('mouseover', event => light(box, (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-formal]')?.dataset.formal));
	box.addEventListener('mouseout', () => light(box, undefined));
	return box;
}

/** marks `node` as speaking of `formal`, see {@link light} */
function formalMark<T extends HTMLElement>(node: T, formal: string): T {
	node.dataset.formal = formal;
	return node;
}

/** lights up everything in `box` that speaks of `formal`, and nothing if there is none */
function light(box: HTMLElement, formal: string | undefined): void {
	box.querySelectorAll('.lit').forEach(node => node.classList.remove('lit'));
	if(formal !== undefined) {
		box.querySelectorAll<HTMLElement>('[data-formal]').forEach(node => node.classList.toggle('lit', node.dataset.formal === formal));
	}
}

/** the operators a condition is read by, each in a color of its own */
const Operators: Readonly<Record<string, readonly [cls: string, about: string]>> = {
	'!':       ['not', 'not'],
	'&&':      ['and', 'and'],
	'||':      ['or', 'or'],
	'==':      ['cmp', 'equals'],
	'!=':      ['cmp', 'differs from'],
	'<=':      ['cmp', 'at most'],
	'>=':      ['cmp', 'at least'],
	'%in%':    ['cmp', 'is one of'],
	'in':      ['cmp', 'is one of the set that follows'],
	'matches': ['cmp', 'is one of the set that follows, or a prefix that picks out only one of them, as match.arg allows'],
	'not':     ['not', 'not']
};

const Hues = 6;

/** the color class of the formal at the given position of the signature */
function hueOf(at: number): string {
	return 'hue' + String(Math.max(at, 0) % Hues);
}

/** the names of the formals of a signature, in order */
function formalsOf(args: string): string[] {
	return argsOf(args).map(([formal]) => formal);
}

/** what the words of a claim mean, so a reader need not know R's internals to read them */
const ClaimAbout: Readonly<Record<string, string>> = {
	NULL:        'NULL itself',
	logical:     'TRUE, FALSE, or NA values',
	integer:     'typeof is "integer", which includes factors',
	double:      'typeof is "double", which includes Dates and times',
	complex:     'complex numbers',
	character:   'strings',
	raw:         'raw bytes',
	list:        'a list, which includes data frames',
	pairlist:    'a pairlist, as formals() gives',
	function:    'a closure, builtin, or special',
	environment: 'an environment',
	symbol:      'a name, like quote(a)',
	language:    'a call, like quote(f(a))',
	expression:  'an expression vector',
	other:       'anything else, like an S4 object or an external pointer',
};


function packageLink(pkg: Package): HTMLAnchorElement {
	return blank(link(pkg.base ? 'base' : '', pkg.name, pkg.home ?? '',
		pkg.name + ' ' + pkg.version + (pkg.base ? ' (base R, always available)' : ' (' + pkg.repository.label + ')')));
}
