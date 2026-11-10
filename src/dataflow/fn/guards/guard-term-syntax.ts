import type { BrandedIdentifier, BrandedNamespace } from '../../environments/identifier';
import type { GuardFactsLookup } from '../../environments/guard-facts';
import { baseRExportOwner } from '../../../util/r-base-packages';
import { GuardTerm, type GuardArgument, type GuardCall } from './guard-term';

/** The names R reads as constants rather than as variables. */
const ConstantNames: ReadonlySet<string> = new Set(['NA', 'NULL', 'NaN', 'Inf', 'NA_integer_', 'NA_real_', 'NA_character_', 'NA_complex_']);

/** What flowR writes into terms beyond plain R, see {@link GuardTerm}. */
const OwnNotation: ReadonlySet<string> = new Set(['succeeds', '...names']);

const BinaryPrecedence: Readonly<Record<string, number>> = {
	'||': 1, '|':  1, '&&': 2, '&':  2, '==': 4, '!=': 4, '<':  4, '<=': 4, '>':  4, '>=': 4,
	'+':  5, '-':  5, '*':  6, '/':  6, ':':  8, '^':  9
};
const NegationPrecedence = 3;
const SignPrecedence = 9;
const SpecialPrecedence = 7;

type Token = { readonly kind: 'name' | 'string' | 'number' | 'op', readonly text: string, readonly value?: string };

const Name = /^(?:[A-Za-z]|\.(?![0-9]))[A-Za-z0-9._]*|^\./;
const NumberLiteral = /^(?:0[xX][0-9a-fA-F]+|(?:[0-9]+\.?[0-9]*|\.[0-9]+)(?:[eE][+-]?[0-9]+)?)[Li]?/;
const Operators = ['::', '||', '&&', '==', '!=', '<=', '>=', '[[', '(', ')', ',', '=', '!', '<', '>', '+', '-', '*', '/', '^', ':', '$', '@', '[', ']', '|', '&'];
const Escapes: Readonly<Record<string, string>> = { n: '\n', t: '\t', r: '\r', '0': '\0', '\\': '\\', '"': '"', '\'': '\'', '`': '`' };

function tokenize(this: void, text: string): Token[] | undefined {
	const tokens: Token[] = [];
	for(let at = 0; at < text.length;) {
		const rest = text.slice(at);
		const space = /^\s+/.exec(rest);
		if(space !== null) {
			at += space[0].length;
			continue;
		}
		const quote = rest[0];
		if(quote === '"' || quote === '\'' || quote === '`') {
			let value = '';
			let end = 1;
			for(; end < rest.length && rest[end] !== quote; end++) {
				if(rest[end] === '\\') {
					const escaped = Escapes[rest[++end]];
					if(escaped === undefined) {
						return undefined;
					}
					value += escaped;
				} else {
					value += rest[end];
				}
			}
			if(end >= rest.length) {
				return undefined;
			}
			tokens.push({ kind: quote === '`' ? 'name' : 'string', text: rest.slice(0, end + 1), value });
			at += end + 1;
			continue;
		}
		const special = /^%[^%]*%/.exec(rest);
		const matched = special?.[0] ?? NumberLiteral.exec(rest)?.[0] ?? Name.exec(rest)?.[0] ?? Operators.find(o => rest.startsWith(o));
		if(matched === undefined) {
			return undefined;
		}
		const kind = special !== null || Operators.includes(matched) ? 'op' : /^[0-9]|^\.[0-9]/.test(matched) ? 'number' : 'name';
		tokens.push({ kind, text: matched, value: kind === 'name' ? matched : undefined });
		at += matched.length;
	}
	return tokens;
}

/** The value of an R number literal, `undefined` for a complex one. */
function numberOf(this: void, lexeme: string): number | undefined {
	return lexeme.endsWith('i') ? undefined : Number(lexeme.endsWith('L') ? lexeme.slice(0, -1) : lexeme);
}

/** A parser of what {@link GuardTerm.render} writes, `formals` telling which names are formals. */
class TermParser {
	private at = 0;
	constructor(private readonly tokens: readonly Token[], private readonly formals: ReadonlySet<BrandedIdentifier>, private readonly facts: GuardFactsLookup) {}

	public parseAll(): GuardTerm | undefined {
		const term = this.expression(0);
		return this.at === this.tokens.length ? term : undefined;
	}

	private peek(): Token | undefined {
		return this.tokens[this.at];
	}

	private take(op?: string): Token | undefined {
		const token = this.tokens[this.at];
		if(token === undefined || (op !== undefined && (token.kind !== 'op' || token.text !== op))) {
			return undefined;
		}
		this.at++;
		return token;
	}

	/** A call, `syntax` for what R writes as an operator, which is R's own as the term was rendered of one flowR knows. */
	private call(fn: string, args: readonly GuardArgument[], pkg?: BrandedNamespace, syntax = true): GuardCall {
		const bare = pkg === undefined || baseRExportOwner(fn) === pkg;
		const known = bare && (syntax || OwnNotation.has(fn) || this.facts(fn) !== undefined || baseRExportOwner(fn) !== undefined);
		return { kind: 'call', fn, args, ...(pkg === undefined || bare ? {} : { pkg }), ...(known ? { known: true } : {}) };
	}

	private expression(min: number): GuardTerm | undefined {
		let left: GuardTerm | undefined;
		const first = this.peek();
		if(first?.kind === 'op' && first.text === '!') {
			this.at++;
			const operand = this.expression(NegationPrecedence);
			left = operand === undefined ? undefined : this.call('!', [{ value: operand }]);
		} else if(first?.kind === 'op' && (first.text === '-' || first.text === '+')) {
			this.at++;
			const operand = this.expression(SignPrecedence);
			left = operand?.kind === 'constant' && typeof operand.value === 'number' && first.text === '-'
				? { kind: 'constant', lexeme: `-${operand.lexeme}`, value: -operand.value }
				: operand === undefined ? undefined : this.call(first.text, [{ value: operand }]);
		} else {
			left = this.postfix();
		}
		while(left !== undefined) {
			const op = this.peek();
			const precedence = op?.kind !== 'op' ? undefined : op.text.startsWith('%') ? SpecialPrecedence : BinaryPrecedence[op.text];
			if(op === undefined || precedence === undefined || precedence < min) {
				break;
			}
			this.at++;
			const right = this.expression(precedence + 1);
			left = right === undefined ? undefined : this.call(op.text, [{ value: left }, { value: right }]);
		}
		return left;
	}

	private args(close: string): GuardArgument[] | undefined {
		const args: GuardArgument[] = [];
		if(this.take(close) !== undefined) {
			return args;
		}
		do{
			const [token, next] = [this.tokens[this.at], this.tokens[this.at + 1]];
			const named = token?.kind === 'name' && next?.kind === 'op' && next.text === '=';
			if(named) {
				this.at += 2;
			}
			const value = this.expression(0);
			if(value === undefined) {
				return undefined;
			}
			args.push(named ? { name: token.value, value } : { value });
		} while(this.take(',') !== undefined);
		return this.take(close) === undefined ? undefined : args;
	}

	private postfix(): GuardTerm | undefined {
		let term = this.primary();
		for(;;) {
			if(term === undefined) {
				return undefined;
			} else if(this.take('$') ?? this.take('@')) {
				const op = this.tokens[this.at - 1].text;
				const field = this.take();
				term = field?.kind === 'name' || field?.kind === 'string' ? this.call(op, [{ value: term }, { value: { kind: 'constant', lexeme: field.text } }]) : undefined;
			} else if(this.take('[[') !== undefined) {
				const args = this.args(']');
				term = args === undefined || this.take(']') === undefined ? undefined : this.call('[[', [{ value: term }, ...args]);
			} else if(this.take('[') !== undefined) {
				const args = this.args(']');
				term = args === undefined ? undefined : this.call('[', [{ value: term }, ...args]);
			} else {
				return term;
			}
		}
	}

	private primary(): GuardTerm | undefined {
		const token = this.take();
		if(token === undefined) {
			return undefined;
		} else if(token.kind === 'string') {
			return { kind: 'constant', lexeme: token.text, value: token.value };
		} else if(token.kind === 'number') {
			const value = numberOf(token.text);
			return { kind: 'constant', lexeme: token.text, ...(value === undefined ? {} : { value }) };
		} else if(token.kind === 'op') {
			if(token.text !== '(') {
				return undefined;
			}
			const inner = this.expression(0);
			return this.take(')') === undefined ? undefined : inner;
		}
		let name = token.value as string;
		let pkg: BrandedNamespace | undefined;
		if(this.take('::') !== undefined) {
			this.take(':');
			const fn = this.take();
			if(fn?.kind !== 'name') {
				return undefined;
			}
			pkg = name;
			name = fn.value as string;
		}
		if(this.take('(') !== undefined) {
			const args = this.args(')');
			return args === undefined ? undefined : this.call(name, args, pkg, false);
		} else if(pkg !== undefined) {
			return undefined;
		} else if(token.text === 'TRUE' || token.text === 'FALSE') {
			return token.text === 'TRUE' ? GuardTerm.True : GuardTerm.False;
		} else if(ConstantNames.has(token.text)) {
			return { kind: 'constant', lexeme: token.text };
		}
		return this.formals.has(name) ? GuardTerm.formal(name) : { kind: 'free', name };
	}
}

/**
 * A condition in R syntax as {@link GuardTerm.render} writes it, read back into a term over the given formals,
 * as the guards of functions without a program to read them from are stored: `undefined` if it cannot be read.
 * A name other than a formal reads as a name from outside, which no call can state.
 */
export function parseGuardTerm(this: void, text: string, formals: readonly BrandedIdentifier[], facts: GuardFactsLookup): GuardTerm | undefined {
	const tokens = tokenize(text);
	return tokens === undefined ? undefined : new TermParser(tokens, new Set(formals), facts).parseAll();
}
