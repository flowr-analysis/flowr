import type { BrandedIdentifier } from '../../environments/identifier';
import { type GuardFactsLookup, RValueType } from '../../environments/guard-facts';
import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';

/** A formal parameter of the function a term speaks about. */
export interface GuardFormal {
	readonly kind: 'formal'
	readonly name: BrandedIdentifier
}

/** A literal, as it is written in R, with the value it stands for where that is a string, number, or logical. */
export interface GuardConstant {
	readonly kind:   'constant'
	readonly lexeme: string
	readonly value?: string | number | boolean
}

/** A name defined outside of the function, read whenever the guard runs, like a global `LIMIT`. */
export interface GuardFree {
	readonly kind:    'free'
	readonly name:    BrandedIdentifier
	/** where the name was bound, if it is exactly one place */
	readonly origin?: NodeId
}

/** One argument of a {@link GuardCall}. */
export interface GuardArgument {
	readonly name?: BrandedIdentifier
	readonly value: GuardTerm
}

/** A call, also of an operator such as `&&`, written as it would be in R. */
export interface GuardCall {
	readonly kind:   'call'
	readonly fn:     BrandedIdentifier
	readonly args:   readonly GuardArgument[]
	/** the call resolves to the function of that name R ships with (not to a redefinition), so what flowR knows about that function applies */
	readonly known?: boolean
}

/**
 * A boolean R expression over the formals of a function, which is all a guard needs: its boolean structure is in
 * negation normal form, spelled with `&&`, `||`, and `!`, while everything below is what the code writes (see {@link GuardTerm.truth}).
 * The one thing beyond plain R is `succeeds(e)`, stating that evaluating `e` does not raise an error.
 */
export type GuardTerm = GuardFormal | GuardConstant | GuardFree | GuardCall;

const True: GuardConstant = { kind: 'constant', lexeme: 'TRUE', value: true };
const False: GuardConstant = { kind: 'constant', lexeme: 'FALSE', value: false };

/** A call of what R ships with, its arguments unnamed. */
function known(this: void, fn: BrandedIdentifier, ...args: readonly GuardTerm[]): GuardCall {
	return { kind: 'call', fn, known: true, args: args.map(value => ({ value })) };
}

function isCall(this: void, term: GuardTerm | undefined, fn?: BrandedIdentifier): term is GuardCall {
	return term?.kind === 'call' && (fn === undefined || term.fn === fn);
}

/** The operands of a boolean operator as one list, so a nested `a && (b && c)` reads flat. */
function flatten(this: void, fn: BrandedIdentifier, terms: readonly GuardTerm[]): GuardTerm[] {
	return terms.flatMap(t => isCall(t, fn) && t.known ? flatten(fn, t.args.map(a => a.value)) : [t]);
}

function connect(this: void, fn: BrandedIdentifier, absorbing: GuardConstant, neutral: GuardConstant, terms: readonly GuardTerm[]): GuardTerm {
	const seen = new Map<string, GuardTerm>();
	for(const term of flatten(fn, terms)) {
		if(term === absorbing || (term.kind === 'constant' && term.value === absorbing.value)) {
			return absorbing;
		} else if(term.kind !== 'constant' || term.value !== neutral.value) {
			seen.set(render(term), term);
		}
	}
	const [first, ...rest] = seen.values();
	return first === undefined ? neutral : rest.reduce((acc, term) => known(fn, acc, term), first);
}

/** The name of the function without the namespace it was written with. */
function bareName(this: void, fn: BrandedIdentifier): BrandedIdentifier {
	const at = fn.lastIndexOf('::');
	return at > 0 && at + 2 < fn.length ? fn.slice(at + 2) : fn;
}

/** All of the terms; dropping unknowable ones turns into {@link True}, which leaves what is left necessary. */
function all(this: void, ...terms: readonly GuardTerm[]): GuardTerm {
	return connect('&&', False, True, terms);
}

/** Any of the terms. */
function any(this: void, ...terms: readonly GuardTerm[]): GuardTerm {
	return connect('||', True, False, terms);
}

/** What a comparison holds as when it does not hold (only ever asked of what R has already seen to be non-`NA`). */
const NegatedComparison: Readonly<Record<BrandedIdentifier, BrandedIdentifier>> = {
	'==': '!=', '!=': '==', '<': '>=', '>=': '<', '>': '<=', '<=': '>'
};

/** The predicates yielding one logical, no matter how long their argument is, so `stopifnot` asks nothing more of them. */
function isScalar(this: void, term: GuardCall, facts: GuardFactsLookup): boolean {
	if(!term.known) {
		return false;
	} else if(NegatedComparison[term.fn] !== undefined) {
		return term.args.every(a => a.value.kind === 'constant' || (isCall(a.value) && facts(a.value.fn)?.measures === 'single'));
	}
	const stated = facts(term.fn);
	return stated?.singleResult === true || stated?.predicate !== undefined;
}

/**
 * What it means for `term` to have been found `holds` (or not): what `if` and `&&` saw is one logical that is not `NA`
 * while `stopifnot` (`vector`) saw only `TRUE`s, as it also accepts a whole vector of them.
 * The result is in negation normal form and spells the vector case out with `all`, so it reads the way it is meant.
 */
function truth(this: void, term: GuardTerm, holds: boolean, facts: GuardFactsLookup, vector = false): GuardTerm {
	const leaf = (of: GuardTerm, as: boolean, whole: boolean): GuardTerm => {
		const negated = as ? of : known('!', of);
		return whole && !(isCall(of) && isScalar(of, facts)) ? known('all', negated) : negated;
	};
	if(term.kind === 'constant' && typeof term.value === 'boolean') {
		return term.value === holds ? True : False;
	} else if(term.kind === 'formal' || term.kind === 'free') {
		if(vector) {
			/* `!x` of an empty vector of any type is `logical(0)`, so `all(!x)` holds where `!all(x)` does not */
			return known('all', holds ? term : known('!', term));
		}
		/* a factor is its codes to `if`, while `as.logical` goes by the labels */
		return leaf(known('as.logical', known('unclass', term)), holds, false);
	} else if(!isCall(term) || !term.known) {
		return leaf(term, holds, vector);
	}
	const operands = term.args.map(a => a.value);
	const [first, second] = operands;
	switch(term.fn) {
		case '!':
			return truth(first, !holds, facts, vector);
		case 'isTRUE':
		case 'isFALSE':
			/* on a formal it says more than the truth of the formal: a single logical */
			return holds && isCall(first) && isScalar(first, facts) ? truth(first, term.fn === 'isTRUE', facts) : leaf(term, holds, false);
		case '&&':
			return (holds ? all : any)(truth(first, holds, facts), truth(second, holds, facts));
		case '||':
			return (holds ? any : all)(truth(first, holds, facts), truth(second, holds, facts));
		case '&':
			return vector && !holds ? leaf(term, holds, vector) : (holds ? all : any)(truth(first, holds, facts, vector), truth(second, holds, facts, vector));
		case '|':
			return vector && holds ? leaf(term, holds, vector) : (holds ? any : all)(truth(first, holds, facts, vector), truth(second, holds, facts, vector));
		case 'all':
			return operands.length === 1 && holds ? truth(first, true, facts, true) : leaf(term, holds, false);
		case 'any':
			/* `any(NULL)` is false while `!NULL` fails, so a formal keeps the `any` */
			return operands.length === 1 && !holds && first.kind !== 'formal' ? truth(first, false, facts, true) : leaf(term, holds, false);
		default:
			if(NegatedComparison[term.fn] !== undefined && !holds) {
				return leaf({ ...term, fn: NegatedComparison[term.fn] }, true, vector);
			}
			return leaf(term, holds, vector);
	}
}

/** How tightly the operators bind, for putting parentheses exactly where R needs them. */
const Precedence: Readonly<Record<BrandedIdentifier, number>> = {
	'||':   1, '|':    1, '&&':   2, '&':    2, '==':   4, '!=':   4, '<':    4, '<=':   4, '>':    4, '>=':   4,
	'+':    5, '-':    5, '*':    6, '/':    6, '%%':   7, '%/%':  7, '%in%': 7, '%*%':  7, ':':    8, '^':    9
};
const NegationPrecedence = 3;
const AtomPrecedence = 10;

function precedenceOf(this: void, term: GuardTerm): number {
	if(!isCall(term)) {
		return AtomPrecedence;
	} else if(term.fn === '!') {
		return NegationPrecedence;
	} else if(term.args.length === 1 && (term.fn === '-' || term.fn === '+')) {
		return AtomPrecedence - 1;
	}
	return Precedence[term.fn] !== undefined && term.args.length === 2 ? Precedence[term.fn] : AtomPrecedence;
}

function renderBelow(this: void, term: GuardTerm, atLeast: number): string {
	const text = render(term);
	return precedenceOf(term) < atLeast ? `(${text})` : text;
}

/** A name R reads without backticks, `...` and `..1` among them. */
const Syntactic = /^(?:[A-Za-z]|\.(?![0-9]))[A-Za-z0-9._]*$|^\.$/;
const Reserved = new Set(['if', 'else', 'repeat', 'while', 'function', 'for', 'next', 'break', 'TRUE', 'FALSE', 'NULL', 'Inf', 'NaN', 'NA', 'NA_integer_', 'NA_real_', 'NA_character_', 'NA_complex_', 'in']);

/** The term in the R syntax it stands for. */
function render(this: void, term: GuardTerm): string {
	switch(term.kind) {
		case 'formal':
		case 'free':
		{
			const name = String(term.name);
			return Syntactic.test(name) && !Reserved.has(name) ? name : `\`${name}\``;
		}
		case 'constant':
			return term.lexeme;
	}
	const operands = term.args.map(a => a.value);
	const [first, second] = operands;
	if(term.fn === '!' || (term.args.length === 1 && (term.fn === '-' || term.fn === '+'))) {
		return `${String(term.fn)}${renderBelow(first, precedenceOf(term))}`;
	} else if(term.fn === '$' || term.fn === '@') {
		return `${renderBelow(first, AtomPrecedence)}${term.fn}${render(second)}`;
	} else if(term.fn === '[' || term.fn === '[[') {
		const close = term.fn === '[' ? ']' : ']]';
		return `${renderBelow(first, AtomPrecedence)}${term.fn}${renderArgs(term.args.slice(1))}${close}`;
	} else if(Precedence[term.fn] !== undefined && term.args.length === 2) {
		const own = Precedence[term.fn];
		const spaced = term.fn === ':' ? ':' : ` ${term.fn} `;
		return `${renderBelow(first, own)}${spaced}${renderBelow(second, own + 1)}`;
	}
	return `${term.fn}(${renderArgs(term.args)})`;
}

function renderArgs(this: void, args: readonly GuardArgument[]): string {
	return args.map(a => a.name === undefined ? render(a.value) : `${a.name} = ${render(a.value)}`).join(', ');
}

/** The formals the term reads. */
function formalsOf(this: void, term: GuardTerm, found: Set<BrandedIdentifier> = new Set()): Set<BrandedIdentifier> {
	if(term.kind === 'formal') {
		found.add(term.name);
	} else if(isCall(term)) {
		for(const arg of term.args) {
			formalsOf(arg.value, found);
		}
	}
	return found;
}

/** Whether a name from outside of the function is read. */
function readsFree(this: void, term: GuardTerm): boolean {
	return term.kind === 'free' || (isCall(term) && term.args.some(a => readsFree(a.value)));
}

/** What is bound to the formals of a callee, as seen by its caller. */
export type GuardBinding = ReadonlyMap<BrandedIdentifier, GuardTerm>;

/** What a name from outside of the callee is to its caller, given where it was bound. */
export type GuardOuter = (origin: NodeId) => GuardTerm | undefined;

/** The `term` of a callee as its caller sees it, `undefined` if it reads anything the caller cannot state. */
function substitute(this: void, term: GuardTerm, binding: GuardBinding, outer?: GuardOuter): GuardTerm | undefined {
	switch(term.kind) {
		case 'formal':
			return binding.get(term.name);
		case 'free':
			return term.origin === undefined ? undefined : outer?.(term.origin);
		case 'constant':
			return term;
	}
	if(term.fn === '...names' && term.known) {
		/* it speaks of the dots of the callee, which the caller fills */
		return undefined;
	} else if(term.fn === 'missing' && term.known) {
		const [{ value: formal }] = term.args;
		const bound = formal.kind === 'formal' ? binding.get(formal.name) : undefined;
		return bound === undefined ? True : bound.kind === 'formal' ? { ...term, args: [{ value: bound }] } : False;
	}
	const args: GuardArgument[] = [];
	for(const arg of term.args) {
		const value = substitute(arg.value, binding, outer);
		if(value === undefined) {
			return undefined;
		}
		args.push({ ...arg, value });
	}
	return { ...term, args };
}

/** The type of a literal, `undefined` where the lexeme does not settle it. */
function typeOfLiteral(this: void, term: GuardConstant): RValueType | undefined {
	if(typeof term.value === 'boolean' || term.lexeme === 'NA') {
		return RValueType.Logical;
	} else if(typeof term.value === 'string') {
		return RValueType.Character;
	} else if(term.lexeme === 'NULL') {
		return RValueType.Null;
	} else if(typeof term.value === 'number') {
		return term.lexeme.endsWith('L') ? RValueType.Integer : term.lexeme.endsWith('i') ? RValueType.Complex : RValueType.Double;
	}
	return undefined;
}

/** A predicate on a literal decided, as a literal has no attributes. */
function decided(this: void, term: GuardTerm, facts: GuardFactsLookup): GuardTerm {
	if(!isCall(term) || !term.known) {
		return term;
	} else if(term.fn === '!') {
		const of = decided(term.args[0].value, facts);
		return of.kind === 'constant' && typeof of.value === 'boolean' ? (of.value ? False : True) : known('!', of);
	}
	const predicate = facts(term.fn)?.predicate;
	const [arg] = term.args;
	const type = term.args.length === 1 && arg.name === undefined && arg.value.kind === 'constant' ? typeOfLiteral(arg.value) : undefined;
	if(predicate === undefined || type === undefined) {
		return term;
	} else if(predicate.classed || (predicate.yes & type) === 0) {
		return False;
	}
	return predicate.exact || (predicate.plain && type !== RValueType.Null) ? True : term;
}

/** {@link substitute} for a condition in negation normal form, where anything not statable can weaken into {@link True}, while the rest still holds. */
function substituteCondition(this: void, term: GuardTerm, binding: GuardBinding, outer?: GuardOuter, facts?: GuardFactsLookup): GuardTerm {
	if(isCall(term) && term.known && (term.fn === '&&' || term.fn === '||')) {
		const operands = term.args.map(a => substituteCondition(a.value, binding, outer, facts));
		return term.fn === '&&' ? all(...operands) : any(...operands);
	}
	const substituted = substitute(term, binding, outer) ?? True;
	return facts === undefined ? substituted : decided(substituted, facts);
}

/**
 * Terms state what a guard asks for, see {@link GuardTerm}.
 * @helper dataflow
 */
export const GuardTerm = {
	name: 'GuardTerm',
	True,
	False,
	known,
	isCall,
	all,
	any,
	truth,
	render,
	formalsOf,
	readsFree,
	substitute,
	substituteCondition,
	/** The string a term always spells out: a literal, or a `paste0` or `sprintf("%s", .)` of literals. */
	constantString(this: void, term: GuardTerm | undefined): string | undefined {
		if(term?.kind === 'constant') {
			return typeof term.value === 'string' ? term.value : undefined;
		} else if(!isCall(term) || !term.known || term.args.some(a => a.name !== undefined)) {
			return undefined;
		}
		const parts = term.args.map(a => GuardTerm.constantString(a.value));
		if(parts.includes(undefined)) {
			return undefined;
		}
		return term.fn === 'paste0' ? parts.join('') : term.fn === 'sprintf' && parts.length === 2 && parts[0] === '%s' ? parts[1] : undefined;
	},
	/** Whether the term is a literal `FALSE`. */
	isFalse(this: void, term: GuardTerm): boolean {
		return term.kind === 'constant' && term.value === false;
	},
	/** Whether a function of the given name is called within the term. */
	mentions(this: void, term: GuardTerm, fn: BrandedIdentifier): boolean {
		return isCall(term) && (term.fn === fn || term.args.some(a => GuardTerm.mentions(a.value, fn)));
	},
	/** A string literal. */
	string(this: void, value: string): GuardConstant {
		return { kind: 'constant', lexeme: JSON.stringify(value), value };
	},
	/** A formal as a term. */
	formal(this: void, name: BrandedIdentifier): GuardFormal {
		return { kind: 'formal', name };
	},
	bareName,
	/** What all has to hold for a condition to hold. */
	conjuncts(this: void, term: GuardTerm): readonly GuardTerm[] {
		return flatten('&&', [term]);
	},
	/** The alternatives of a condition. */
	disjuncts(this: void, term: GuardTerm): readonly GuardTerm[] {
		return flatten('||', [term]);
	},
	/** Whether the term is a literal `TRUE`. */
	isTrue(this: void, term: GuardTerm): boolean {
		return term.kind === 'constant' && term.value === true;
	},
	/** The constants of a literal vector like `c("a", "b")` or of a single constant, `undefined` for anything else. */
	constants(this: void, term: GuardTerm | undefined): readonly GuardConstant[] | undefined {
		if(term?.kind === 'constant') {
			return [term];
		} else if(!isCall(term, 'c') || !term.known) {
			return undefined;
		}
		const elements = term.args.map(a => a.value);
		return elements.every(e => e.kind === 'constant') ? elements : undefined;
	}
} as const;
