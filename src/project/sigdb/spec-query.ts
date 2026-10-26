/** The query language of the sigdb page: `name(arg, [role], name[role], *)[prop]`. */

export const Words: Record<string, string> = {
	'can throw':                  'throws', 'invisible':                  'invis', 's3 method':                  's3', 'S3 method':                  's3', 'S4 method':                  's4',
	'changes scope':              'scope', 'non deterministic':          'nondet', 'non-deterministic':          'nondet',
	'ambient state':              'ambient', 'file system':                'file', 'network':                    'net', 'concurrent':                 'async',
	'calls something deprecated': 'calls depr', 'calls internals':            'internal', 'recursive':                  'rec',
	'owns an S3 class':           's3 class', 'owns an S4 class':           's4 class', 'higher order':               'hof', 'deprecated':                 'depr',
	'maybe pure':                 'maypure', 'sets ambient state':         'configures', 'calls native code':          'ffi',
	'produces language object':   'lang',
	'temp-file':                  'tmpfile', 'asks-user':                  'user', 'command-line':               'argv', 'draws-graphics':             'plot',
	'opens-handle':               'opens', 'closes-handle':              'closes', 'narrows-args':               'narrows', 'statistics':                 'stats',
	'javascript':                 'js',
	'forced':                     'F', 'no default':                 'R', 'lazy':                       'L',
	'value':                      'val', 'resource':                   'res', 'written':                    'out', 'callee':                     'fn', 'presence':                   'seen'
};

/** The words of a `|`-joined statement. */
export function wordsOf(joined: string): string[] {
	return joined.split('|').filter(Boolean);
}

/** The formals of a stated signature with the roles each one has. */
export function argsOf(args: string): (readonly [string, readonly string[]])[] {
	return args.split(',').filter(Boolean).map((arg): readonly [string, readonly string[]] => {
		const at = arg.indexOf(':');
		return at < 0 ? [arg.trim(), []] : [arg.slice(0, at).trim(), wordsOf(arg.slice(at + 1))];
	});
}

export interface ArgPattern {
	/** `*` or `+` after the item (a bare `*` is any argument): any number of arguments like it, including none or at least one */
	readonly repeat?: '*' | '+';
	/** the formal's name, empty for any */
	readonly name:    string;
	/** a `/pattern/` for the formal's name instead of an exact one */
	readonly regex?:  RegExp;
	readonly roles:   readonly string[];
}
export interface Spec {
	readonly rest:       string;
	/** a `/pattern/` for the function's name; `rest` is empty then */
	readonly nameRegex?: RegExp;
	readonly args?:      readonly ArgPattern[];
	readonly props:      readonly string[];
}

/** The short form of a word, so `forced` and `F` are the same. */
export const norm = (word: string): string => (Words[word.trim().toLowerCase()] ?? word.trim()).toLowerCase();
const listOf = (words: string): string[] => words.split(/[,|+]/).map(norm).filter(Boolean);

/** The `[props]` groups outside the parentheses, wherever they sit, and what is left of the query without them. */
function takeProps(typed: string): { body: string, props: string[] } {
	const props: string[] = [];
	let body = '';
	let depth = 0;
	for(let at = 0; at < typed.length; at++) {
		const c = typed[at];
		const close = typed.indexOf(']', at);
		if(c === '[' && depth === 0 && close >= 0 && ((at > 0 && typed[at - 1] !== '[') || (at === 0 && leads(typed)))) {
			props.push(...listOf(typed.slice(at + 1, close)));
			at = close;
		} else {
			depth += c === '(' ? 1 : c === ')' ? -1 : 0;
			body += c;
		}
	}
	return { body: body.trim().replace(/\s+\(/, '('), props };
}

/** `[props] rest`: a bracket group at the start only counts when something follows it, so `[` and `[[` stay names */
const LeadingProps = /^\[([^\]]*)\]\s+(\S.*)$/;
/** whether a `[` at the very start opens properties: something follows the group, or it is all there is */
const leads = (text: string): boolean => LeadingProps.test(text) || /^\[[^\]]+\]$/.test(text);
const anyArgs: ArgPattern = { repeat: '*', name: '', roles: [] };

const Mark = '\uE000';
/** a `/pattern/` standing where a name could: after the start, a space, `(`, `,` or `]`, before whatever ends a name */
const Slashed = /(^|[\s(,\]])\/((?:\\.|[^/\\\n])+)\/(?=[\s(),[*+?]|$)/g;
const asPattern = (source: string): RegExp | undefined => {
	try {
		return new RegExp(source, 'i');
	} catch{
		return undefined;
	}
};

/** `/pattern/` in the query as a regular expression, `undefined` when it is none or does not compile; `/` itself is a function */
export function regexOf(text: string): RegExp | undefined {
	const slashed = /^\/(.+)\/$/.exec(text.trim());
	return slashed === null ? undefined : asPattern(slashed[1]);
}

/** `functions starting with G that [pure]`: how a name is asked for in words, with the constraints left as they are */
const Worded = /^(?:functions?\s+)?((?:starting|starts|beginning|begins|ending|ends)\s+with|containing|contains)\s+([\w.]+)\s*(?:(?:that|which|with|having|and)\s+)?(.*)$/i;

/** the query with a worded name turned into the glob it means (`starting with G` is `G*`), any other query as it was */
export function unworded(typed: string): string {
	const worded = Worded.exec(typed.trim());
	if(worded === null) {
		return typed;
	}
	const how = worded[1].toLowerCase();
	const name = how.startsWith('end') ? `*${worded[2]}` : how.startsWith('con') ? `*${worded[2]}*` : `${worded[2]}*`;
	return name + worded[3].trim();
}

/** Splits `name(arg, [role], name[role], *)[prop]` into the name and the constraints on the arguments and the function. */
export function parseSpec(input: string): Spec {
	const typed = unworded(input);
	/* a pattern may hold anything, brackets and commas included, so it is set aside while the rest is read */
	const patterns: RegExp[] = [];
	const shielded = typed.replace(Slashed, (whole, before: string, source: string) => {
		const pattern = asPattern(source);
		return pattern === undefined ? whole : before + Mark + (patterns.push(pattern) - 1) + Mark;
	});
	const patternOf = (word: string): RegExp | undefined => {
		const held = new RegExp(`^${Mark}(\\d+)${Mark}$`).exec(word.trim());
		return held === null ? undefined : patterns[Number(held[1])];
	};
	const { body: left, props } = takeProps(shielded);
	const withArgs = /^([^(]*)\(([^]*)\)$/.exec(left);
	const args = withArgs === null || withArgs[2].trim() === '' ? undefined : withArgs[2].split(/,(?![^[]*\])/).flatMap((item): ArgPattern[] => {
		const part = new RegExp(`^(${Mark}\\d+${Mark}|[^[*+?]*)(?:\\[([^\\]]*)\\])?([*+?])?$`).exec(item.trim());
		const name = (part?.[1] ?? '').trim();
		const regex = patternOf(name);
		const own: ArgPattern = {
			repeat: part?.[3] === '?' ? undefined : part?.[3] as '*' | '+' | undefined,
			name:   name === '_' || regex !== undefined ? '' : name,
			regex,
			roles:  listOf(part?.[2] ?? '')
		};
		/* `[role]?` is at least one argument like it, with any others around it */
		return part?.[3] === '?' ? [anyArgs, own, anyArgs] : [own];
	});
	if(args === undefined && props.length === 0) {
		/* no constraint was asked for, so this is a plain name: `*`, `[`, `[[<-` or `(` are functions too */
		const nameRegex = regexOf(typed);
		return { rest: nameRegex === undefined ? typed.replace(/\(\s*\)$/, '').replace(/^`(.*)`$/, '$1').trim() : '', nameRegex, props };
	}
	const rest = (args === undefined ? left.replace(/\(\s*\)$/, '') : withArgs?.[1] ?? '').replace(/^`(.*)`$/, '$1').trim();
	const nameRegex = patternOf(rest);
	return { rest: nameRegex !== undefined || /^\*+$/.test(rest) ? '' : rest, nameRegex, args, props };
}

/** Whether the arguments a signature states fit the patterns, `*` standing for any number of them. */
export function matchArgs(patterns: readonly ArgPattern[], actual: readonly (readonly [string, readonly string[]])[]): boolean {
	/* `...` only counts when the query names it, so `print([alias])` still finds `print(x, ...)` */
	if(!patterns.some(p => p.name === '...' || p.regex?.test('...'))) {
		actual = actual.filter(([name]) => name !== '...');
	}
	if(patterns.length === 0) {
		return actual.length === 0;
	}
	const [first, ...others] = patterns;
	const one = ([name, roles]: readonly [string, readonly string[]]) =>
		(first.regex?.test(name) ?? (first.name === '' || first.name === name)) && first.roles.every(role => roles.map(norm).includes(role));
	if(first.repeat === undefined) {
		return actual.length > 0 && one(actual[0]) && matchArgs(others, actual.slice(1));
	}
	for(let taken = first.repeat === '+' ? 1 : 0; taken <= actual.length && actual.slice(0, taken).every(one); taken++) {
		if(matchArgs(others, actual.slice(taken))) {
			return true;
		}
	}
	return false;
}


/**
 * The pattern for a name with `*` in it, like `read*` or `*csv`, which has to match the whole name.
 * Names with other punctuation (`%*%`, `[[<-`) and a bare `*` are names, not patterns.
 */
export function globOf(name: string): RegExp | undefined {
	if(!name.includes('*') || !/^[\w.*]+$/.test(name) || /^\*+$/.test(name)) {
		return undefined;
	}
	return new RegExp('^' + name.split('*').map(part => part.replaceAll('.', '\\.')).join('.*') + '$', 'i');
}

/** The roles an argument can state, as the signature database words them. */
export const RoleWords: readonly string[] = ['alias', 'forced', 'no default', 'value', 'shape', 'flag', 'resource', 'written', 'nse', 'callee', 'presence', 'bounds', 'atomic', 'handle', 'lazy', 'injectable'];
/** The properties a call can state, as the signature database words them. */
export const PropWords: readonly string[] = ['pure', 'maybe pure', 'invisible', 'can throw', 'generic', 's3 method', 'changes scope', 'non deterministic', 'ambient state', 'sets ambient state', 'calls native code', 'produces language object', 'strict', 'concurrent', 'primitive'];

export interface Completion {
	/** the span of `text` the choice replaces */
	readonly from:    number;
	readonly to:      number;
	readonly options: readonly string[];
}

/**
 * The words that fit at `caret` while a `[` is open: roles inside the parentheses of an argument list, properties
 * outside. A `[` that starts the query or follows another `[` belongs to a name like `[[<-`, so it offers nothing.
 */
export function completeAt(text: string, caret: number): Completion | undefined {
	const before = text.slice(0, caret);
	const open = before.lastIndexOf('[');
	if(open <= 0 || before[open - 1] === '[' || before.includes(']', open)) {
		return undefined;
	}
	const inside = before.slice(open + 1);
	const start = open + 1 + Math.max(inside.lastIndexOf(','), inside.lastIndexOf('|'), inside.lastIndexOf('+')) + 1;
	const typed = before.slice(start).trimStart();
	const words = [...before.slice(0, open)].filter(c => c === '(').length > [...before.slice(0, open)].filter(c => c === ')').length ? RoleWords : PropWords;
	const taken = new Set(listOf(inside));
	const options = words.filter(word => word.startsWith(typed.toLowerCase()) && word !== typed.toLowerCase() && !taken.has(norm(word)));
	return options.length === 0 ? undefined : { from: caret - typed.length, to: caret, options };
}

export type TokenKind = 'plain' | 'punct' | 'op' | 'role' | 'prop' | 'bad' | 'regex';

/**
 * The query cut into pieces to color, never changing the text: joining the pieces gives `text` back.
 * Only a query that asks for a constraint is colored, a plain name like `[[<-` stays plain.
 */
export function highlight(text: string): readonly (readonly [text: string, kind: TokenKind])[] {
	const spec = parseSpec(text.trim().replace(/^\?/, '').trim());
	if(spec.nameRegex !== undefined && spec.args === undefined && spec.props.length === 0) {
		return [[text, 'regex']];
	}
	if(spec.args === undefined && spec.props.length === 0 && !/[^[]\[/.test(text)) {
		return [[text, 'plain']];
	}
	const out: [string, TokenKind][] = [];
	let depth = 0;
	for(let at = 0; at < text.length;) {
		const c = text[at];
		const slashed = c === '/' && (at === 0 || /[\s(,\]]/.test(text[at - 1])) ? new RegExp(Slashed.source, 'y') : undefined;
		if(slashed !== undefined) {
			slashed.lastIndex = Math.max(0, at - 1);
		}
		const found = slashed?.exec(text);
		if(found !== null && found !== undefined && asPattern(found[2]) !== undefined && found.index + found[1].length === at) {
			const whole = found[0].slice(found[1].length);
			out.push([whole, 'regex']);
			at += whole.length;
		} else if(c === '[' && ((at > 0 && text[at - 1] !== '[') || (at === 0 && leads(text)))) {
			const close = text.indexOf(']', at);
			const end = close < 0 ? text.length : close;
			const words = depth > 0 ? RoleWords : PropWords;
			out.push(['[', 'punct']);
			for(const part of text.slice(at + 1, end).split(/([,|+])/)) {
				const known = words.some(word => norm(word) === norm(part));
				out.push([part, /^[,|+]$/.test(part) ? 'punct' : part.trim() === '' ? 'plain' : known ? (depth > 0 ? 'role' : 'prop') : 'bad']);
			}
			if(close >= 0) {
				out.push([']', 'punct']);
			}
			at = end + 1;
		} else if('(),*+?'.includes(c)) {
			depth += c === '(' ? 1 : c === ')' ? -1 : 0;
			out.push([c, '*+?'.includes(c) ? 'op' : 'punct']);
			at++;
		} else {
			const last = out[out.length - 1];
			if(last?.[1] === 'plain') {
				last[0] += c;
			} else {
				out.push([c, 'plain']);
			}
			at++;
		}
	}
	return out;
}

/** What each completion word means, shown beside it in the list. */
export const WordInfo: Readonly<Record<string, string>> = {
	'alias':                    'handed back as the result', 'forced':                   'always evaluated', 'no default':               'declared without a default', 'value':                    'its value feeds the result',
	'shape':                    'only length or attributes used', 'flag':                     'selects a behavior', 'resource':                 'names a file or connection', 'written':                  'may be modified',
	'nse':                      'quoted, not evaluated', 'callee':                   'called as a function', 'presence':                 'only if it was given', 'bounds':                   'the result is one of its values',
	'atomic':                   'plain data only', 'handle':                   'an open connection', 'lazy':                     'never evaluated', 'injectable':               'open to injection',
	'pure':                     'computes a result, nothing else', 'maybe pure':               'pure if what it calls is', 'invisible':                'result is not printed', 'can throw':                'may raise an error',
	'generic':                  'dispatches on its argument', 's3 method':                'method of a generic', 'changes scope':            'defines or removes variables', 'non deterministic':        'may differ between runs',
	'ambient state':            'reads state outside its arguments', 'sets ambient state':       'changes options or devices', 'calls native code':        'uses C, C++ or Fortran',
	'produces language object': 'returns code as data', 'strict':                   'evaluates every argument', 'concurrent':               'runs in parallel', 'primitive':                'implemented in the R core'
};

const SymbolInfo: Readonly<Record<string, string>> = {
	'*': 'any number of arguments', '+': 'one or more, all like the one before', '?': 'at least one like the one before'
};

/** What the piece at `at` in the query stands for, for a tooltip; `undefined` where there is nothing to say. */
export function explainAt(text: string, at: number): string | undefined {
	let start = 0;
	for(const [part, kind] of highlight(text)) {
		if(at >= start && at < start + part.length) {
			switch(kind) {
				case 'role': return WordInfo[RoleWords.find(w => norm(w) === norm(part)) ?? ''];
				case 'prop': return WordInfo[PropWords.find(w => norm(w) === norm(part)) ?? ''];
				case 'bad':  return 'unknown';
				case 'regex': return 'pattern';
				default:     return kind === 'plain' ? undefined : SymbolInfo[part];
			}
		}
		start += part.length;
	}
	return undefined;
}

/**
 * Whether the query is still being written: a bracket or parenthesis is open, or a role or property is not a known word.
 * Such a query asks for nothing yet, so the page keeps showing the last answer instead of an empty one.
 * Names like `[[<-` or `(` are never incomplete.
 */
export function isIncomplete(text: string): boolean {
	const pieces = highlight(text);
	if(pieces.some(([, kind]) => kind === 'bad')) {
		return true;
	}
	/* what is written outside the closed bracket groups and patterns, where only the parentheses are left to count */
	const bare = text.replace(Slashed, '$1').replace(/(?<=[^[])\[[^\]]*\]/g, '');
	const depth = [...bare.replace(/^\(+/, '')].reduce((sum, c) => sum + (c === '(' ? 1 : c === ')' ? -1 : 0), 0);
	return /(?<=[^[])\[[^\]]*$/.test(bare) || depth > 0;
}

/** The query with whatever is open closed again, so a word offered inside brackets can be judged as if it were finished. */
export function closed(text: string): string {
	const bare = text.replace(Slashed, '$1').replace(/(?<=[^[])\[[^\]]*\]/g, '');
	const depth = [...bare.replace(/^\(+/, '')].reduce((sum, c) => sum + (c === '(' ? 1 : c === ')' ? -1 : 0), 0);
	const open = /(?<=[^[])\[[^\]]*$/.test(bare) ? ']' : '';
	return text + open + ')'.repeat(Math.max(0, depth));
}

/** The closest known word to a misspelled one: one it starts, or else within two edits. */
function closestWord(word: string, words: readonly string[]): string | undefined {
	const lower = word.toLowerCase();
	const starts = words.find(w => lower.length > 0 && w.startsWith(lower));
	if(starts !== undefined) {
		return starts;
	}
	const distance = (a: string, b: string): number => {
		let row = Array.from({ length: b.length + 1 }, (_, i) => i);
		for(let i = 1; i <= a.length; i++) {
			const next = [i];
			for(let j = 1; j <= b.length; j++) {
				next[j] = Math.min(row[j] + 1, next[j - 1] + 1, row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
			}
			row = next;
		}
		return row[b.length];
	};
	return words.map((w): [string, number] => [w, distance(lower, w)]).filter(([, d]) => d <= 2).sort((a, b) => a[1] - b[1])[0]?.[0];
}

/** What is wrong with the query as written, for the reader to fix: an open bracket, an unknown word, a pattern that does not compile. */
export function problemsOf(text: string): string[] {
	const out: string[] = [];
	const bare = text.replace(Slashed, '$1').replace(/(?<=[^[])\[[^\]]*\]/g, '');
	const depth = [...bare.replace(/^\(+/, '')].reduce((sum, c) => sum + (c === '(' ? 1 : c === ')' ? -1 : 0), 0);
	if(/(?<=[^[])\[[^\]]*$/.test(bare)) {
		out.push('missing `]`');
	}
	if(depth > 0) {
		out.push(depth === 1 ? 'missing `)`' : `missing ${depth} times \`)\``);
	} else if(depth < 0) {
		out.push('unexpected `)`');
	}
	let parens = 0;
	for(const [part, kind] of highlight(text)) {
		if(kind === 'punct' && (part === '(' || part === ')')) {
			parens += part === '(' ? 1 : -1;
		} else if(kind === 'bad') {
			const word = part.trim();
			const role = parens > 0;
			const near = closestWord(word, role ? RoleWords : PropWords);
			out.push(`\`${word}\` is no known ${role ? 'argument role' : 'function property'}${near === undefined ? '' : `, did you mean \`${near}\`?`}`);
		}
	}
	for(const slashed of text.matchAll(Slashed)) {
		try {
			new RegExp(slashed[2], 'i');
		} catch(error) {
			out.push(`invalid pattern /${slashed[2]}/: ${String((error as Error).message).replace(/^Invalid regular expression: /, '').replace(/^\/.*\/[a-z]*: /, '')}`);
		}
	}
	return out;
}
