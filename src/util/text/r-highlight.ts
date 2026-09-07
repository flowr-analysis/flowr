/**
 * Shared R tokenizer for the capabilities doc and the landing page's demo, both colored via `tk-*` classes.
 * @module
 */

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

/** the pieces an R snippet is colored by, in the order a scanner has to try them */
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
	return text.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);
}

/** the `tk-*` class a token's kind carries; `text` gaps carry none */
const tokenClass: Partial<Record<RTokenKind, string>> = {
	comment: 'tk-comment', string:  'tk-string',  quoted:  'tk-name', number:  'tk-number',
	keyword: 'tk-keyword', call:    'tk-call',   name:    'tk-name', op:      'tk-op'
};

/** call name to tooltip text, for calls a page can link to */
export type KnownNames = ReadonlyMap<string, string>;

/** renders one token as html; a known call links to the signature browser instead of a plain span */
export function renderRToken(token: RToken, knownNames?: KnownNames): string {
	if(token.kind === 'text') {
		return escapeHtml(token.text);
	}
	const known = token.kind === 'call' ? knownNames?.get(token.text) : undefined;
	if(known !== undefined) {
		return `<a class="tk-call" title="${escapeHtml(known)}" href="../sigdb/?q=${encodeURIComponent(token.text)}">${escapeHtml(token.text)}</a>`;
	}
	return `<span class="${tokenClass[token.kind]}">${escapeHtml(token.text)}</span>`;
}

/** names a snippet binds itself; never linked even if otherwise a known call */
function boundIn(tokens: readonly RToken[]): ReadonlySet<string> {
	const bound = new Set<string>();
	const next = (at: number) => tokens.slice(at + 1).find(t => t.text.trim() !== '');
	/* `=` binds only outside a call, as `f(x = 1)` names an argument rather than defining `x` */
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
	const bound = boundIn(tokens);
	return tokens.map(t => renderRToken(t, bound.has(t.text) ? undefined : knownNames)).join('');
}
