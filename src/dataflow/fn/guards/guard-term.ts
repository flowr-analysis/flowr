import { Identifier, type BrandedIdentifier, type BrandedNamespace } from '../../environments/identifier';
import { baseRExportOwner } from '../../../util/r-base-packages';
import { type GuardFactsLookup, RValueType } from '../../environments/guard-facts';
import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';

/** The operators and functions of R the guards speak of by name, with flowR's own `succeeds` and `...names` (see {@link GuardTerm}). */
export enum GuardFn {
	And = '&&',
	Or = '||',
	Not = '!',
	ElementAnd = '&',
	ElementOr = '|',
	Equal = '==',
	NotEqual = '!=',
	Less = '<',
	LessEqual = '<=',
	Greater = '>',
	GreaterEqual = '>=',
	Plus = '+',
	Minus = '-',
	Times = '*',
	Divide = '/',
	Power = '^',
	Modulo = '%%',
	IntegerDivide = '%/%',
	In = '%in%',
	MatrixProduct = '%*%',
	Colon = ':',
	Dollar = '$',
	At = '@',
	Index = '[',
	Element = '[[',
	Succeeds = 'succeeds',
	DotsNames = '...names',
	Missing = 'missing',
	All = 'all',
	Any = 'any',
	Combine = 'c',
	Length = 'length',
	IsTrue = 'isTRUE',
	IsFalse = 'isFALSE',
	IsNull = 'is.null',
	IsNa = 'is.na',
	IsObject = 'is.object',
	IsCharacter = 'is.character',
	IsFunction = 'is.function',
	AsLogical = 'as.logical',
	Unclass = 'unclass',
	OldClass = 'oldClass',
	Class = 'class',
	Inherits = 'inherits',
	Identical = 'identical',
	Exists = 'exists',
	Get = 'get',
	MatchArg = 'match.arg',
	Paste = 'paste',
	Paste0 = 'paste0',
	Sprintf = 'sprintf',
	If = 'if',
	For = 'for',
	While = 'while',
	Switch = 'switch',
	Return = 'return',
	OnExit = 'on.exit',
	UseMethod = 'UseMethod',
	NextMethod = 'NextMethod'
}

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
	/** the package the function called comes from, as flowR resolves the call, which the call is written with unless R attaches it on startup */
	readonly pkg?:   BrandedNamespace
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
	return knownOf(fn, args);
}

/** {@link known} with the arguments as one list. */
function knownOf(this: void, fn: BrandedIdentifier, args: readonly GuardTerm[]): GuardCall {
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
	return seen.size === 0 ? neutral : seen.values().reduce((acc, term) => known(fn, acc, term));
}

/** The name of the function without the namespace it was written with. */
function bareName(this: void, fn: BrandedIdentifier): BrandedIdentifier {
	const at = fn.lastIndexOf('::');
	return at > 0 && at + 2 < fn.length ? fn.slice(at + 2) : fn;
}

/** All of the terms; dropping unknowable ones turns into {@link True}, which leaves what is left necessary. */
function all(this: void, ...terms: readonly GuardTerm[]): GuardTerm {
	return allOf(terms);
}

/** {@link all} with the terms as one list. */
function allOf(this: void, terms: readonly GuardTerm[]): GuardTerm {
	const joined = connect(GuardFn.And, False, True, terms);
	return isCall(joined, GuardFn.And) && joined.known ? connect(GuardFn.And, False, True, resolved(flatten(GuardFn.And, [joined]), t => t, (_a, _b, t) => t)) : joined;
}

/** Whether `a` holds exactly when `b` does not, as far as what they are written as tells. */
function complementary(this: void, a: GuardTerm, b: GuardTerm): boolean {
	const negates = (x: GuardTerm, y: GuardTerm) => isCall(x, GuardFn.Not) && x.known === true && x.args.length === 1 && render(x.args[0].value) === render(y);
	const flips = isCall(a) && isCall(b) && a.known === true && b.known === true && NegatedComparison[a.fn] === b.fn && a.args.length === 2 && b.args.length === 2
		&& a.args.every((arg, at) => render(arg.value) === render(b.args[at].value));
	return flips || negates(a, b) || negates(b, a);
}

/**
 * The conjuncts with what follows from them by what they are written as: of `p` and `p || q` the former says it all,
 * and `a || p` with `!a || p` leaves `p`, `merge` telling what the item for that is.
 */
function resolved<T>(this: void, items: readonly T[], termOf: (item: T) => GuardTerm, merge: (a: T, b: T, term: GuardTerm) => T): T[] {
	let current = items.slice();
	for(let changed = true; changed;) {
		changed = false;
		const alternatives = current.map(item => flatten(GuardFn.Or, [termOf(item)]));
		const keys = alternatives.map(of => new Set(of.map(render)));
		const kept = current.filter((_, j) => !keys.some((key, i) => i !== j && key.isSubsetOf(keys[j]) && (key.size < keys[j].size || i < j)));
		if(kept.length < current.length) {
			current = kept;
			changed = true;
			continue;
		}
		for(let i = 0; i < current.length && !changed; i++) {
			for(let j = i + 1; j < current.length && !changed; j++) {
				const [mine, theirs] = [alternatives[i].filter(a => !keys[j].has(render(a))), alternatives[j].filter(a => !keys[i].has(render(a)))];
				if(mine.length === 1 && theirs.length === 1 && complementary(mine[0], theirs[0])) {
					const rest = anyOf(alternatives[i].filter(a => a !== mine[0]));
					current = current.toSpliced(j, 1).with(i, merge(current[i], current[j], rest));
					changed = true;
				}
			}
		}
	}
	return current;
}

/** Any of the terms. */
function any(this: void, ...terms: readonly GuardTerm[]): GuardTerm {
	return anyOf(terms);
}

/** {@link any} with the terms as one list. */
function anyOf(this: void, terms: readonly GuardTerm[]): GuardTerm {
	/* an alternative that cannot hold as written is none, so `a || (p && !p)` is `a` */
	return connect(GuardFn.Or, True, False, terms.some(t => isCall(t, GuardFn.And)) ? flatten(GuardFn.Or, terms).filter(t => !unsatisfiable(t)) : terms);
}

/** What a comparison holds as when it does not hold (only ever asked of what R has already seen to be non-`NA`). */
const NegatedComparison: Readonly<Record<BrandedIdentifier, BrandedIdentifier>> = {
	[GuardFn.Equal]:        GuardFn.NotEqual,
	[GuardFn.NotEqual]:     GuardFn.Equal,
	[GuardFn.Less]:         GuardFn.GreaterEqual,
	[GuardFn.GreaterEqual]: GuardFn.Less,
	[GuardFn.Greater]:      GuardFn.LessEqual,
	[GuardFn.LessEqual]:    GuardFn.Greater
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

/** Whether R goes by the first element of a longer `operand` of `fn`, as before R 4.2 for `if` and before R 4.3 for `&&`, instead of failing on it. */
function firstOnly(this: void, facts: GuardFactsLookup, fn: BrandedIdentifier, operand: BrandedIdentifier): boolean {
	return !(facts(fn)?.asks?.[operand] ?? []).some(({ requires }) => 'length' in requires && requires.length === '<=' && requires.to === 1);
}

/**
 * What it means for `term` to have been found `holds` (or not): what `if` and `&&` saw is one logical that is not `NA`
 * while `stopifnot` (`vector`) saw only `TRUE`s, as it also accepts a whole vector of them.
 * With `leading`, R saw only the first element of what may be longer, so only that is said of it, see {@link firstOnly}.
 * The result is in negation normal form and spells the vector case out with `all`, so it reads the way it is meant.
 */
function truth(this: void, term: GuardTerm, holds: boolean, facts: GuardFactsLookup, vector = false, leading = false): GuardTerm {
	function leaf(of: GuardTerm, as: boolean, whole: boolean): GuardTerm {
		const negated = as ? of : known(GuardFn.Not, of);
		if(isCall(of) && isScalar(of, facts)) {
			return negated;
		}
		return whole ? known(GuardFn.All, negated) : leading ? known(GuardFn.Index, negated, numberConstant(1, false)) : negated;
	}
	const operand = (fn: BrandedIdentifier, of: GuardTerm) => truth(of, holds, facts, false, firstOnly(facts, fn, 'x'));
	if(term.kind === 'constant' && typeof term.value === 'boolean') {
		return term.value === holds ? True : False;
	} else if(term.kind === 'formal' || term.kind === 'free') {
		if(vector) {
			/* `!x` of an empty vector of any type is `logical(0)`, so `all(!x)` holds where `!all(x)` does not */
			return known(GuardFn.All, holds ? term : known(GuardFn.Not, term));
		}
		/* a factor is its codes to `if`, while `as.logical` goes by the labels */
		return leaf(known(GuardFn.AsLogical, known(GuardFn.Unclass, term)), holds, false);
	} else if(!isCall(term) || !term.known) {
		return leaf(term, holds, vector);
	}
	const operands = term.args.map(a => a.value);
	const [first, second] = operands;
	switch(term.fn) {
		case GuardFn.Not:
			return truth(first, !holds, facts, vector, leading);
		case GuardFn.IsTrue:
		case GuardFn.IsFalse:
			/* on a formal it says more than the truth of the formal: a single logical */
			return holds && isCall(first) && isScalar(first, facts) ? truth(first, term.fn === GuardFn.IsTrue, facts) : leaf(term, holds, false);
		case GuardFn.And:
			return (holds ? all : any)(operand(GuardFn.And, first), operand(GuardFn.And, second));
		case GuardFn.Or:
			return (holds ? any : all)(operand(GuardFn.Or, first), operand(GuardFn.Or, second));
		case GuardFn.ElementAnd:
			return vector && !holds ? leaf(term, holds, vector) : (holds ? all : any)(truth(first, holds, facts, vector, leading), truth(second, holds, facts, vector, leading));
		case GuardFn.ElementOr:
			return vector && holds ? leaf(term, holds, vector) : (holds ? any : all)(truth(first, holds, facts, vector, leading), truth(second, holds, facts, vector, leading));
		case GuardFn.All:
			return operands.length === 1 && holds ? truth(first, true, facts, true) : leaf(term, holds, false);
		case GuardFn.Any:
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
export const Precedence: Readonly<Record<BrandedIdentifier, number>> = {
	[GuardFn.Or]:            1,
	[GuardFn.ElementOr]:     1,
	[GuardFn.And]:           2,
	[GuardFn.ElementAnd]:    2,
	[GuardFn.Equal]:         4,
	[GuardFn.NotEqual]:      4,
	[GuardFn.Less]:          4,
	[GuardFn.LessEqual]:     4,
	[GuardFn.Greater]:       4,
	[GuardFn.GreaterEqual]:  4,
	[GuardFn.Plus]:          5,
	[GuardFn.Minus]:         5,
	[GuardFn.Times]:         6,
	[GuardFn.Divide]:        6,
	[GuardFn.Modulo]:        7,
	[GuardFn.IntegerDivide]: 7,
	[GuardFn.In]:            7,
	[GuardFn.MatrixProduct]: 7,
	[GuardFn.Colon]:         8,
	[GuardFn.Power]:         9
};
export const NegationPrecedence = 3;
export const AtomPrecedence = 10;

function precedenceOf(this: void, term: GuardTerm): number {
	if(!isCall(term)) {
		return AtomPrecedence;
	} else if(term.fn === GuardFn.Not) {
		return NegationPrecedence;
	} else if(term.args.length === 1 && (term.fn === GuardFn.Minus || term.fn === GuardFn.Plus)) {
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
/** The names R reads as constants rather than as variables. */
export const RConstantNames: ReadonlySet<string> = new Set(['NA', 'NULL', 'NaN', 'Inf', 'NA_integer_', 'NA_real_', 'NA_character_', 'NA_complex_']);
const Reserved = new Set(['if', 'else', 'repeat', 'while', 'function', 'for', 'next', 'break', 'TRUE', 'FALSE', 'in', ...RConstantNames]);

/** The term in the R syntax it stands for. */
function render(this: void, term: GuardTerm): string {
	switch(term.kind) {
		case 'formal':
		case 'free':
			return quoted(term.name);
		case 'constant':
			return term.lexeme;
	}
	const operands = term.args.map(a => a.value);
	const [first, second] = operands;
	if(term.fn === GuardFn.Not || (term.args.length === 1 && (term.fn === GuardFn.Minus || term.fn === GuardFn.Plus))) {
		return `${String(term.fn)}${renderBelow(first, precedenceOf(term))}`;
	} else if(term.fn === GuardFn.Dollar || term.fn === GuardFn.At) {
		return `${renderBelow(first, AtomPrecedence)}${term.fn}${render(second)}`;
	} else if(term.fn === GuardFn.Index || term.fn === GuardFn.Element) {
		const close = term.fn === GuardFn.Index ? ']' : ']]';
		return `${renderBelow(first, AtomPrecedence)}${term.fn}${renderArgs(term.args.slice(1))}${close}`;
	} else if(Precedence[term.fn] !== undefined && term.args.length === 2) {
		const own = Precedence[term.fn];
		const spaced = term.fn === GuardFn.Colon ? ':' : ` ${term.fn} `;
		return `${renderBelow(first, own)}${spaced}${renderBelow(second, own + 1)}`;
	}
	return `${calledName(term)}(${renderArgs(term.args)})`;
}

/** A name in R syntax, in backticks where R needs them. */
function quoted(this: void, name: BrandedIdentifier): string {
	const plain = String(name);
	return Syntactic.test(plain) && !Reserved.has(plain) ? plain : `\`${plain}\``;
}

/** The function a call names, as {@link Identifier.toPreludeString} writes it. */
function calledName(this: void, term: GuardCall): string {
	return Identifier.toPreludeString(Identifier.mapName(term.pkg === undefined ? term.fn : Identifier.make(term.fn, term.pkg), quoted));
}

/** Every function the term calls, with the package it comes from where that is known, R's own for one flowR knows, leaving out the `&&` and `||` a term is built with. */
function callsOf(this: void, term: GuardTerm, found: Map<string, Identifier> = new Map()): Map<string, Identifier> {
	if(isCall(term) && term.known && (term.fn === GuardFn.And || term.fn === GuardFn.Or)) {
		term.args.forEach(arg => callsOf(arg.value, found));
	} else if(isCall(term)) {
		const pkg = term.pkg ?? (term.known ? baseRExportOwner(term.fn) : undefined);
		const id = pkg === undefined ? term.fn : Identifier.make(term.fn, pkg);
		found.set(Identifier.toString(id), id);
		for(const arg of term.args) {
			callsOf(arg.value, found);
		}
	}
	return found;
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

/**
 * The `term` of a callee as its caller sees it, `undefined` if it reads anything the caller cannot state.
 * `absent` states what `missing` is of the formals where a call tells, without it a formal is missing with the formal it is bound to, as a dispatch hands it on.
 */
function substitute(this: void, term: GuardTerm, binding: GuardBinding, outer?: GuardOuter, absent?: GuardBinding): GuardTerm | undefined {
	switch(term.kind) {
		case 'formal':
			return binding.get(term.name);
		case 'free':
			return term.origin === undefined ? undefined : outer?.(term.origin);
		case 'constant':
			return term;
	}
	if(term.fn === GuardFn.DotsNames && term.known) {
		/* it speaks of the dots of the callee, which the caller fills */
		return undefined;
	} else if(term.fn === GuardFn.Missing && term.known) {
		const [{ value: formal }] = term.args;
		if(absent !== undefined) {
			return formal.kind === 'formal' ? absent.get(formal.name) : undefined;
		}
		const bound = formal.kind === 'formal' ? binding.get(formal.name) : undefined;
		return bound === undefined ? True : bound.kind === 'formal' ? { ...term, args: [{ value: bound }] } : False;
	}
	const args: GuardArgument[] = [];
	for(const arg of term.args) {
		const value = substitute(arg.value, binding, outer, absent);
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

/** How R ranks the types `c` combines, the lowest first. */
const CombinedRanks: readonly RValueType[] = [RValueType.Null, RValueType.Logical, RValueType.Integer, RValueType.Double, RValueType.Complex, RValueType.Character];

/** The type and length of a literal, or of a `c(...)` of literals without names as R combines them, `undefined` where the lexemes do not settle it. */
function shapeOfLiterals(this: void, term: GuardTerm): { readonly type: RValueType, readonly length: number } | undefined {
	if(term.kind === 'constant') {
		const type = typeOfLiteral(term);
		return type === undefined ? undefined : { type, length: type === RValueType.Null ? 0 : 1 };
	} else if(!isCall(term, GuardFn.Combine) || !term.known || term.args.some(a => a.name !== undefined || a.value.kind !== 'constant')) {
		return undefined;
	}
	const types = term.args.map(a => typeOfLiteral(a.value as GuardConstant));
	if(types.includes(undefined)) {
		return undefined;
	}
	const length = types.filter(t => t !== RValueType.Null).length;
	return { type: CombinedRanks[types.reduce((rank, t) => Math.max(rank, CombinedRanks.indexOf(t as RValueType)), 0)], length };
}

/** The constants of a literal vector like `c("a", "b")` or of a single constant, `undefined` for anything else. */
function constantsOf(this: void, term: GuardTerm | undefined): readonly GuardConstant[] | undefined {
	if(term?.kind === 'constant') {
		return [term];
	} else if(!isCall(term, GuardFn.Combine) || !term.known) {
		return undefined;
	}
	const elements = term.args.map(a => a.value);
	return elements.every(e => e.kind === 'constant') ? elements : undefined;
}

type Scalar = string | number | boolean;

/** The value of a literal: `null` for `NA`, `undefined` for one without a single value of its own (`NULL`, a complex number). */
function scalarOf(this: void, term: GuardTerm): Scalar | null | undefined {
	if(term.kind !== 'constant') {
		return undefined;
	} else if(term.value !== undefined) {
		return typeof term.value === 'number' && Number.isNaN(term.value) ? null : term.value;
	} else if(term.lexeme === 'Inf') {
		return Infinity;
	}
	return term.lexeme === 'NULL' ? undefined : term.lexeme.startsWith('NA') || term.lexeme === 'NaN' ? null : undefined;
}

function logical(this: void, value: boolean | null): GuardConstant {
	return value === null ? { kind: 'constant', lexeme: 'NA' } : value ? True : False;
}

function isInteger(this: void, term: GuardTerm): boolean {
	return term.kind === 'constant' && /^-?(?:0[xX][0-9a-fA-F]+|[0-9]+)L$/.test(term.lexeme);
}

function numberConstant(this: void, value: number, integer: boolean): GuardConstant {
	return Number.isFinite(value) ? { kind: 'constant', lexeme: `${value}${integer ? 'L' : ''}`, value } : { kind: 'constant', lexeme: value > 0 ? 'Inf' : '-Inf', value };
}

const Comparisons: Readonly<Record<string, (a: number, b: number) => boolean>> = {
	[GuardFn.Equal]:        (a, b) => a === b,
	[GuardFn.NotEqual]:     (a, b) => a !== b,
	[GuardFn.Less]:         (a, b) => a < b,
	[GuardFn.LessEqual]:    (a, b) => a <= b,
	[GuardFn.Greater]:      (a, b) => a > b,
	[GuardFn.GreaterEqual]: (a, b) => a >= b
};
const Arithmetic: Readonly<Record<string, (a: number, b: number) => number>> = {
	[GuardFn.Plus]:   (a, b) => a + b,
	[GuardFn.Minus]:  (a, b) => a - b,
	[GuardFn.Times]:  (a, b) => a * b,
	[GuardFn.Divide]: (a, b) => a / b
};
const Rounding: Readonly<Record<string, (a: number) => number>> = { trunc: Math.trunc, floor: Math.floor, ceiling: Math.ceil };

/** Whether `match.arg(arg, choices)` returns, for a single string and literal choices, `undefined` for anything else. */
function matchesArg(this: void, call: GuardCall): boolean | undefined {
	const [arg, choices] = call.args;
	const options = constantsOf(choices?.value)?.map(c => c.value);
	if(call.args.length !== 2 || arg.name !== undefined || (choices.name !== undefined && choices.name !== 'choices') || options === undefined || !options.every(o => typeof o === 'string')) {
		return undefined;
	}
	const given = scalarOf(arg.value);
	if(typeof given === 'number' || typeof given === 'boolean') {
		/* match.arg rejects anything but NULL or a character vector */
		return false;
	} else if(typeof given !== 'string') {
		return undefined;
	}
	return given !== '' && (options.includes(given) || options.filter(o => o.startsWith(given)).length === 1);
}

/** The call of R's own on literals evaluated as R would, `undefined` where that is not settled. */
function evaluated(this: void, call: GuardCall): GuardTerm | undefined {
	const fn = String(call.fn);
	const operands = call.args.map(a => a.value);
	const [first, second] = operands;
	const [a, b] = [first === undefined ? undefined : scalarOf(first), second === undefined ? undefined : scalarOf(second)];
	if(call.args.some(arg => arg.name !== undefined) && fn !== GuardFn.Succeeds) {
		return undefined;
	}
	switch(fn) {
		case GuardFn.Length: {
			const constants = operands.length === 1 ? constantsOf(first) : undefined;
			return constants === undefined ? undefined : numberConstant(constants.filter(c => c.lexeme !== 'NULL').length, true);
		}
		case GuardFn.IsNa:
			return operands.length === 1 && a !== undefined ? logical(a === null) : undefined;
		case GuardFn.Unclass:
			return operands.length === 1 && first.kind === 'constant' ? first : undefined;
		case GuardFn.AsLogical:
		case GuardFn.All:
		case GuardFn.Any:
			if(operands.length !== 1 || (typeof a !== 'boolean' && (fn !== GuardFn.AsLogical || typeof a !== 'number'))) {
				return a === null && fn === GuardFn.AsLogical ? logical(null) : undefined;
			}
			return logical(typeof a === 'number' ? (Number.isNaN(a) ? null : a !== 0) : a);
		case GuardFn.IsTrue:
		case GuardFn.IsFalse:
			return operands.length === 1 && first.kind === 'constant' && first.lexeme !== 'NULL' ? logical(a === (fn === GuardFn.IsTrue)) : undefined;
		case GuardFn.In: {
			const among = constantsOf(second)?.map(scalarOf);
			return a === undefined || a === null || among === undefined || !among.every(v => typeof v === typeof a) ? undefined : logical(among.includes(a));
		}
		case GuardFn.Succeeds:
			return isCall(first, GuardFn.MatchArg) && first.known ? (r => r === undefined ? undefined : logical(r))(matchesArg(first)) : undefined;
	}
	if(Rounding[fn] !== undefined && operands.length === 1 && typeof a === 'number') {
		return numberConstant(Rounding[fn](a), false);
	} else if(fn === GuardFn.Minus && operands.length === 1 && typeof a === 'number') {
		return numberConstant(-a, isInteger(first));
	} else if(operands.length !== 2 || a === undefined || b === undefined) {
		return undefined;
	} else if(Comparisons[fn] !== undefined) {
		if(a === null || b === null) {
			return logical(null);
		} else if(typeof a === 'string' || typeof b === 'string') {
			/* strings compare by the collation of the locale, and a number turns into a string first */
			return typeof a === 'string' && typeof b === 'string' && (fn === GuardFn.Equal || fn === GuardFn.NotEqual) ? logical((a === b) === (fn === GuardFn.Equal)) : undefined;
		}
		return logical(Comparisons[fn](Number(a), Number(b)));
	} else if(Arithmetic[fn] !== undefined && typeof a === 'number' && typeof b === 'number') {
		return numberConstant(Arithmetic[fn](a, b), fn !== GuardFn.Divide && isInteger(first) && isInteger(second));
	}
	return undefined;
}

/**
 * A call of R's own on literals evaluated as R would, as a call site handing over literals makes it: predicates by what
 * literals are (they have no attributes), and comparisons, arithmetic, `length`, `is.na`, `%in%` and `match.arg` by what R computes.
 * Anything not settled stays as it is, the operands of `&&` and `||` are decided one by one.
 */
function decided(this: void, term: GuardTerm, facts: GuardFactsLookup): GuardTerm {
	if(!isCall(term) || !term.known) {
		return term;
	} else if(term.fn === GuardFn.And || term.fn === GuardFn.Or) {
		const operands = term.args.map(a => decided(a.value, facts));
		return term.fn === GuardFn.And ? allOf(operands) : anyOf(operands);
	} else if(term.fn === GuardFn.Not) {
		const of = decided(term.args[0].value, facts);
		return of.kind === 'constant' && typeof of.value === 'boolean' ? (of.value ? False : True) : known(GuardFn.Not, of);
	}
	const call: GuardCall = { ...term, args: term.args.map(a => ({ ...a, value: decided(a.value, facts) })) };
	return evaluated(call) ?? predicateDecided(call, facts);
}

/** A predicate on literals decided, as literals have no attributes. */
function predicateDecided(this: void, term: GuardCall, facts: GuardFactsLookup): GuardTerm {
	const predicate = facts(term.fn)?.predicate;
	const [arg] = term.args;
	const shape = term.args.length === 1 && arg.name === undefined ? shapeOfLiterals(arg.value) : undefined;
	if(predicate === undefined || shape === undefined) {
		return term;
	} else if(predicate.classed || (predicate.yes & shape.type) === 0 || (predicate.scalar && shape.length !== 1)) {
		return False;
	}
	return predicate.exact || (predicate.plain && shape.type !== RValueType.Null) ? True : term;
}

/** {@link substitute} for a condition in negation normal form, where anything not statable can weaken into {@link True}, while the rest still holds. */
function substituteCondition(this: void, term: GuardTerm, binding: GuardBinding, outer?: GuardOuter, facts?: GuardFactsLookup, absent?: GuardBinding): GuardTerm {
	if(isCall(term) && term.known && (term.fn === GuardFn.And || term.fn === GuardFn.Or)) {
		const operands = term.args.map(a => substituteCondition(a.value, binding, outer, facts, absent));
		return term.fn === GuardFn.And ? allOf(operands) : anyOf(operands);
	}
	const substituted = substitute(term, binding, outer, absent) ?? True;
	return facts === undefined ? substituted : decided(substituted, facts);
}

/** Whether the conjunction cannot hold as written: one of its parts is a disjunction of what its other parts rule out, `p && q && (!p || !q)`. */
function unsatisfiable(this: void, term: GuardTerm): boolean {
	const parts = flatten(GuardFn.And, [term]);
	return parts.some(part => {
		const alternatives = flatten(GuardFn.Or, [part]);
		return alternatives.length > 1 && alternatives.every(a => parts.some(other => other !== part && complementary(a, other)));
	});
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
	knownOf,
	isCall,
	all,
	allOf,
	any,
	anyOf,
	truth,
	firstOnly,
	render,
	formalsOf,
	/** Every function the term calls, see {@link callsOf}. */
	callsOf(this: void, term: GuardTerm): readonly Identifier[] {
		return callsOf(term).values().toArray();
	},
	readsFree,
	substitute,
	substituteCondition,
	decided,
	resolved,
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
		return term.fn === GuardFn.Paste0 ? parts.join('') : term.fn === GuardFn.Sprintf && parts.length === 2 && parts[0] === '%s' ? parts[1] : undefined;
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
		return flatten(GuardFn.And, [term]);
	},
	/** The alternatives of a condition. */
	disjuncts(this: void, term: GuardTerm): readonly GuardTerm[] {
		return flatten(GuardFn.Or, [term]);
	},
	/** Whether the term is a literal `TRUE`. */
	isTrue(this: void, term: GuardTerm): boolean {
		return term.kind === 'constant' && term.value === true;
	},
	constantsOf
} as const;
