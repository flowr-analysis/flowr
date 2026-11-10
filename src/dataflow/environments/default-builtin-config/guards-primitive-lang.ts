import type { AnyBuiltInDefinition } from '../built-in-config';
import { BuiltInProcName } from '../built-in-proc-name';
import { ArgProp, CallProp } from '../built-in-props';
import { AnyType, RValueType, type GuardFacts, type RCondition, type RFailure, type ReturnedValue, type RValueTypes } from '../guard-facts';
import type { BrandedIdentifier } from '../identifier';
import { base, fn, Primitive, replacement } from './define-helpers';
import { Forced, sig } from './shared-signatures';

const { Null, Logical, Integer, Double, Character, List, Function: Fn, Environment, Language, Expression } = RValueType;

const is = (...predicates: readonly BrandedIdentifier[]): RCondition => predicates.length === 1 ? { is: predicates[0] } : { any: predicates.map(p => ({ is: p })) };
const not = (...predicates: readonly BrandedIdentifier[]): RCondition => ({ all: predicates.map(p => ({ not: { is: p } })) });
const any = (...conditions: readonly RCondition[]): RCondition => ({ any: conditions });
const all = (...conditions: readonly RCondition[]): RCondition => ({ all: conditions });
const length = (op: '==' | '<=' | '>=', to: number): RCondition => ({ length: op, to });
/** the condition holds of the value of another formal of the call */
const on = (formal: BrandedIdentifier, holds: RCondition): RCondition => ({ on: formal, holds });
const fails = (requires: RCondition, message: string, more: Omit<RFailure, 'requires' | 'message'> = {}): RFailure => ({ requires, message, ...more });
/** what R fails on unless the value of `formal` has a class attribute, which may bring a method of its own */
const unlessClassed = (formal: BrandedIdentifier, failure: RFailure): RFailure => ({ ...failure, requires: any(on(formal, is('is.object')), failure.requires) });
const Returns = (types: RValueTypes, more: Omit<ReturnedValue, 'types'> = {}): GuardFacts => ({ returns: { types, ...more } });
const Computes: GuardFacts = { computes: true };
const Scalar = length('==', 1);

/* a condition of more than one value only warned before R 4.2, which went by the first one */
const Condition: readonly RFailure[] = [
	fails(length('>=', 1), 'argument is of length zero'),
	fails(length('<=', 1), 'the condition has length > 1', { since: '4.2.0' }),
	fails({ not: { is: 'is.na' } }, 'missing value where TRUE/FALSE needed', { since: '4.2.0' }),
	fails(any(length('>=', 2), { not: { is: 'is.na' } }), 'missing value where TRUE/FALSE needed', { until: '4.2.0' })
];
const NotSubsettable = 'object of type ... is not subsettable';
const Dollar = fails(any(is('is.null'), all(is('is.recursive'), { not: { is: 'is.function' } })), '$ operator is invalid for atomic vectors', { dispatches: true });
const Subsettable = fails(not('is.function', 'is.environment', 'is.symbol'), NotSubsettable);
const ElementSubsettable = fails(not('is.function', 'is.symbol'), NotSubsettable);
/* what holds no attributes, though setting none at all, or `NULL`, works on everything */
const Attributable = all(not('is.null'), not('is.symbol', 'is.primitive'));
const UnlessNullValue = (holds: RCondition, message: string): RFailure => fails(any(on('value', is('is.null')), holds), message);
const NameString = (message: string): readonly RFailure[] => [
	fails(is('is.character'), message),
	fails(Scalar, message),
	fails({ not: { is: 'is.na' } }, message),
	fails({ compare: '>=', of: ['nchar'], to: 1 }, 'attempt to use zero-length variable name')
];
const OneString = (message: string): readonly RFailure[] => [fails(is('is.character'), message), fails(Scalar, message)];
const NativeName = { '.NAME': [fails(not('is.null', 'is.numeric', 'is.logical', 'is.complex', 'is.raw', 'is.function', 'is.environment', 'is.symbol', 'is.call'), 'first argument must be a string (of length 1) or native symbol reference')] };
/* `length(x) <- n` and `dim(x) <- d` truncate a number towards zero */
const Extent = [
	fails(Scalar, "wrong length for 'value' argument"),
	fails(any(is('is.numeric', 'is.character', 'is.object')), 'invalid value'),
	fails({ not: { is: 'is.na' } }, 'invalid value'),
	fails(any({ not: { is: 'is.numeric' } }, { compare: '>', to: -1 }), 'invalid value')
];

/**
 * What R checks of the arguments of the primitives of its language, its accessors and replacement functions, and the functions
 * handing out environments and calling into compiled code, and what they return, each verified against R.
 * An internal generic dispatches on a classed first argument, so a method may let anything through and return anything,
 * which states a failure of it only for an unclassed value (`unlessClassed`, `dispatches`) and what it returns as a case.
 * The primitives left out ask nothing of their arguments that flowR could state, or are syntax:
 * `@` (the `.Data` pseudo slot works on anything, S4 and S7 dispatch), `@<-`, `unclass`, `c`, `quote`, `.Internal`, `::`, `:::`,
 * `<-`, `<<-`, `=`, `{`, `function`, `repeat`, `break`, `next`, `return`, `browser`, `.cache_class`, and `missing`, whose argument is syntax.
 */
export const PrimitiveLanguageGuardFacts: Readonly<Record<BrandedIdentifier, GuardFacts>> = {
	'[':            { asks: { x: [{ ...Subsettable, dispatches: true }] }, computes: true },
	'[[':           { asks: { x: [{ ...ElementSubsettable, dispatches: true }] }, computes: true },
	'$':            { asks: { x: [Dollar] }, computes: true },
	'@':            Computes,
	'.subset':      { asks: { x: [Subsettable] }, computes: true },
	'.subset2':     { asks: { x: [ElementSubsettable] }, computes: true },
	'[<-':          { asks: { x: [{ ...Subsettable, dispatches: true }] } },
	'[[<-':         { asks: { x: [{ ...ElementSubsettable, dispatches: true }] } },
	'$<-':          { asks: { x: [{ ...ElementSubsettable, dispatches: true }] } },
	'attr':         { asks: { x: [], which: OneString("exactly one attribute 'which' must be given") }, computes: true },
	'attr<-':       { asks: { x: [UnlessNullValue(Attributable, 'cannot set an attribute on ...')], which: NameString("'name' must be non-null character string"), value: [] } },
	'attributes':   { ...Computes, ...Returns(List | Null) },
	'attributes<-': {
		asks: {
			x:     [fails(any(on('value', length('==', 0)), not('is.symbol', 'is.primitive')), 'cannot set an attribute on ...')],
			value: [fails(any(is('is.null'), all(is('is.list'), { not: { is: 'is.pairlist' } })), 'attributes must be a list or NULL')]
		}
	},
	'class':   { ...Computes, ...Returns(Character, { nonEmpty: true }) },
	'class<-': {
		asks: {
			x:     [UnlessNullValue(not('is.null'), 'attempt to set an attribute on NULL'), fails(any(on('value', length('==', 0)), not('is.symbol', 'is.primitive')), 'cannot set an attribute on ...')],
			value: [fails(not('is.function', 'is.environment'), "attempt to set invalid 'class' attribute")]
		}
	},
	'oldClass':   { ...Computes, ...Returns(Character | Null) },
	'oldClass<-': {
		asks: {
			x:     [fails(any(on('value', length('==', 0)), Attributable), 'cannot set an attribute on ...')],
			value: [fails(any(is('is.character'), length('==', 0)), "attempt to set invalid 'class' attribute")]
		}
	},
	'dim':   { ...Computes, ...Returns(Integer | Null, { notNA: true, count: true, dispatchesOn: 'x' }) },
	'dim<-': {
		asks: {
			x:     [unlessClassed('x', UnlessNullValue(is('is.atomic', 'is.list', 'is.expression'), 'invalid first argument, must be vector (list or atomic)'))],
			value: [
				unlessClassed('x', fails(is('is.null', 'is.atomic'), 'invalid second argument, must be vector or NULL')),
				unlessClassed('x', fails(any(is('is.null'), length('>=', 1)), 'length-0 dimension vector is invalid')),
				unlessClassed('x', fails({ not: { is: 'anyNA' } }, 'the dims contain missing values')),
				unlessClassed('x', fails(any(is('is.null'), { compare: '==', of: ['prod', 'as.integer'], to: { on: 'x', of: ['length'] } }), 'dims [product ...] do not match the length of object [...]'))
			]
		}
	},
	'dimnames':   { ...Computes, ...Returns(List | Null, { dispatchesOn: 'x' }) },
	'dimnames<-': {
		asks: {
			x:     [unlessClassed('x', UnlessNullValue({ not: { is: 'is.null', of: 'dim' } }, "'dimnames' applied to non-array"))],
			value: [unlessClassed('x', fails(is('is.null', 'is.list'), "'dimnames' must be a list"))]
		}
	},
	'names':   { ...Computes, ...Returns(Character | Null, { dispatchesOn: 'x' }) },
	'names<-': {
		asks: {
			x:     [unlessClassed('x', UnlessNullValue(not('is.null', 'is.function', 'is.environment', 'is.symbol'), 'names() applied to a non-vector'))],
			value: [
				unlessClassed('x', fails(not('is.function', 'is.environment'), "cannot coerce type ... to vector of type 'character'")),
				unlessClassed('x', fails(any(is('is.null'), { compare: '<=', of: ['length'], to: { on: 'x', of: ['length'] } }), "'names' attribute [...] must be the same length as the vector [...]"))
			]
		}
	},
	'levels<-': { asks: { x: [unlessClassed('x', UnlessNullValue(Attributable, 'cannot set an attribute on ...'))], value: [] } },
	'length<-': {
		asks: {
			x:     [unlessClassed('x', fails(not('is.function', 'is.environment', 'is.symbol', 'is.call'), 'cannot set length of non-(vector or list)'))],
			value: Extent.map(f => unlessClassed('x', f))
		}
	},
	'storage.mode<-': { asks: { x: [], value: [fails(is('is.character'), "'value' must be non-null character string"), fails(length('>=', 1), "'value' must be non-null character string")] } },
	'environment<-':  {
		asks: {
			fun:   [UnlessNullValue(not('is.null', 'is.symbol'), 'cannot set an attribute on ...')],
			value: [fails(is('is.environment', 'is.null'), 'replacement object is not an environment')]
		}
	},
	'list':           { ...Computes, ...Returns(List) },
	'expression':     { ...Computes, ...Returns(Expression) },
	/* `nchar(NA_character_)` is `NA` */
	'call':           { asks: { name: [...OneString('first argument must be a character string'), fails(any(is('is.na'), { compare: '>=', of: ['nchar'], to: 1 }), 'attempt to use zero-length variable name')] }, ...Computes, ...Returns(Language) },
	'as.call':        { asks: { x: [fails(is('is.list', 'is.call', 'is.expression'), 'invalid argument list'), fails(length('>=', 1), 'invalid length 0 argument')] }, ...Computes, ...Returns(Language) },
	'substitute':     { asks: { expr: [], env: [fails(is('is.null', 'is.environment', 'is.list'), 'invalid environment specified')] } },
	'invisible':      { asks: { x: [] }, computes: true, returns: 'argument' },
	'(':              { asks: { x: [] }, computes: true, returns: 'argument' },
	'as.environment': {
		asks: {
			x: [
				fails(not('is.null', 'is.logical', 'is.complex', 'is.raw', 'is.function', 'is.symbol', 'is.call', 'is.expression', 'is.pairlist'), "invalid object for 'as.environment'", { dispatches: true }),
				fails(any(is('is.list', 'is.environment'), length('>=', 1)), "invalid 'pos' argument", { dispatches: true })
			]
		},
		opensFrame: true
	},
	'pos.to.env': { asks: { x: [fails(length('>=', 1), "invalid 'pos' argument"), fails({ not: { is: 'anyNA' } }, "invalid 'pos' argument")] } },
	'baseenv':    Returns(Environment),
	'emptyenv':   Returns(Environment),
	'globalenv':  Returns(Environment),
	/* `...elt(2.9)` takes the second, `...elt(TRUE)` the first */
	'...elt':     {
		asks: {
			n: [
				fails(is('is.numeric', 'is.logical', 'is.object'), "indexing '...' with an invalid index"),
				fails(Scalar, "indexing '...' with an invalid index"),
				fails({ not: { is: 'is.na' } }, "indexing '...' with non-positive index"),
				fails({ compare: '>=', to: 1 }, "indexing '...' with non-positive index"),
				fails({ compare: '<=', of: ['trunc'], to: { call: '...length' } }, 'the ... list contains fewer than ... elements')
			]
		},
		computes: true
	},
	'...length':       { ...Computes, returns: { types: Integer, scalar: true, notNA: true, count: true } },
	'...names':        { ...Computes, ...Returns(Character | Null) },
	'nargs':           { ...Computes, returns: { types: Integer, scalar: true, notNA: true, count: true } },
	'missing':         { singleResult: true, returns: { types: Logical, scalar: true, notNA: true } },
	'on.exit':         { asks: { expr: [], add: [fails(length('>=', 1), "invalid 'add' argument")], after: [fails(length('>=', 1), "invalid 'lifo' argument")] } },
	'switch':          { asks: { EXPR: [fails(Scalar, 'EXPR must be a length 1 vector'), fails(not('is.function', 'is.environment', 'is.symbol', 'is.call', 'is.pairlist'), 'EXPR must be a length 1 vector')] } },
	'UseMethod':       { asks: { generic: OneString("'generic' argument must be a character string") } },
	'standardGeneric': { asks: { f: [fails(is('is.character'), "argument to 'standardGeneric' must be a non-empty character string"), fails(length('>=', 1), "argument to 'standardGeneric' must be a non-empty character string")] } },
	'forceAndCall':    { asks: { n: [], FUN: [fails(is('is.function'), 'attempt to apply non-function')] } },
	'Exec':            { asks: { expr: [fails(is('is.call'), '"expr" must be a call expression', { since: '4.4.0' })] }, opensFrame: true },
	'declare':         Returns(Null),
	'if':              { asks: { cond: Condition } },
	'while':           { asks: { cond: Condition } },
	/* a classed environment is not looped over either */
	'for':             { asks: { var: [], seq: [fails(not('is.function', 'is.environment', 'is.symbol', 'is.call'), 'invalid for() loop sequence')] } },
	'~':               Returns(Language),
	':':               {
		asks: {
			from: [fails(length('>=', 1), 'argument of length 0'), fails(is('is.numeric', 'is.logical', 'is.complex', 'is.character', 'is.object'), 'NA/NaN argument')],
			to:   [fails(length('>=', 1), 'argument of length 0'), fails(is('is.numeric', 'is.logical', 'is.complex', 'is.character', 'is.object'), 'NA/NaN argument')]
		},
		...Computes,
		...Returns(Integer | Double)
	},
	'.C':                   { asks: NativeName },
	'.Call':                { asks: NativeName },
	'.External':            { asks: NativeName },
	'.External2':           { asks: NativeName },
	'.Fortran':             { asks: NativeName },
	'.Call.graphics':       { asks: NativeName },
	'.External.graphics':   { asks: NativeName },
	'.Primitive':           { asks: { name: OneString('string argument required') }, ...Returns(Fn) },
	'.class2':              { ...Computes, ...Returns(Character, { nonEmpty: true }) },
	'.isMethodsDispatchOn': Returns(Logical, { scalar: true, notNA: true }),
	'.primTrace':           { asks: { obj: [fails(is('is.function', 'is.character'), 'argument must be a function')] } },
	'.primUntrace':         { asks: { obj: [fails(is('is.function', 'is.character'), 'argument must be a function')] } },
	'tracemem':             { asks: { x: [fails(not('is.null', 'is.function', 'is.environment'), 'argument must not be a function')] }, ...Returns(Character, { scalar: true, notNA: true }) },
	'untracemem':           { asks: { x: [fails({ not: { is: 'is.function' } }, 'argument must not be a function')] }, ...Returns(Null) },
	'retracemem':           { asks: { x: [fails({ not: { is: 'is.function' } }, 'argument must not be a function')], previous: [fails(any(is('is.null'), all(is('is.character'), Scalar)), "invalid 'previous' argument")] }, ...Returns(Null | Character) },
	'interactive':          Returns(Logical, { scalar: true, notNA: true }),
	'proc.time':            { ...Computes, ...Returns(Double) },
	/* before R 4.3 a longer one went by its first element */
	'gc.time':              { asks: { on: [fails(length('>=', 1), 'NA in coercion to boolean'), fails(Scalar, "'length = n' in coercion to 'logical(1)'", { since: '4.3.0' }), fails({ not: { is: 'is.na' } }, 'NA in coercion to boolean', { since: '4.3.0' })] }, ...Returns(Double) },
	'lazyLoadDBfetch':      { asks: { key: [], file: [fails(is('is.character'), 'not a proper file name')] } },
	'unCfillPOSIXlt':       { asks: { x: [fails(is('is.list'), 'a valid "POSIXlt" object is a list of at least 9 elements'), fails({ compare: '>=', of: ['length', 'unclass'], to: 9 }, 'a valid "POSIXlt" object is a list of at least 9 elements')] }, ...Returns(List) },
	/* `asS4(1)` is S4 without a class attribute, so this tells nothing of the type */
	'isS4':                 { predicate: { yes: AnyType } },
	/* the number of levels, which a comparison can bound like a length */
	'nlevels':              { measures: 'single' }
};

const Value = sig({ x: Forced.Value });

/** The functions {@link PrimitiveLanguageGuardFacts} speaks about that nothing else defines. */
export const PrimitiveLanguageDefinitions = [
	fn(base('attr'), BuiltInProcName.DefaultReadAllArgs, { props: CallProp.Pure, sig: sig({ x: Forced.Value, which: Forced.Value, exact: Forced.Flag }) }, Primitive),
	fn(base('.subset', '.subset2'), BuiltInProcName.DefaultReadAllArgs, { props: CallProp.Pure, sig: sig({ x: Forced.Value, '...': Forced.Value }) }, Primitive),
	fn(base('attributes', 'unclass', '.class2', 'untracemem', 'unCfillPOSIXlt'), BuiltInProcName.DefaultReadAllArgs, { props: CallProp.Pure, sig: Value }, Primitive),
	fn(base('nlevels'), BuiltInProcName.DefaultReadAllArgs, { props: CallProp.Pure, sig: Value }),
	fn(base('isS4'), BuiltInProcName.DefaultReadAllArgs, { props: CallProp.Pure, sig: sig({ object: Forced.Value }) }, Primitive),
	fn(base('tracemem'), BuiltInProcName.DefaultReadAllArgs, { sig: Value }, Primitive),
	fn(base('retracemem'), BuiltInProcName.DefaultReadAllArgs, { sig: sig({ x: Forced.Value, previous: Forced.Value }) }, Primitive),
	fn(base('gc.time'), BuiltInProcName.DefaultReadAllArgs, { sig: sig({ on: Forced.Flag }) }, Primitive),
	fn(base('.isMethodsDispatchOn'), BuiltInProcName.DefaultReadAllArgs, { sig: sig({ onOff: Forced.Flag }) }, Primitive),
	fn(base('.primTrace', '.primUntrace'), BuiltInProcName.DefaultReadAllArgs, { sig: sig({ obj: Forced.Value }) }, Primitive),
	fn(base('lazyLoadDBfetch'), BuiltInProcName.DefaultReadAllArgs, { sig: sig({ key: Forced.Value, file: Forced.Value, compressed: Forced.Value, hook: Forced.Value }) }, Primitive),
	fn(base('forceAndCall'), BuiltInProcName.DefaultReadAllArgs, { sig: sig({ n: Forced.Value, FUN: Forced.Value, '...': ArgProp.Value }) }, Primitive),
	fn(base('Exec'), BuiltInProcName.DefaultReadAllArgs, { sig: sig({ expr: Forced.Value, envir: Forced.Value }) }, Primitive),
	fn(base('declare'), BuiltInProcName.DefaultReadAllArgs, { props: CallProp.Pure, sig: sig({ '...': 0 }) }, Primitive),
	replacement(base('oldClass', 'storage.mode'), ['<-', '<<-'], { readIndices: true, props: CallProp.Scope })
] as const satisfies AnyBuiltInDefinition[];
