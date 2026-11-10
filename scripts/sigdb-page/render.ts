import { blank, button, el } from '../page-lib/dom';
import { argsOf, norm, shortOf, wordsOf } from './query';
import { db, Entry, ImplicitClasses, Owner, type AmbientFamily, type Guards, type Package, type RawAnswers } from './database';
import { contractFormals, spokenOf } from './contract-formals';
import { ExportFlag } from './export-flags';
import { aboutFlagNamed, aboutOf, Flags, Kinds, Origins } from './about';

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
		if(guards !== undefined) {
			row.append(teaser(name, guards, formals));
		}
		const ambient = entry.ambientIn(chosen?.pkg.name);
		if(ambient.length > 0) {
			row.append(ambientBlock(name, ambient, (entry.statedFor(chosen?.pkg.name)?.pkg ?? '') + '::' + name));
		}
		/* how it takes part in S3 dispatch is for the opened view, the card stays one line or two */
		opens(row, () => this.owners(entry, guards === undefined ? undefined : contract(name, guards, formals, chosen), s3Line(entry, formalsOf(args))));
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
	private owners(entry: Entry, contracted?: HTMLElement, s3?: HTMLElement): HTMLDivElement {
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
		/* what to ask flowR for parameters and the call graph, for the package row last hovered, copied on a click */
		let command = '';
		const ask = button('askbtn', '>_', '', event => {
			event.stopPropagation();
			void navigator.clipboard?.writeText(command).then(() => ask.textContent = 'copied');
		});
		const asks = (qualified: string) => {
			command = ':query @signature ' + qualified;
			ask.title = 'for parameters and the call graph, ask flowR: ' + command + ' (click to copy)';
		};
		const anyPackage = '* ' + name;
		asks(anyPackage);
		list.addEventListener('mouseover', event => {
			const row = (event.target as HTMLElement | null)?.closest('.own');
			if(row) {
				asks((row.querySelector('.pkg')?.textContent ?? '') + '::' + name);
			}
		});
		list.append(ask);
		const box = el('div', 'detail');
		box.append(...(s3 === undefined ? [] : [s3]), ...(contracted === undefined ? [] : [contracted]), list);
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
function marker(formals: readonly string[], result = false, calls: NonNullable<Guards[10]> = []): (code: string) => (string | HTMLElement)[] {
	return code => code.split(/(\|\||&&|[<>=!]=|!|%in%|(?:\b[A-Za-z.][A-Za-z0-9._]*::)?\b[A-Za-z.][A-Za-z0-9._]*\b(?:\()?)/).filter(part => part !== '').flatMap(part => {
		if(Operators[part] !== undefined) {
			return [titled(el('span', Operators[part][0], part), Operators[part][1])];
		} else if(result && part === 'result') {
			return [titled(el('span', 'arg result', part), 'the value a call returns normally')];
		} else if(formals.includes(part)) {
			return [formalMark(el('span', 'arg ' + hueOf(formals.indexOf(part)), part), part)];
		} else if(part.endsWith('(')) {
			/* a function called in the condition leads to what is known of it */
			const fn = part.slice(0, -1);
			/* the package shows on hover, also where R attaches it and the condition leaves it out */
			const qualified = calls.find(([shown]) => shown === fn)?.[1] ?? fn;
			return [link('fn', fn, search(qualified), qualified + ': ' + (FunctionAbout[fn] ?? 'search for it')), '('];
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

/** the R version a contract was read off and the day, `R 4.5.3 · read off 2026-04-01`, from the `version@date` of {@link Guards}, empty for a stated one */
function readOffWords(readOff: string): string {
	const [r, date] = readOff.split('@');
	return readOff === '' ? '' : 'R ' + r + (date === undefined ? '' : ' \u00b7 read off ' + date);
}

/** where a contract comes from: read off the R code of the function, or stated by flowR for one written in C */
function originTag(readOff: string): HTMLElement {
	return readOff === ''
		? titled(el('span', 'origin stated', 'stated'), 'flowR states this of a function written in C')
		: titled(el('span', 'origin inferred', 'inferred'), 'inferred by reading the R code of the function (' + readOffWords(readOff) + '), so another version of R may ask for less or more');
}

/** the formals a relation speaks of, in the order of the signature */
function related(holds: string, formals: readonly string[]): string[] {
	return formals.filter(f => new RegExp('\\b' + f.replace(/\./g, '\\.') + '\\b').test(holds));
}

/** The contract within the row: where it comes from, the formals it speaks of, and what relates them; the row opens the rest */
function teaser(name: string, guards: Guards, formals: readonly string[]): HTMLElement {
	const [, , , readOff = '', , , returns = []] = guards;
	const box = titled(el('div', 'teaser'), 'what a call of ' + name + ' has to fulfill to return normally, click to open');
	const line = el('div');
	const claimed = claimsByFormal(guards, formals);
	line.append(el('span', 'label', 'contract'), originTag(readOff), ...spokenOf(guards, formals).map(formal => formalMark(guardedChip(el('code', hueOf(formals.indexOf(formal)), formal), formal, claimed.get(formal)), formal)),
		...(returns.length === 0 ? [] : [titled(el('code', 'result', 'result'), 'what holds of the value a call returns normally')]));
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

/**
 * Regroups a rendered condition into segments that start at its top-level connectives (`&&`, `||`, `and`, `unless`), so a long one breaks
 * there rather than inside a call or between an operand and its operator.
 */
function breakAtTop(code: HTMLElement): void {
	const segments: Node[][] = [[]];
	let depth = 0;
	for(const node of code.childNodes) {
		const cls = node instanceof HTMLElement ? node.classList : undefined;
		const last = segments[segments.length - 1];
		if(depth === 0 && last.length > 0 && cls !== undefined && (cls.contains('and') || cls.contains('or') || cls.contains('unless'))) {
			segments.push([node]);
		} else {
			last.push(node);
		}
		const text = node.textContent ?? '';
		depth += text.split(/[([{]/).length - text.split(/[)\]}]/).length;
	}
	if(segments.length > 1) {
		code.replaceChildren(...segments.flatMap((nodes, at) => {
			const segment = el('span', 'seg');
			segment.append(...nodes);
			return at > 0 ? [' ', segment] : [segment];
		}));
	}
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

/** the group generics, by the formals they dispatch on, any of which may reach a method */
const GroupFormals: Readonly<Record<string, readonly string[]>> = { Ops: ['e1', 'e2'], matrixOps: ['x', 'y'], Math: ['x'], Complex: ['z'], Summary: ['the first argument'] };

/** at most this many methods are listed at a generic */
const ShownMethods = 6;

/**
 * How the name takes part in S3 dispatch: at a generic, the methods the database knows, those with a contract marked;
 * at a method, its generic, its class, and when dispatch reaches it. That is no claim about calls, as a method can be called directly.
 */
function s3Line(entry: Entry, shown: readonly string[]): HTMLElement | undefined {
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
			...ranked.slice(0, ShownMethods).flatMap((method, at) => [...at > 0 ? [' '] : [], ...methodLink(method, name)]));
		if(ranked.length > ShownMethods) {
			line.append(' ', link('more', '+' + (ranked.length - ShownMethods), search(name + '.'), 'search for every name starting with ' + name + '.'));
		}
	}
	if(generic !== undefined) {
		const cls = name.slice(generic.length + 1);
		line.append(...methods.length > 0 ? [el('br')] : [], titled(el('span', 'label', 'S3 method'), 'an implementation of the generic for one class'),
			' of ', link('generic', generic, search(generic), 'search for the generic ' + generic + ' and its other methods'), ' for class ', el('code', 'cls', cls),
			el('span', 'sep', ' · '), ...reachedBy(generic, cls, shown));
	}
	return line;
}

/** a method as a link to it, marked when flowR knows its contract */
function methodLink(method: Entry, generic: string): Part[] {
	const owners = el('span', 'owners');
	owners.append(...method.owners.slice(0, Shown).map(owner => packageLink(owner.pkg)), ...method.owners.length > Shown ? ['+' + (method.owners.length - Shown)] : []);
	/* the generic's name is implied, so a method reads as its class, followed by the packages defining it */
	return [link('method', '.' + method.name.slice(generic.length + 1), search(method.name), method.name + ': S3 method of ' + generic + ' for class '
		+ method.name.slice(generic.length + 1) + (method.contracted ? '. flowR knows what a call of it has to fulfill' : '')),
	...method.contracted ? [titled(el('span', 'hascontract', '\u2713'), 'flowR knows what a call of ' + method.name + ' has to fulfill')] : [], owners];
}

/**
 * When S3 dispatch from `generic` reaches its method for `cls`: the object dispatched on has the class, an implicit one (`numeric` for a
 * plain double) only counting for an object without a class attribute and a generic that is no primitive, as those dispatch on objects only.
 * The default method is reached whenever no other one applies.
 */
function reachedBy(generic: string, cls: string, shown: readonly string[]): Part[] {
	const stated = db.stated.get(generic) ?? [];
	const primitive = stated.some(entry => wordsOf(entry.props).includes('primitive'));
	const [first] = (db.formals.get(generic)?.[0]?.[1] ?? formalsOf(stated[0]?.args ?? '').join(',')).split(',').map(f => f.trim()).filter(f => f !== '');
	const group = GroupFormals[generic];
	const on = group ?? [first === undefined || first === '...' ? 'the first argument' : first];
	const formal = (f: string) => shown.includes(f) ? formalMark(el('code', 'arg ' + hueOf(shown.indexOf(f)), f), f) : el('code', 'arg', f);
	const onWords = 'dispatch looks at ' + on.join(' or ') + (group === undefined
		? ', the first formal of ' + generic + ', which UseMethod dispatches on unless the generic names another object'
		: ', as the group generic ' + generic + ' does');
	if(cls === 'default') {
		const classes = new Set(new Entry(generic, db.ownersOf(generic)).s3Methods.map(method => method.name.slice(generic.length + 1)));
		const free = [...ImplicitClasses].filter(c => !classes.has(c));
		return [titled(el('span', 'reach', 'reached by dispatch when no other method applies'), onWords + '. A method can also be called directly, so this is no claim about the calls of it'),
			...primitive || free.length === 0 ? [] : [el('span', 'sep', ' · '), titled(el('span', 'reach', free.length === ImplicitClasses.size ? 'no known method for any implicit class, so it takes every value without a class attribute' : 'no known method for the implicit classes ' + free.join(', ')),
				'an object without a class attribute dispatches on its implicit class (.class2: matrix or array by its dimensions, then its type, integer and double also as numeric), '
				+ 'so it reaches the default method when no method is known for any of them. A method of a package only applies once the package is loaded')]];
	}
	const implicit = ImplicitClasses.has(cls);
	const test = (f: string): Part[] => {
		if(f.includes(' ')) {
			return [f + ' has class "' + cls + '"'];
		}
		return !implicit ? ['inherits(', formal(f), ', "' + cls + '")']
			: primitive ? ['is.object(', formal(f), ') && "' + cls + '" %in% class(', formal(f), ')'] : ['"' + cls + '" %in% .class2(', formal(f), ')'];
	};
	const code = el('code', 'cond');
	code.append(...on.flatMap((f, at) => [...at > 0 ? [' || '] : [], ...test(f)]));
	return [titled(el('span', 'reach', 'reached by dispatch when '), onWords + (implicit
		? '. ' + cls + ' is an implicit class, which an object without a class attribute has by its dimensions or type'
		: '') + '. A method can also be called directly, so this is no claim about the calls of it'), code];
}

/** one row of a contract table, laid out like the rows of the packages */
function contractRow(cls: string, ...cells: readonly (string | Node)[][]): HTMLElement {
	const row = el('div', 'crow ' + cls);
	row.append(...cells.map(cell => (span => (span.append(...cell), span))(el('span'))));
	return row;
}

/** What a call has to fulfill: per formal what holds, then, opened on demand, each condition with what fails without it and where. A default of a formal has no part in this */
function contract(name: string, guards: Guards, formals: readonly string[], owner?: Owner): HTMLElement {
	const [requires, stated, because = [], , relations = [], required = [], returns = [], , , , calls = []] = guards;
	const marked = marker(formals, false, calls);
	const chip = (formal: string) => formalMark(el('code', 'arg ' + hueOf(formals.indexOf(formal)), formal), formal);
	const anded = (parts: readonly string[]) => parts.flatMap((part, at) => [...at > 0 ? [el('span', 'and word', ' and ')] : [], ...marked(part)]);
	const box = el('div', 'contract');
	const url = owner?.sourceUrl;
	if(owner !== undefined) {
		const key = owner.pkg.name + '::' + name;
		const head = titled(el('p', 'chead'), readOffWords(guards[3] ?? ''));
		head.append('of ' + key + ' ' + owner.pkg.version, ...owner.file === undefined || url === undefined ? [] : [' \u00b7 implemented in ',
			blank(link('src', owner.file + (owner.line === undefined ? '' : ':' + owner.line), url, 'where ' + key + ' is written'))],
		' ', asJson(box, 'contracts', key, 'the builtIns entry of the inspect-fn-guards query for ' + key, 'result'));
		box.append(head);
	}
	box.append(...dispatchOf(name, guards, chip, owner));
	const parts = new Map(stated.map(([formal, said]) => [formal, said]));
	const rows = titled(el('div', 'ctable'), 'per parameter what must hold, or the call fails with an error');
	for(const formal of spokenOf(guards, formals).filter(f => required.includes(f) || parts.has(f))) {
		const said = el('code', 'cond');
		said.append(...anded([...required.includes(formal) ? ['!missing(' + formal + ')'] : [], ...parts.get(formal) ?? []]));
		rows.append(formalMark(contractRow('claim', [chip(formal)], [said]), formal));
	}
	for(const [holds, unless] of relations) {
		const said = el('code', 'cond');
		said.append(...marked(holds), ...(unless === '' ? [] : [el('span', 'unless word', ' unless '), ...marked(unless)]));
		rows.append(contractRow('claim relation', related(holds, formals).flatMap((f, at) => [...at > 0 ? [' '] : [], chip(f)]), [said]));
	}
	if(returns.length > 0) {
		const said = el('code', 'cond');
		const result = marker(formals, true, calls);
		said.append(...returns.flatMap((part, at) => [...at > 0 ? [el('span', 'and word', ' and ')] : [], ...result(part)]));
		rows.append(contractRow('claim result', [titled(el('code', 'arg result', 'result'), 'the value a call returns normally')], [said]));
	}
	box.append(rows);
	const conditions = because.length > 0 ? because : conjuncts(requires).filter(part => part !== '').map(part => [part, '', '', '', ''] as const);
	if(conditions.length > 0) {
		const why = el('details', 'why');
		why.addEventListener('click', event => event.stopPropagation());
		why.append(el('summary', undefined, 'detailed conditions and failures'));
		const table = el('div', 'ctable');
		table.append(...conditions.map(([holds, kind, fails, via, message, reads = '', brief = '', loc = '']) => {
			/* what reads better than flowR's notation is shown, the condition as R evaluates it on hover */
			const code = titled(el('code', 'cond'), reads === '' ? undefined : holds);
			code.append(...marked(reads === '' ? holds : reads));
			const chain = via === '' ? [] : via.split(', ');
			const from = el('span', 'from');
			const shown = brief === '' ? fails : brief;
			/* where the failing code is, by its line within the closure as R prints it (base R keeps no source references), else by the function it is in */
			const [fn, line, column] = loc === '' ? [chain.at(-1) ?? name] : [loc.slice(0, loc.lastIndexOf(':', loc.lastIndexOf(':') - 1)), ...loc.split(':').slice(-2)];
			const failsAt = fails + ', in ' + fn + (line === undefined ? '' : ', line ' + line + ' column ' + column + ' of its closure as R prints it')
				+ (owner?.file === undefined ? '' : ' (defined in ' + owner.file + (owner.line === undefined ? '' : ':' + owner.line) + ')');
			from.append(
				...(message === '' ? [] : [el('q', 'message', message), ...fails === '' ? [] : [el('span', 'sep', ' \u00b7 ')]]),
				...(fails === '' ? [] : [el('span', 'where', kind === 'explicit' ? 'raised by ' : 'raised by R in '), url === undefined ? titled(el('code', 'at', shown), failsAt) : blank(link('at', shown, url, failsAt))]),
				/* where it is raised is only said if that is not the function itself, whose code the failing call links to */
				...(fails === '' || (chain.at(-1) ?? name).replace(/^.*::/, '') === name ? [] : [' in ', ...located(chain.at(-1) ?? name, owner)]),
				...(chain.length < 2 ? [] : [el('span', 'via', ', reached through '), ...chain.slice(0, -1).flatMap((fn, at) => [...at > 0 ? ['; '] : [], ...located(fn, owner)])])
			);
			return contractRow('condition', [code], [from]);
		}));
		why.append(table);
		box.append(why);
	}
	box.querySelectorAll<HTMLElement>('code.cond').forEach(breakAtTop);
	/* hovering a formal anywhere lights it up everywhere in the contract */
	box.addEventListener('mouseover', event => light(box, (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-formal]')?.dataset.formal));
	box.addEventListener('mouseout', () => light(box, undefined));
	return box;
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
	'!':        ['not', 'not'],
	'&&':       ['and', 'and'],
	'||':       ['or', 'or'],
	'==':       ['cmp', 'equals'],
	'!=':       ['cmp', 'differs from'],
	'<=':       ['cmp', 'at most'],
	'>=':       ['cmp', 'at least'],
	'%in%':     ['cmp', 'is one of'],
	'in':       ['cmp', 'is one of the set that follows'],
	'and':      ['and word', 'and'],
	'pmatches': ['cmp', 'is one of the set that follows, or a prefix that picks out only one of them, as pmatch and match.arg allow'],
	'not':      ['not word', 'not']
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
