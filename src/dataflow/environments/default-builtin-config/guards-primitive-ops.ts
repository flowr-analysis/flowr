import type { AnyBuiltInDefinition } from '../built-in-config';
import { BuiltInProcName } from '../built-in-proc-name';
import { CallProp } from '../built-in-props';
import { AnyType, RValueType, type GuardFacts, type RCondition, type RFailure, type ReturnedValue, type RValueTypes, type TypePredicate } from '../guard-facts';
import type { BrandedIdentifier } from '../identifier';
import { base, fn, Primitive } from './define-helpers';
import { Forced, sig } from './shared-signatures';

const { Null, Logical, Integer, Double, Complex, Character, Raw, List, Pairlist, Function: Fn, Environment, Symbol, Language, Expression, Other } = RValueType;
const Numeric = Integer | Double;
const Atomic = Logical | Numeric | Complex | Character | Raw;

const is = (...predicates: readonly BrandedIdentifier[]): RCondition => predicates.length === 1 ? { is: predicates[0] } : { any: predicates.map(p => ({ is: p })) };
const not = (...predicates: readonly BrandedIdentifier[]): RCondition => ({ all: predicates.map(p => ({ not: { is: p } })) });
const fails = (requires: RCondition, message: string, more: Omit<RFailure, 'requires' | 'message'> = {}): readonly RFailure[] => [{ requires, message, ...more }];
/* a value with a class attribute, or a classed other operand, may bring a method of its own */
const dispatched = (requires: RCondition, message: string): readonly RFailure[] => fails(requires, message, { dispatches: true });
const predicate = (yes: RValueTypes, more: Omit<TypePredicate, 'yes'> = {}): TypePredicate => ({ yes, ...more });
/* what a method returns is up to the method, so this holds for a value without a class; with two operands or the dots to dispatch on, nothing is stated */
const Dispatched = (on: BrandedIdentifier, types: RValueTypes, more: Omit<ReturnedValue, 'types' | 'dispatchesOn'> = {}): ReturnedValue => ({ types, dispatchesOn: on, ...more });
const OneValue: readonly BrandedIdentifier[] = ['x'];

/* arrays work with arrays of the same dimensions, and with vectors no longer than they are unless they hold at most one element, a call being compared as its one deparsed line */
const NoDim: RCondition = { is: 'is.null', of: 'dim' };
function conformable(this: void, other: BrandedIdentifier): readonly RFailure[] {
	return [
		{ requires: { any: [NoDim, { on: other, holds: NoDim }, { compare: '==', of: ['length'], to: { on: other, of: ['length'] } }] }, message: 'non-conformable arrays', dispatches: true },
		{ requires: { any: [{ not: NoDim }, { is: 'is.call' }, { on: other, holds: NoDim }, { on: other, holds: { length: '<=', to: 1 } }, { compare: '<=', of: ['length'], to: { on: other, of: ['length'] } }] }, message: 'dims do not match the length of object', dispatches: true }
	];
}
/* `e1` and `e2` of an operator of the `Ops` group, each with what is asked of its type */
function operands(this: void, types: RCondition, message: string): GuardFacts['asks'] {
	return { e1: [...dispatched(types, message), ...conformable('e2')], e2: [...dispatched(types, message), ...conformable('e1')] };
}

const Calculable = is('is.numeric', 'is.logical', 'is.complex', 'is.null');
const NonNumeric = 'non-numeric argument to binary operator';
const Arithmetic: GuardFacts = { asks: operands(Calculable, NonNumeric), computes: true };
/* the remainder of complex numbers fails only once there is one to compute */
/* `quote(a) == "a"` compares the deparsed call, while an order of a symbol or call is an error */
const Compared = (operator: string, ordered: boolean): GuardFacts => ({
	asks:     operands(ordered ? not('is.function', 'is.environment', 'is.symbol', 'is.call') : not('is.function', 'is.environment'), `comparison (${operator}) is possible only for atomic and list types`),
	computes: true
});
const Elementwise: GuardFacts = { asks: operands(is('is.numeric', 'is.logical', 'is.complex', 'is.raw', 'is.null'), 'operations are possible only for numeric, logical or complex types'), computes: true };
/* no dispatch happens, but a class like `Date` may hide a number from `is.numeric`, and an empty operand reads as `NA` */
const LogicalOperand = (operand: string, operator: string): readonly RFailure[] => [
	{ requires: is('is.logical', 'is.numeric', 'is.complex', 'is.object'), message: `invalid '${operand}' type in 'x ${operator} y'` },
	{ requires: { length: '<=', to: 1 }, message: "'length = n' in coercion to 'logical(1)'", since: '4.3.0' }
];
/* R looks at the right operand unless the left one decides, which `isTRUE` and `isFALSE` rule out */
const Logicals = (operator: string, decidesNot: BrandedIdentifier): GuardFacts => ({
	singleResult: true,
	returns:      { types: Logical, scalar: true },
	asks:         { x: LogicalOperand('x', operator), y: LogicalOperand('y', operator).map(failure => ({ ...failure, when: { of: 'x', holds: { is: decidesNot } } })) }
});

const InvalidType = "invalid 'type' of argument";
const Summed: GuardFacts = { asks: { '...': dispatched(Calculable, InvalidType) }, computes: true };
const Ordered: GuardFacts = { asks: { '...': dispatched(is('is.numeric', 'is.logical', 'is.character', 'is.null'), InvalidType) }, computes: true };
/* `range.default`, which the primitive runs, flattens lists and expressions first */
const Ranged: GuardFacts = { asks: { '...': dispatched(is('is.numeric', 'is.logical', 'is.character', 'is.null', 'is.list', 'is.expression'), InvalidType) }, computes: true };
/* `all("a")` is `NA`, and `all(new.env())` holds, as an environment is empty to it */
const Quantified: GuardFacts = { asks: { '...': dispatched(not('is.function', 'is.symbol', 'is.call'), 'cannot coerce to logical') }, computes: true, singleResult: true };
const ComplexPart = (returns: RValueTypes): GuardFacts => ({ asks: { z: dispatched(is('is.numeric', 'is.logical', 'is.complex'), 'non-numeric argument to function') }, required: ['z'], computes: true, returns: Dispatched('z', returns) });

/* a matrix product asks for numbers, and of two matrices for the dimensions to match */
const Multiplied = is('is.numeric', 'is.logical', 'is.complex');
const NotMatrix: RCondition = { not: { is: 'is.matrix' } };
const MatrixArgs = 'requires numeric/complex matrix/vector arguments';
function product(this: void, rows: BrandedIdentifier, columns: BrandedIdentifier, y: RCondition): GuardFacts {
	const matching: RCondition = { any: [NotMatrix, { on: 'y', holds: NotMatrix }, { compare: '==', of: [rows], to: { on: 'y', of: [columns] } }] };
	return {
		asks:     { x: [...dispatched(Multiplied, MatrixArgs), ...dispatched(matching, 'non-conformable arguments')], y: dispatched(y, MatrixArgs) },
		required: ['x'],
		computes: true
	};
}

/* coercing a vector goes element by element, which only fails for what is no vector */
const Coerced = (returns: RValueTypes, from: RCondition): GuardFacts => ({ asks: { x: dispatched(from, 'cannot coerce to vector') }, computes: true, returns: Dispatched('x', returns) });
const ToNumbers = not('is.function', 'is.environment', 'is.symbol', 'is.call', 'is.expression');
const ToText = not('is.function', 'is.environment');

const Predicate = (yes: TypePredicate): GuardFacts => ({ predicate: yes, required: OneValue });
/* the internal generics among them may have a method decide for a classed value */
const Generic = (yes: RValueTypes, more: Omit<TypePredicate, 'yes' | 'classedToo'> = {}): GuardFacts => Predicate(predicate(yes, { ...more, classedToo: AnyType }));
const Exact = (yes: RValueTypes): GuardFacts => Predicate(predicate(yes, { exact: true }));
/* `is.finite` and its kin are only defined for atomic vectors */
const Classified: GuardFacts = { asks: { x: dispatched(is('is.atomic', 'is.null'), 'default method not implemented for type') }, required: OneValue, computes: true, returns: Dispatched('x', Logical) };

/** a single number is at least 0, R rejects even `-0.5` as a length */
const SingleNonNegative: RCondition = { any: [{ not: { is: 'is.numeric' } }, { length: '>=', to: 2 }, { compare: '>=', to: 0 }] };

/**
 * What the operators and the functions of the `Ops`, `Summary`, `Complex`, and `matrixOps` groups ask of their arguments, together with
 * R's sequences and its type predicates and coercions, each read off R 4.6.1.
 * What is asked of a value that may dispatch holds only without a class attribute.
 */
export const PrimitiveOpsGuardFacts: Readonly<Record<BrandedIdentifier, GuardFacts>> = {
	'+':              Arithmetic,
	'-':              Arithmetic,
	'*':              Arithmetic,
	'/':              Arithmetic,
	'^':              Arithmetic,
	'%%':             Arithmetic,
	'%/%':            Arithmetic,
	'==':             Compared('==', false),
	'!=':             Compared('!=', false),
	'<':              Compared('<', true),
	'<=':             Compared('<=', true),
	'>':              Compared('>', true),
	'>=':             Compared('>=', true),
	'&':              Elementwise,
	'|':              Elementwise,
	'!':              { asks: { x: dispatched({ any: [is('is.numeric', 'is.logical', 'is.complex', 'is.raw'), { length: '==', to: 0 }] }, 'invalid argument type') }, computes: true, returns: Dispatched('x', Logical | Raw) },
	'&&':             Logicals('&&', 'isTRUE'),
	'||':             Logicals('||', 'isFALSE'),
	'sum':            Summed,
	'prod':           Summed,
	'max':            Ordered,
	'min':            Ordered,
	'range':          Ranged,
	'all':            Quantified,
	'any':            Quantified,
	'Re':             ComplexPart(Double),
	'Im':             ComplexPart(Double),
	'Mod':            ComplexPart(Double),
	'Arg':            ComplexPart(Double),
	'Conj':           ComplexPart(Double | Complex),
	'%*%':            { ...product('ncol', 'nrow', Multiplied), required: ['x', 'y'] },
	'crossprod':      product('nrow', 'nrow', is('is.numeric', 'is.logical', 'is.complex', 'is.null')),
	'tcrossprod':     product('ncol', 'ncol', is('is.numeric', 'is.logical', 'is.complex', 'is.null')),
	/* the first element is the length, a string like `"3"` and the codes of a factor included */
	'seq_len':        { asks: { 'length.out': fails({ all: [{ is: 'is.atomic' }, { not: { is: 'is.raw' } }, { length: '>=', to: 1 }, SingleNonNegative] }, 'argument must be coercible to non-negative integer') }, required: ['length.out'], computes: true, returns: { types: Numeric, notNA: true, count: true } },
	'seq_along':      { required: ['along.with'], computes: true, returns: { types: Numeric, notNA: true, count: true } },
	'rep':            { asks: { x: dispatched(not('is.function', 'is.symbol', 'is.call'), 'attempt to replicate an object of this type') }, computes: true },
	'xtfrm':          { asks: { x: dispatched(not('is.function', 'is.environment', 'is.symbol', 'is.call', 'is.raw'), 'cannot be sorted') }, required: OneValue, computes: true },
	'nzchar':         { asks: { x: fails(not('is.function', 'is.environment'), 'cannot coerce to character') }, required: OneValue, computes: true, returns: { types: Logical } },
	'enc2native':     { asks: { x: fails(is('is.character'), 'argument is not a character vector') }, required: OneValue, computes: true, returns: { types: Character } },
	'enc2utf8':       { asks: { x: fails(is('is.character'), 'argument is not a character vector') }, required: OneValue, computes: true, returns: { types: Character } },
	'is.null':        Exact(Null),
	'is.logical':     Exact(Logical),
	'is.integer':     Predicate(predicate(Integer, { exact: 'unclassed' })),
	'is.double':      Exact(Double),
	'is.complex':     Exact(Complex),
	'is.character':   Exact(Character),
	'is.raw':         Exact(Raw),
	'is.function':    Predicate(predicate(Fn, { exact: true, callable: true })),
	'is.environment': Predicate(predicate(Environment, { exact: true, classedToo: Other })),
	'is.symbol':      Predicate(predicate(Symbol, { exact: true, callable: true })),
	'is.name':        Predicate(predicate(Symbol, { exact: true, callable: true })),
	'is.call':        Exact(Language),
	'is.expression':  Exact(Expression),
	'is.language':    Exact(Symbol | Language | Expression),
	'is.list':        Exact(List | Pairlist),
	'is.pairlist':    Exact(Null | Pairlist),
	/* `is.numeric` is false for a factor, so it is not exact */
	'is.numeric':     Generic(Numeric, { plain: true }),
	'is.atomic':      { ...Predicate(predicate(Atomic, { exact: true, plain: true })), changed: [{ until: '4.4.0', facts: Predicate(predicate(Atomic | Null, { exact: true, plain: true })) }] },
	'is.recursive':   Predicate(predicate(List | Pairlist | Fn | Environment | Language | Expression | Other)),
	'is.matrix':      Generic(Atomic | List | Expression),
	'is.array':       Generic(Atomic | List | Expression),
	'is.object':      Predicate(predicate(AnyType, { classed: true })),
	'is.na':          { required: OneValue, computes: true },
	'is.finite':      Classified,
	'is.infinite':    Classified,
	'is.nan':         Classified,
	/* R has no single precision, so it fails whatever it is handed */
	'is.single':      { asks: { x: fails({ any: [] }, 'type "single" unimplemented in R') }, required: OneValue },
	'as.integer':     Coerced(Integer, ToNumbers),
	'as.double':      Coerced(Double, ToNumbers),
	'as.numeric':     Coerced(Double, ToNumbers),
	'as.logical':     Coerced(Logical, ToNumbers),
	'as.complex':     Coerced(Complex, ToNumbers),
	'as.raw':         Coerced(Raw, ToNumbers),
	'as.character':   Coerced(Character, ToText),
};

/** The functions above nothing else defines. */
export const PrimitiveOpsGuardDefinitions = [
	fn(base('xtfrm', 'enc2native', 'enc2utf8'), BuiltInProcName.DefaultReadAllArgs, { props: CallProp.Pure, sig: sig({ x: Forced.Value }) }, Primitive)
] as const satisfies AnyBuiltInDefinition[];
