
/** kind {@link tokenizeR} assigns; `text` is the untouched gap between real tokens */
export type RTokenKind = 'text' | 'comment' | 'string' | 'quoted' | 'number' | 'keyword' | 'call' | 'name' | 'op';

/** one piece of a tokenized R snippet, in source order and covering it without gaps */
export interface RToken {
	readonly kind: RTokenKind;
	/** the raw, unescaped source text of this token */
	readonly text: string;
}

const rKeywords = new Set([
	'if', 'else', 'for', 'while', 'repeat', 'function', 'return', 'break', 'next', 'in',
	'TRUE', 'FALSE', 'NULL', 'NA', 'NA_integer_', 'NA_real_', 'NA_character_', 'Inf', 'NaN'
]);

const rToken = /(#[^\n]*)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|(`[^`]*`)|(\d+(?:\.\d+)?(?:[eE][+-]?\d+)?[Li]?)|([A-Za-z._][A-Za-z0-9._]*)|(%[^%\s]*%|<<-|->>|<-|->|\|>|[<>=!]=|::?:?|[-+*/^$@!&|~?=])/g;

/** splits R source into tokens for {@link highlightR}; gaps between matches are kept as plain `text` */
export function tokenizeR(code: string): RToken[] {
	const tokens: RToken[] = [];
	let at = 0;
	for(const match of code.matchAll(rToken)) {
		const [whole, comment, string, quoted, number, name, operator] = match;
		if(match.index > at) {
			tokens.push({ kind: 'text', text: code.slice(at, match.index) });
		}
		at = match.index + whole.length;
		if(comment !== undefined) {
			tokens.push({ kind: 'comment', text: comment });
		} else if(string !== undefined) {
			tokens.push({ kind: 'string', text: string });
		} else if(quoted !== undefined) {
			tokens.push({ kind: 'quoted', text: quoted });
		} else if(number !== undefined) {
			tokens.push({ kind: 'number', text: number });
		} else if(name !== undefined) {
			const isCall = !rKeywords.has(name) && code.slice(at).startsWith('(');
			tokens.push({ kind: rKeywords.has(name) ? 'keyword' : isCall ? 'call' : 'name', text: name });
		} else {
			tokens.push({ kind: 'op', text: operator });
		}
	}
	if(at < code.length) {
		tokens.push({ kind: 'text', text: code.slice(at) });
	}
	return tokens;
}

/** escapes html-significant characters so R source can sit in an attribute or text node */
export function escapeHtml(text: string): string {
	return text.replace(/[&<>"\r]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\r': '&#13;' })[c] as string);
}

const tokenClass: Partial<Record<RTokenKind, string>> = {
	comment: 'tk-comment', string:  'tk-string',  quoted:  'tk-name', number:  'tk-number',
	keyword: 'tk-keyword', call:    'tk-call',   name:    'tk-name', op:      'tk-op'
};

/** name to tooltip text, for the names a page can link to */
export interface KnownNames {
	get(name: string): string | undefined
}

const linkedKinds: ReadonlySet<RTokenKind> = new Set(['call', 'op', 'keyword', 'quoted']);

/** renders one token as html; a known call links to the signature browser instead of a plain span */
export function renderRToken(token: RToken, knownNames?: KnownNames, name?: string): string {
	const shown = token.kind === 'text' ? escapeHtml(token.text) : `<span class="${tokenClass[token.kind]}">${escapeHtml(token.text)}</span>`;
	const lookup = name ?? (linkedKinds.has(token.kind) ? token.text.replace(/^`|`$/g, '') : undefined);
	const known = lookup === undefined ? undefined : knownNames?.get(lookup);
	if(lookup === undefined || known === undefined) {
		return shown;
	}
	return `<a class="tk-link" title="${escapeHtml(known)}" href="../sigdb/?q=${encodeURIComponent(lookup)}" target="_blank" rel="noopener">${shown}</a>`;
}

function boundIn(tokens: readonly RToken[]): ReadonlySet<string> {
	const bound = new Set<string>();
	const next = (at: number) => tokens.slice(at + 1).find(t => t.text.trim() !== '');
	let depth = 0;
	for(let at = 0; at < tokens.length; at++) {
		const token = tokens[at];
		if(token.kind === 'op' || token.kind === 'text') {
			depth += (token.text.match(/[([]/g)?.length ?? 0) - (token.text.match(/[)\]]/g)?.length ?? 0);
		}
		if(token.kind === 'op' && (token.text === '->' || token.text === '->>')) {
			const target = next(at);
			if(target?.kind === 'name') {
				bound.add(target.text);
			}
		} else if(token.kind === 'name' || token.kind === 'quoted' || token.kind === 'string') {
			const op = next(at);
			if(op?.kind === 'op' && (op.text === '<-' || op.text === '<<-' || (op.text === '=' && depth === 0))) {
				bound.add(token.text.replace(/^["'`]|["'`]$/g, ''));
			}
		}
	}
	return bound;
}

/** colors R source so a reader can spot the call, name, and string they're looking for */
export function highlightR(code: string, knownNames?: KnownNames): string {
	const tokens = tokenizeR(code);
	if(knownNames === undefined) {
		return tokens.map(t => renderRToken(t)).join('');
	}
	const bound = boundIn(tokens);
	const atoms: RToken[] = tokens.flatMap(t => t.kind !== 'text' ? [t] : t.text.split(/(\[\[|[[\](){}])/).filter(p => p !== '').map(p => ({ kind: 'text' as const, text: p })));
	const openers = new Set(['(', '[', '[[', '{']);
	const closer = new Map<number, number>();
	const open: { at: number, need: number }[] = [];
	atoms.forEach((a, at) => {
		if(a.kind === 'text' && openers.has(a.text)) {
			open.push({ at, need: a.text === '[[' ? 2 : 1 });
		} else if(a.kind === 'text' && /^[)\]}]$/.test(a.text) && open.length > 0) {
			const top = open[open.length - 1];
			if(--top.need === 0) {
				open.pop();
				closer.set(top.at, at);
			}
		}
	});
	const significant = (at: number, step: 1 | -1): number => {
		for(let i = at + step; i >= 0 && i < atoms.length; i += step) {
			if(atoms[i].kind !== 'comment' && atoms[i].text.trim() !== '') {
				return i;
			}
		}
		return -1;
	};
	const replacement = (head: string, end: number | undefined): string => {
		const next = end === undefined ? -1 : significant(end, 1);
		const name = next >= 0 && atoms[next].kind === 'op' ? head + atoms[next].text : undefined;
		return name !== undefined && knownNames.get(name) !== undefined ? name : head;
	};
	const grouping = (at: number): boolean => {
		const prev = significant(at, -1);
		if(prev < 0 || atoms[prev].kind === 'op' || atoms.slice(prev + 1, at).some(a => a.text.includes('\n'))) {
			return true;
		}
		return atoms[prev].kind === 'text' && (openers.has(atoms[prev].text) || /[,;]$/.test(atoms[prev].text.trim()));
	};
	const stack: string[] = [];
	const linkOf = (a: RToken, at: number): string | undefined => {
		switch(a.kind) {
			case 'text':
				if(a.text === '[' || a.text === '[[') {
					return replacement(a.text, closer.get(at));
				}
				return a.text === '{' || (a.text === '(' && grouping(at)) ? a.text : undefined;
			case 'call':
				return atoms[at + 1]?.text === '(' ? replacement(a.text, closer.get(at + 1)) : a.text;
			case 'quoted':
				return a.text.replace(/^`|`$/g, '');
			case 'op':
				if(a.text === '=' && ['(', '[', '[['].includes(stack[stack.length - 1] ?? '')) {
					return undefined;
				}
				if(a.text === '$' || a.text === '@') {
					const target = significant(at, 1);
					return target >= 0 && ['name', 'call', 'quoted', 'string'].includes(atoms[target].kind) ? replacement(a.text, target) : a.text;
				}
				return a.text;
			case 'keyword':
				return a.text;
			default:
				return undefined;
		}
	};
	return atoms.map((a, at) => {
		const link = linkOf(a, at);
		if(a.kind === 'text' && openers.has(a.text)) {
			stack.push(...(a.text === '[[' ? ['[[', '[['] : [a.text]));
		} else if(a.kind === 'text' && /^[)\]}]$/.test(a.text)) {
			stack.pop();
		}
		return link === undefined || bound.has(link) ? renderRToken(a) : renderRToken(a, knownNames, link);
	}).join('');
}
