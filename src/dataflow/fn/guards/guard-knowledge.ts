import type { BrandedIdentifier, BrandedNamespace } from '../../environments/identifier';
import { GuardTerm, type GuardCall } from './guard-term';

/** The type of a value as R's `typeof` tells it, as a bitfield, with the three kinds of functions as one and the rest of what R has as {@link RValueType.Other}. */
export enum RValueType {
	Null        = 1 << 0,
	Logical     = 1 << 1,
	Integer     = 1 << 2,
	Double      = 1 << 3,
	Complex     = 1 << 4,
	Character   = 1 << 5,
	Raw         = 1 << 6,
	List        = 1 << 7,
	Pairlist    = 1 << 8,
	Function    = 1 << 9,
	Environment = 1 << 10,
	Symbol      = 1 << 11,
	Language    = 1 << 12,
	Expression  = 1 << 13,
	/** `S4`, `externalptr`, and the like */
	Other       = 1 << 14
}

/** a bitfield of {@link RValueType} */
export type RValueTypes = number;

/** What R has as a value at all. */
export const AnyType: RValueTypes = (1 << 15) - 1;

const { Null, Logical, Integer, Double, Complex, Character, Raw, List, Pairlist, Function: Fn, Environment, Symbol, Language, Expression, Other } = RValueType;
const Numeric = Integer | Double;
const Atomic = Logical | Numeric | Complex | Character | Raw;

/** The names of the types, in the order of their bits, as `typeof` spells them. */
const TypeNames: readonly (readonly [RValueType, string])[] = [
	[Null, 'NULL'], [Logical, 'logical'], [Integer, 'integer'], [Double, 'double'], [Complex, 'complex'], [Character, 'character'],
	[Raw, 'raw'], [List, 'list'], [Pairlist, 'pairlist'], [Fn, 'function'], [Environment, 'environment'], [Symbol, 'symbol'],
	[Language, 'language'], [Expression, 'expression'], [Other, 'other']
];

/** The names of the given types, see {@link TypeNames}. */
export function typeNames(this: void, types: RValueTypes): string[] {
	return TypeNames.filter(([bit]) => (types & bit) !== 0).map(([, name]) => name);
}

/** What a predicate over one value says about the type of the value. */
export interface TypePredicate {
	/** the types it can be true for */
	readonly yes:      RValueTypes
	/** it tells these types and no other, so finding it false rules them out as well */
	readonly exact?:   boolean
	/** only true for a value with a class attribute, like `is.data.frame` */
	readonly classed?: boolean
	/** only true for something of length one */
	readonly scalar?:  boolean
}

const exact = (yes: RValueTypes): TypePredicate => ({ yes, exact: true });
const scalar = (yes: RValueTypes): TypePredicate => ({ yes, scalar: true });

/** The predicates flowR can read a type off, verified against R (`is.numeric` is false for a factor, so it is not exact). */
export const TypePredicates: Readonly<Record<BrandedIdentifier, TypePredicate>> = {
	'is.null':             exact(Null),
	'is.logical':          exact(Logical),
	'is.integer':          exact(Integer),
	'is.double':           exact(Double),
	'is.complex':          exact(Complex),
	'is.character':        exact(Character),
	'is.raw':              exact(Raw),
	'is.function':         exact(Fn),
	'is.environment':      exact(Environment),
	'is.symbol':           exact(Symbol),
	'is.name':             exact(Symbol),
	'is.call':             exact(Language),
	'is.expression':       exact(Expression),
	'is.language':         exact(Symbol | Language | Expression),
	'is.list':             exact(List | Pairlist),
	'is.pairlist':         exact(Null | Pairlist),
	'is.numeric':          { yes: Numeric },
	/* `is.atomic(NULL)` is true before R 4.4 */
	'is.atomic':           { yes: Atomic | Null },
	'is.vector':           { yes: Atomic | List | Expression },
	'is.recursive':        { yes: List | Pairlist | Fn | Environment | Language | Expression | Other },
	'is.primitive':        { yes: Fn },
	'is.matrix':           { yes: Atomic | List | Expression },
	'is.array':            { yes: Atomic | List | Expression },
	'is.data.frame':       { yes: List, classed: true },
	'is.factor':           { yes: Integer, classed: true },
	'is.ordered':          { yes: Integer, classed: true },
	'is.object':           { yes: AnyType, classed: true },
	'is_null':             exact(Null),
	'is_logical':          { yes: Logical },
	'is_integer':          { yes: Integer },
	'is_double':           { yes: Double },
	'is_complex':          { yes: Complex },
	'is_character':        { yes: Character },
	'is_raw':              { yes: Raw },
	'is_function':         { yes: Fn },
	'is_environment':      { yes: Environment },
	'is_list':             { yes: List | Pairlist },
	'is_string':           scalar(Character),
	'is_bool':             scalar(Logical),
	'is_scalar_logical':   scalar(Logical),
	'is_scalar_integer':   scalar(Integer),
	'is_scalar_double':    scalar(Double),
	'is_scalar_complex':   scalar(Complex),
	'is_scalar_character': scalar(Character),
	'is_scalar_list':      scalar(List | Pairlist)
};

/** What `typeof(x)`, `mode(x)`, and `storage.mode(x)` return, by the types they return it for. */
export const TypeReaders: Readonly<Record<BrandedIdentifier, Readonly<Record<string, RValueTypes>>>> = {
	typeof: Object.fromEntries([...TypeNames.map(([bit, name]) => [name, bit] as const), ['closure', Fn], ['builtin', Fn], ['special', Fn]]),
	mode:   { numeric: Numeric, logical: Logical, character: Character, complex: Complex, raw: Raw, list: List | Pairlist, function: Fn, environment: Environment, NULL: Null, name: Symbol, call: Language, '(': Language, expression: Expression, S4: Other }
};

/** The calls reading a number off a value, which a comparison can then bound. */
export const Measures: ReadonlySet<BrandedIdentifier> = new Set(['length', 'nchar', 'nrow', 'ncol', 'NROW', 'NCOL']);

/** What not failing says about the argument a checking call was handed. */
export interface CheckingCall {
	readonly types?:   RValueTypes
	readonly classed?: boolean
	/** the argument naming the only values allowed */
	readonly choices?: BrandedIdentifier
	/** partial matches of the choices also pass */
	readonly partial?: boolean
	/** a length-one value is all that passes */
	readonly scalar?:  boolean
	/** the arguments that let more through, each with the types it may add; anything else they take (`len`, `lower`) only narrows */
	readonly loosens?: Readonly<Record<BrandedIdentifier, RValueTypes>>
	/** the arguments that keep it from failing at once, so not even the check itself is a guard, like `add` */
	readonly defers?:  readonly BrandedIdentifier[]
	/** failing is all it does when the argument was not given */
	readonly present?: boolean
	/** the package providing it, none for what R ships with */
	readonly pkg?:     BrandedNamespace
}

const Check = { loosens: { 'null.ok': Null, 'na.ok': Atomic }, defers: ['add'], pkg: 'checkmate' };
/* checkmate lets an empty vector and one of nothing but `NA` pass, whichever type it asks for, so its vector checks only tell atomic from the rest */
const checkmate: CheckingCall = { ...Check, types: Atomic };
const checkmateScalar = (types: RValueTypes): CheckingCall => ({ ...Check, types, scalar: true });

const CheckmateChecks: Readonly<Record<BrandedIdentifier, CheckingCall>> = {
	numeric:     checkmate,
	integer:     checkmate,
	double:      checkmate,
	character:   checkmate,
	logical:     checkmate,
	complex:     checkmate,
	number:      checkmateScalar(Numeric),
	string:      checkmateScalar(Character),
	flag:        checkmateScalar(Logical),
	function:    { ...Check, types: Fn },
	environment: { ...Check, types: Environment },
	list:        { ...Check, types: List },
	data_frame:  { ...Check, types: List, classed: true }
};

/** The spelling checkmate has next to `assert_data_frame`, namely `assertDataFrame`. */
function camelCased(this: void, name: BrandedIdentifier): BrandedIdentifier {
	return `assert${name.split('_').map(part => part[0].toUpperCase() + part.slice(1)).join('')}`;
}

/** The calls whose not failing says something about their first argument, verified against the respective package. */
export const CheckingCalls: Readonly<Record<BrandedIdentifier, CheckingCall>> = {
	'match.arg':      { types: Character | Null, choices: 'choices', partial: true },
	'arg_match':      { types: Character, choices: 'values', pkg: 'rlang' },
	/* takes a symbol as well, unlike `arg_match` */
	'arg_match0':     { types: Character | Symbol, choices: 'values', pkg: 'rlang' },
	...Object.fromEntries(Object.entries(CheckmateChecks).flatMap(([name, check]) => [[`assert_${name}`, check], [camelCased(name), check]])),
	'check_required': { present: true, pkg: 'rlang' },
	'assert_choice':  { ...Check, choices: 'choices' },
	'assertChoice':   { ...Check, choices: 'choices' }
};

const is = (fn: BrandedIdentifier, of: GuardTerm): GuardTerm => GuardTerm.known(fn, of);
const anyOf = (fns: readonly BrandedIdentifier[]): (of: GuardTerm) => GuardTerm => of => GuardTerm.any(...fns.map(fn => is(fn, of)));
const isObject = (of: GuardTerm): GuardTerm => is('is.object', of);
const hasLength = (of: GuardTerm, length: string): GuardTerm => GuardTerm.known('==', is('length', of), { kind: 'constant', lexeme: length, value: Number(length) });

/** The name of a function as a string in R, for `exists`. */
function exists(this: void, of: GuardTerm): GuardTerm {
	return { kind: 'call', fn: 'exists', known: true, args: [{ value: of }, { name: 'mode', value: GuardTerm.string('function') }] };
}

const Arithmetic = anyOf(['is.numeric', 'is.logical', 'is.complex', 'is.null']);
const Mathematical = anyOf(['is.numeric', 'is.logical', 'is.complex']);
const NotLogical = (of: GuardTerm): GuardTerm => GuardTerm.any(is('is.numeric', of), is('is.logical', of), is('is.complex', of), is('is.raw', of), hasLength(of, '0'));
const NotAFunction = (of: GuardTerm): GuardTerm => GuardTerm.known('!', is('is.function', of));
const Comparable = (of: GuardTerm): GuardTerm => GuardTerm.all(NotAFunction(of), GuardTerm.known('!', is('is.environment', of)));
const Subsettable = (of: GuardTerm): GuardTerm => GuardTerm.all(NotAFunction(of), GuardTerm.known('!', is('is.environment', of)), GuardTerm.known('!', is('is.symbol', of)));
const ElementSubsettable = (of: GuardTerm): GuardTerm => GuardTerm.all(NotAFunction(of), GuardTerm.known('!', is('is.symbol', of)));
const Dollar = (of: GuardTerm): GuardTerm => GuardTerm.any(is('is.null', of), GuardTerm.all(is('is.recursive', of), NotAFunction(of)));
const IsCharacter = (of: GuardTerm): GuardTerm => is('is.character', of);
const IsList = (of: GuardTerm): GuardTerm => is('is.list', of);
const IsLogical = (of: GuardTerm): GuardTerm => is('is.logical', of);
const IsEnvironment = (of: GuardTerm): GuardTerm => is('is.environment', of);
const HasDim = (of: GuardTerm): GuardTerm => GuardTerm.known('!', is('is.null', is('dim', of)));
const Named = (of: GuardTerm): GuardTerm => GuardTerm.any(is('is.character', of), is('is.symbol', of));

/** Whether the term spells out a name at run time, like `paste0("f_", x)`. */
export function composesName(this: void, term: GuardTerm): boolean {
	return GuardTerm.isCall(term) && term.known === true && (term.fn === 'paste0' || term.fn === 'paste' || term.fn === 'sprintf');
}

/**
 * What it takes for `of` to be called, or to be handed to something calling it.
 * A name not bound to a function makes R look further for a function of that very name, so a function of the name `FUN` lets anything through.
 * When flowR knows of such a function, there is nothing to claim.
 */
export function callable(this: void, of: GuardTerm, resolves: (name: BrandedIdentifier) => boolean, byName = true): GuardTerm {
	if(composesName(of)) {
		return exists(of);
	} else if(of.kind !== 'formal') {
		return GuardTerm.True;
	} else if(resolves(of.name)) {
		return GuardTerm.True;
	}
	const own = exists(GuardTerm.string(String(of.name)));
	return byName ? GuardTerm.any(is('is.function', of), GuardTerm.all(is('is.character', of), exists(of)), is('is.symbol', of), own)
		: GuardTerm.any(is('is.function', of), own);
}

/** The escape of what dispatches: a classed value may bring a method of its own. */
function dispatched(this: void, plain: (of: GuardTerm) => GuardTerm): Requirement {
	return (of, other) => GuardTerm.any(plain(of), isObject(of), ...(other === undefined || other.kind === 'constant' ? [] : [isObject(other)]));
}

/** What a built-in asks of the value bound to one of its formals, `other` being the second operand of an operator. */
export type Requirement = (of: GuardTerm, other?: GuardTerm) => GuardTerm;

/** The formals of a built-in, with what each of them is asked for. */
export type RequirementsOf = Readonly<Record<BrandedIdentifier, Requirement | undefined>>;

const ArithmeticOperands: RequirementsOf = { e1: dispatched(Arithmetic), e2: dispatched(Arithmetic) };
const ComparedOperands: RequirementsOf = { e1: dispatched(Comparable), e2: dispatched(Comparable) };
const Math: RequirementsOf = { x: dispatched(Mathematical) };
const Summary: RequirementsOf = { '...': dispatched(Arithmetic) };
const Strings: RequirementsOf = { x: IsCharacter };
const Pathed: RequirementsOf = { path: IsCharacter };

/** What the operations R ships with fail on, whatever else they do. Every entry is verified against R, and a dispatching one leaves out classed values. */
export const Requirements: Readonly<Record<BrandedIdentifier, RequirementsOf>> = {
	'+':           ArithmeticOperands,
	'-':           ArithmeticOperands,
	'*':           ArithmeticOperands,
	'/':           ArithmeticOperands,
	'^':           ArithmeticOperands,
	'%%':          ArithmeticOperands,
	'%/%':         ArithmeticOperands,
	'<':           ComparedOperands,
	'<=':          ComparedOperands,
	'>':           ComparedOperands,
	'>=':          ComparedOperands,
	'==':          ComparedOperands,
	'!=':          ComparedOperands,
	'!':           { x: dispatched(NotLogical) },
	'$':           { x: dispatched(Dollar) },
	'[':           { x: dispatched(Subsettable) },
	'[[':          { x: dispatched(ElementSubsettable) },
	'sqrt':        Math,
	'abs':         Math,
	'exp':         Math,
	'log':         Math,
	'floor':       Math,
	'ceiling':     Math,
	'round':       Math,
	'sum':         Summary,
	'prod':        Summary,
	'strsplit':    Strings,
	'startsWith':  Strings,
	'endsWith':    Strings,
	'basename':    Pathed,
	'dirname':     Pathed,
	'sprintf':     { fmt: IsCharacter },
	'file.exists': { '...': IsCharacter },
	'dir.exists':  { paths: IsCharacter },
	'which':       { x: IsLogical },
	'new.env':     { parent: IsEnvironment },
	'do.call':     { args: IsList },
	'apply':       { X: HasDim },
	'assign':      { x: IsCharacter },
	'get':         { x: Named },
	'exists':      { x: Named }
};

/** The built-ins applying what they are handed at once, with the formal holding it. */
export const Appliers: Readonly<Record<BrandedIdentifier, BrandedIdentifier>> = {
	'match.fun': 'FUN', 'lapply': 'FUN', 'sapply': 'FUN', 'vapply': 'FUN', 'mapply': 'FUN', 'do.call': 'what', 'Map': 'f', 'Reduce': 'f', 'Filter': 'f'
};

/** The calls failing unless every argument is a single `TRUE`, as `stopifnot` does in other packages, with their package and the arguments that are no conditions. */
export const Asserting: Readonly<Record<BrandedIdentifier, { readonly pkg: BrandedNamespace, readonly options: ReadonlySet<BrandedIdentifier> }>> = {
	'assert_that': { pkg: 'assertthat', options: new Set(['msg', 'env']) }
};

/** What a boolean `||`/`&&` asks of each of its operands: one value at most, as an empty one still reads as `NA`, and no dispatch happens, but a class like `Date` may well hide a number from `is.numeric`. */
export function logicalOperand(this: void, of: GuardTerm): GuardTerm {
	const atMostOne = GuardTerm.known('<=', is('length', of), { kind: 'constant', lexeme: '1', value: 1 });
	return GuardTerm.all(GuardTerm.any(is('is.logical', of), is('is.numeric', of), is('is.complex', of), isObject(of)), atMostOne);
}

/** What `if` and `while` ask of a condition. */
export function condition(this: void, of: GuardTerm): GuardTerm {
	return GuardTerm.all(hasLength(of, '1'), GuardTerm.known('!', is('is.na', of)));
}

/** `succeeds(call)`, see {@link GuardTerm}. */
export function succeeds(this: void, call: GuardCall): GuardTerm {
	return GuardTerm.known('succeeds', call);
}

/** Whether `get(x)` for the name `x` is the same as `exists(x)`, to state it as such: only as long as it looks in the same place. */
export function getAsExists(this: void, call: GuardCall): GuardTerm {
	const others = call.args.slice(1);
	if(others.length === 0 || (others.length === 1 && others[0].name === 'mode')) {
		return { ...call, fn: 'exists' };
	}
	return succeeds(call);
}
