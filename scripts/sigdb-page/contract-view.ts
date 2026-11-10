import { blank, el } from '../page-lib/dom';
import type { Guards } from './database';
import { spokenOf } from './contract-formals';
import { grouped } from '../../src/dataflow/fn/guards/condition-grouping';

/*
 * How a contract reads, shared by the signature browser and the playground: the formals in their hues, the operators set
 * apart, and the conditions broken at their top-level connectives.
 */

export type Part = string | Node;

/** a link with its class, and what it leads to on hover */
export function link(className: string | undefined, text: string, href: string, title?: string): HTMLAnchorElement {
	const node = el('a', className, text);
	node.href = href;
	if(title !== undefined) {
		node.title = title;
	}
	return node;
}

/** `node` with what it means on hover, if there is anything to say */
export function titled<T extends HTMLElement>(node: T, title: string | undefined): T {
	if(title) {
		node.title = title;
	}
	return node;
}

/** The parts of `condition` joined by a `&&` outside of any parentheses, brackets, or strings. */
export function conjuncts(condition: string): string[] {
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
function marker(search: (q: string) => string, formals: readonly string[], result = false, calls: NonNullable<Guards[10]> = []): (code: string) => (string | HTMLElement)[] {
	return code => parens(grouped(code).split(/(\|\||&&|[<>=!]=|!|%in%|(?:\b[A-Za-z.][A-Za-z0-9._]*::)?\b[A-Za-z.][A-Za-z0-9._]*\b(?:\()?)/).filter(part => part !== '').flatMap(part => {
		if(Operators[part] !== undefined) {
			return [titled(el('span', Operators[part][0], part), Operators[part][1])];
		} else if(result && part === 'result') {
			return [titled(el('span', 'arg result', part), 'the value a call returns normally')];
		} else if(formals.includes(part)) {
			return [formalMark(el('span', 'arg ' + hueOf(formals.indexOf(part)), part), part)];
		} else if(/^(?:[A-Za-z.][A-Za-z0-9._]*::)?[A-Za-z.][A-Za-z0-9._]*\($/.test(part)) {
			/* a function called in the condition leads to what is known of it */
			const fn = part.slice(0, -1);
			/* the package shows on hover, also where R attaches it and the condition leaves it out */
			const qualified = calls.find(([shown]) => shown === fn)?.[1] ?? fn;
			return [link('fn', fn, search(qualified), qualified + ': ' + (FunctionAbout[fn] ?? 'search for it')), '('];
		}
		return [ClaimAbout[part] === undefined ? part : titled(el('abbr', undefined, part), ClaimAbout[part])];
	}));
}

/** the parentheses within the plain text of a rendered condition, each pair in the color of its depth so it is easy to see which close which */
function parens(parts: readonly (string | HTMLElement)[]): (string | HTMLElement)[] {
	let depth = 0;
	return parts.flatMap(part => typeof part !== 'string' ? [part] : part.split(/([()])/).filter(p => p !== '').map(p => {
		if(p === '(') {
			return el('span', `paren p${depth++ % 3}`, p);
		} else if(p === ')') {
			return el('span', `paren p${--depth % 3}`, p);
		}
		return p;
	}));
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

/** the R version a contract was read off and the day, `R 4.5.3 · updated 2026-04-01`, from the `version@date` of {@link Guards}, empty for a stated one */
export function originWords(origin: string): string {
	const [r, date] = origin.split('@');
	return origin === '' ? '' : 'R ' + r + (date === undefined ? '' : ' \u00b7 updated ' + date);
}

/** where a contract comes from: read off the R code of the function, or stated by flowR for one written in C */
export function originTag(origin: string): HTMLElement {
	return origin === ''
		? titled(el('span', 'origin stated', 'stated'), 'flowR states this of a function written in C')
		: titled(el('span', 'origin inferred', 'inferred'), 'inferred by reading the R code of the function (' + originWords(origin) + '), so another version of R may ask for less or more');
}

/** the formals a relation speaks of, in the order of the signature */
export function related(holds: string, formals: readonly string[]): string[] {
	return formals.filter(f => new RegExp('\\b' + f.replace(/\./g, '\\.') + '\\b').test(holds));
}

/**
 * Regroups a rendered condition into segments that start at its top-level connectives (`&&`, `||`, `and`, `unless`), so a long one breaks
 * there rather than inside a call or between an operand and its operator.
 */
export function breakAtTop(code: HTMLElement): void {
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

/** one row of a contract table, laid out like the rows of the packages */
export function contractRow(cls: string, ...cells: readonly (string | Node)[][]): HTMLElement {
	const row = el('div', 'crow ' + cls);
	row.append(...cells.map(cell => (span => (span.append(...cell), span))(el('span'))));
	return row;
}

/** Where a contract is shown, which decides what its parts lead to. */
export interface ContractPlace {
	/** what goes above the table, given the box to put more below, like where the function is written and how it takes part in S3 dispatch */
	readonly head?:   (box: HTMLElement) => readonly HTMLElement[]
	/** where a function a condition calls is looked up */
	readonly search:  (q: string) => string
	/** a function named as one passing a failure on */
	readonly located: (fn: string) => Part[]
	/** where the failing code of the `at`-th condition is, from the `fn:line:column` of the reason, `raiser` the function raising it */
	readonly failing: (loc: string, raiser: string, at: number) => { readonly parts: readonly Part[], readonly url?: string }
}

/** a formal as a chip in its hue, lit together with every other part speaking of it */
export function formalChip(formals: readonly string[]): (formal: string) => HTMLElement {
	return formal => formalMark(el('code', 'arg ' + hueOf(formals.indexOf(formal)), formal), formal);
}

/** What a call has to fulfill: per formal what holds, then, opened on demand, each condition with what fails without it and where. A default of a formal has no part in this */
export function contract(name: string, guards: Guards, formals: readonly string[], place: ContractPlace): HTMLElement {
	const [requires, stated, because = [], , relations = [], required = [], returns = [], , , , calls = []] = guards;
	const marked = marker(place.search, formals, false, calls);
	const chip = formalChip(formals);
	const anded = (parts: readonly string[]) => parts.flatMap((part, at) => [...at > 0 ? [el('span', 'and word', ' and ')] : [], ...marked(part)]);
	const box = el('div', 'contract');
	box.append(...place.head?.(box) ?? []);
	const parts = new Map(stated.map(([formal, said]) => [formal, said]));
	const rows = titled(el('div', 'ctable'), 'per parameter what must hold, or the call fails with an error');
	for(const formal of spokenOf(guards, formals).filter(f => required.includes(f) || parts.has(f))) {
		const said = el('code', 'cond');
		said.append(...anded([...required.includes(formal) ? ['!missing(' + formal + ')'] : [], ...parts.get(formal) ?? []]));
		/* a claim that holds unless something about other formals lets the call through speaks of those as well */
		const others = related(said.textContent ?? '', formals).filter(f => f !== formal);
		rows.append(formalMark(contractRow('claim', [chip(formal), ...others.flatMap(f => [' ', chip(f)])], [said]), formal));
	}
	for(const [holds, unless] of relations) {
		const said = el('code', 'cond');
		/* one condition, so the `unless` and what it groups read alike in every row */
		said.append(...marked(unless === '' ? holds : `${holds} unless ${unless}`));
		rows.append(contractRow('claim relation', related(holds, formals).flatMap((f, at) => [...at > 0 ? [' '] : [], chip(f)]), [said]));
	}
	if(returns.length > 0) {
		const said = el('code', 'cond');
		const result = marker(place.search, formals, true, calls);
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
		table.append(...conditions.map(([holds, kind, fails, via, message, reads = '', brief = '', loc = ''], index) => {
			/* what reads better than flowR's notation is shown, the condition as R evaluates it on hover */
			const code = titled(el('code', 'cond'), reads === '' ? undefined : holds);
			code.append(...marked(reads === '' ? holds : reads));
			const chain = via === '' ? [] : via.split(', ');
			const from = el('span', 'from');
			const shown = brief === '' ? fails : brief;
			const where = place.failing(loc, chain.at(-1) ?? name, index);
			from.append(
				...(message === '' ? [] : [el('q', 'message', message), ...fails === '' ? [] : [el('span', 'sep', ' \u00b7 ')]]),
				...(fails === '' ? [] : [el('span', 'where', kind === 'explicit' ? 'raised by ' : 'raised by R in '), where.url === undefined ? titled(el('code', 'at', shown), fails) : blank(link('at', shown, where.url, fails))]),
				...(fails === '' ? [] : [' in ', ...where.parts]),
				...(chain.length < 2 ? [] : [el('span', 'via', ', reached through '), ...chain.slice(0, -1).flatMap((fn, at) => [...at > 0 ? ['; '] : [], ...place.located(fn)])])
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

/** marks `node` as speaking of `formal`, see {@link light} */
export function formalMark<T extends HTMLElement>(node: T, formal: string): T {
	node.dataset.formal = formal;
	return node;
}

/** lights up everything in `box` that speaks of `formal`, and nothing if there is none */
export function light(box: HTMLElement, formal: string | undefined): void {
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
	'unless':   ['unless word', 'unless the following holds, which lets the call through anyway'],
	'if':       ['if word', 'only if the following holds'],
	'pmatches': ['cmp', 'is one of the set that follows, or a prefix that picks out only one of them, as pmatch and match.arg allow'],
	'not':      ['not word', 'not']
};

const Hues = 6;

/** the color class of the formal at the given position of the signature */
export function hueOf(at: number): string {
	return 'hue' + String(Math.max(at, 0) % Hues);
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
