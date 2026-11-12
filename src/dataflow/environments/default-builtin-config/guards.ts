import type { AnyBuiltInDefinition, BuiltInDefinitions } from '../built-in-config';
import { BuiltInProcName } from '../built-in-proc-name';
import { ArgProp, CallProp } from '../built-in-props';
import { RValueType, type CheckingCall, type GuardFacts, type RFailure, type ReturnedValue, type RValueTypes, type TypePredicate } from '../guard-facts';
import { Identifier, PkgName, type BrandedIdentifier, type BrandedNamespace } from '../identifier';
import { AttachedBasePackageSet } from '../../../util/r-base-packages';
import { base, fn, pkg, Primitive } from './define-helpers';
import { Forced, sig } from './shared-signatures';
import { PrimitiveLanguageGuardFacts } from './guards-primitive-lang';
import { PrimitiveOpsGuardFacts } from './guards-primitive-ops';
import { RGroupGenerics } from '../group-generics';
import { Atomic, Computes, dispatched, each, fails, is, not, Numeric, Returns } from './guard-builders';

const { Null, Logical, Integer, Double, Complex, Character, Raw, List, Pairlist, Function: Fn, Environment, Symbol, Language, Expression, Other } = RValueType;

/** Spelled the way the facts below read best. */
const predicate = (yes: RValueTypes, more: Omit<TypePredicate, 'yes'> = {}): GuardFacts => ({ predicate: { yes, ...more } });
const exact = (yes: RValueTypes): GuardFacts => predicate(yes, { exact: true });
const scalar = (yes: RValueTypes): GuardFacts => predicate(yes, { scalar: true });
const OneTruth: ReturnedValue = { types: Logical, scalar: true, notNA: true };
const SingleResult: GuardFacts = { computes: true, singleResult: true, returns: OneTruth };
const OpensFrame: GuardFacts = { opensFrame: true };


/* what R fails on by itself, each read off R; a dispatching one lets a classed value through, which may bring a method */
const Mathematical = dispatched(is('is.numeric', 'is.logical', 'is.complex'), 'non-numeric argument to mathematical function');
/* the members of the `Math` group with no complex version, which fail with 'unimplemented complex function' for one */
const RealMathematical = dispatched(is('is.numeric', 'is.logical'), 'non-numeric argument to mathematical function');
/* the cumulative ones coerce what they get to a number, which only a function, an environment, and the language cannot be, and the extremes do not order complex numbers, of which an empty vector has none */
const Cumulated = dispatched(not('is.function', 'is.environment', 'is.language'), "cannot coerce type ... to vector of type 'double'");
const Ordered = (name: string): readonly RFailure[] => [...Cumulated, ...dispatched({ any: [{ not: { is: 'is.complex' } }, { length: '==', to: 0 }] }, `'${name}' not defined for complex numbers`)];
const Text = (message: string): readonly RFailure[] => fails(is('is.character'), message);
const Applied = fails({ callable: true }, "'%s' is not a function, character or symbol");

const Math = { asks: { x: Mathematical } };
const RealMathNames: ReadonlySet<string> = new Set(['sign', 'floor', 'ceiling', 'trunc', 'expm1', 'log1p', 'cospi', 'sinpi', 'tanpi', 'gamma', 'lgamma', 'digamma', 'trigamma']);
const RealMath = { asks: { x: RealMathematical } };
const Prefixed = { asks: { x: Text('non-character object(s)') } };
const Pathed = { asks: { path: Text('a character vector argument expected') } };

/* `typeof` names each function kind on its own, `mode` lumps them */
const TypeOf: Readonly<Record<string, RValueTypes>> = {
	NULL:        Null, logical:     Logical, integer:     Integer, double:      Double, complex:     Complex, character:   Character, raw:         Raw, list:        List, pairlist:    Pairlist, function:    Fn, closure:     Fn, builtin:     Fn, special:     Fn,
	environment: Environment, symbol:      Symbol, language:    Language, expression:  Expression, other:       Other
};
const ModeOf: Readonly<Record<string, RValueTypes>> = { numeric: Numeric, logical: Logical, character: Character, complex: Complex, raw: Raw, list: List | Pairlist, function: Fn, environment: Environment, NULL: Null, name: Symbol, call: Language, '(': Language, expression: Expression, S4: Other };

const Check = { loosens: { 'null.ok': Null, 'na.ok': Atomic }, defers: ['add'] };
/* checkmate lets an empty vector and one of nothing but `NA` pass, whichever type it asks for, so its vector checks only tell atomic from the rest */
const checkmateVector: CheckingCall = { ...Check, types: Atomic };
const checkmateScalar = (types: RValueTypes): CheckingCall => ({ ...Check, types, scalar: true });
const CheckmateChecks: Readonly<Record<BrandedIdentifier, CheckingCall>> = {
	numeric:     checkmateVector,
	integer:     checkmateVector,
	double:      checkmateVector,
	character:   checkmateVector,
	logical:     checkmateVector,
	complex:     checkmateVector,
	number:      checkmateScalar(Numeric),
	string:      checkmateScalar(Character),
	flag:        checkmateScalar(Logical),
	function:    { ...Check, types: Fn },
	environment: { ...Check, types: Environment | Other },
	list:        { ...Check, types: List },
	data_frame:  { ...Check, types: List, classed: true },
	choice:      { ...Check, choices: 'choices' }
};

/** The spelling of checkmate's assertion of a check, like `assert_data_frame`. */
function snakeCased(this: void, name: BrandedIdentifier): BrandedIdentifier {
	return `assert_${name}`;
}

/** The spelling checkmate has next to `assert_data_frame`, namely `assertDataFrame`. */
function camelCased(this: void, name: BrandedIdentifier): BrandedIdentifier {
	return `assert${name.split('_').map(part => part[0].toUpperCase() + part.slice(1)).join('')}`;
}

/**
 * What every function has to do with guards, per package, each verified against the package providing it.
 * `is.numeric` is false for a factor, so it is not exact.
 */
const GuardFactsOfPackages: Readonly<Record<BrandedNamespace, Readonly<Record<BrandedIdentifier, GuardFacts>>>> = {
	[PkgName.Base]: {
		'is.vector':        predicate(Atomic | List | Expression, { plain: true }),
		'is.primitive':     predicate(Fn),
		'is.data.frame':    predicate(List, { classed: true }),
		'is.factor':        predicate(Integer, { classed: true }),
		'is.ordered':       predicate(Integer, { classed: true }),
		...PrimitiveLanguageGuardFacts,
		...PrimitiveOpsGuardFacts,
		'typeof':           { reads: TypeOf, computes: true },
		'storage.mode':     { reads: TypeOf, computes: true },
		'mode':             { reads: ModeOf, computes: true },
		'length':           { measures: 'single' },
		'NROW':             { measures: 'single' },
		'NCOL':             { measures: 'single' },
		/* what has no dimensions has `NULL` for these */
		'nrow':             { measures: 'nullable' },
		'ncol':             { measures: 'nullable' },
		'nchar':            { measures: 'elementwise' },
		'match.arg':        { check: { types: Character | Null, choices: 'choices', choicesFromDefault: true, partial: true } },
		/* the `Math` group: each dispatches on a classed `x`, as `trunc` does for a `Date`, those without a complex version fail for one */
		...Object.fromEntries(RGroupGenerics.Math.filter(name => name !== 'log' && !name.startsWith('cum')).map(name => [name, RealMathNames.has(name) ? RealMath : Math])),
		/* a complex `base` makes it take a string or `NULL` for `x` */
		'log':              { missingOk: ['base'] },
		'round':            { ...Math, missingOk: ['digits'] },
		'signif':           { ...Math, missingOk: ['digits'] },
		'cumsum':           { asks: { x: Cumulated } },
		'cumprod':          { asks: { x: Cumulated } },
		'cummax':           { asks: { x: Ordered('cummax') } },
		'cummin':           { asks: { x: Ordered('cummin') } },
		'strsplit':         { asks: { x: Text('non-character argument') } },
		'startsWith':       Prefixed,
		'endsWith':         Prefixed,
		'basename':         Pathed,
		'dirname':          Pathed,
		'sprintf':          { asks: { fmt: Text("'fmt' is not a character vector") }, returns: { types: Character } },
		'file.exists':      { asks: { '...': Text('invalid \'file\' argument') } },
		'dir.exists':       { asks: { paths: Text('invalid filename argument') } },
		'which':            { asks: { x: fails(is('is.logical'), 'argument to \'which\' is not logical') } },
		'new.env':          { asks: { parent: fails(is('is.environment'), '\'enclos\' must be an environment') } },
		'apply':            { asks: { X: fails({ not: { is: 'is.null', of: 'dim' } }, 'dim(X) must have a positive length') } },
		'assign':           { asks: { x: Text('invalid first argument') } },
		'get':              { asks: { x: fails(is('is.character', 'is.symbol'), 'invalid first argument') } },
		'exists':           { asks: { x: fails(is('is.character', 'is.symbol'), 'invalid first argument') }, computes: true, singleResult: true, returns: OneTruth },
		'do.call':          { asks: { args: fails(is('is.list'), 'second argument must be a list'), what: fails({ callable: true }, "'what' must be a function or character string") } },
		...each({ asks: { FUN: Applied } }, 'match.fun', 'lapply', 'sapply', 'vapply', 'mapply'),
		'Map':              { asks: { f: Applied } },
		/* `Reduce` returns for an empty `x` before it looks at `f`, so it asks nothing of it */
		'Filter':           { asks: { f: Applied } },
		'inherits':         { computes: true, singleResult: true },
		...each(SingleResult, 'identical', 'isTRUE', 'isFALSE', 'anyNA'),
		'requireNamespace': { singleResult: true, returns: OneTruth },
		...each(Computes, 'stopifnot', 'xor', '|>', 'all.equal'),
		'%in%':             { ...Computes, ...Returns(Logical, { notNA: true }) },
		'identity':         { returns: 'argument' },
		...each(Returns(Character), 'paste', 'paste0', 'toupper', 'tolower'),
		...each(OpensFrame, 'rm', 'remove', 'list2env', 'makeActiveBinding', 'eval', 'evalq', 'eval.parent', 'source', 'sys.source', 'attach', 'sys.frame', 'sys.frames')
	},
	[PkgName.Utils]: {
		/* a data frame of atomic columns, whatever the file holds */
		...each(Returns(List, { elements: Atomic }), 'read.csv', 'read.csv2', 'read.delim', 'read.delim2', 'read.table', 'read.fwf')
	},
	[PkgName.Methods]: {
		'is':     Computes,
		'hasArg': Computes
	},
	[PkgName.AssertThat]: {
		'assert_that': { asserts: ['msg', 'env'] }
	},
	[PkgName.Rlang]: {
		'is_null':             exact(Null),
		'is_logical':          predicate(Logical),
		'is_integer':          predicate(Integer),
		'is_double':           predicate(Double),
		'is_complex':          predicate(Complex),
		'is_character':        predicate(Character),
		'is_raw':              predicate(Raw),
		'is_function':         predicate(Fn, { callable: true }),
		'is_environment':      predicate(Environment),
		'is_list':             predicate(List | Pairlist),
		'is_string':           scalar(Character),
		'is_bool':             scalar(Logical),
		'is_scalar_logical':   scalar(Logical),
		'is_scalar_integer':   scalar(Integer),
		'is_scalar_double':    scalar(Double),
		'is_scalar_complex':   scalar(Complex),
		'is_scalar_character': scalar(Character),
		'is_scalar_list':      scalar(List | Pairlist),
		'arg_match':           { check: { types: Character, choices: 'values', choicesFromDefault: true } },
		/* takes a symbol as well, unlike `arg_match` */
		'arg_match0':          { check: { types: Character | Symbol, choices: 'values' } },
		'check_required':      { check: { present: true } },
		...each(OpensFrame, 'env_poke', 'env_bind', 'caller_env', 'current_env')
	},
	'checkmate': Object.fromEntries(Object.entries(CheckmateChecks).flatMap(([name, check]) => [[`assert_${name}`, { check }], [camelCased(name), { check }]]))
};

const Value = sig({ x: Forced.Value });

/** The functions the facts speak about that nothing else states anything of. */
export const GuardDefinitions = [
	fn(base('is.environment', 'is.symbol', 'is.name', 'is.call', 'is.expression', 'is.language', 'is.pairlist', 'is.atomic', 'is.recursive', 'is.primitive', 'is.array', 'is.object', 'typeof', 'mode', 'storage.mode', 'oldClass', 'isTRUE', 'isFALSE'),
		BuiltInProcName.DefaultReadAllArgs, { props: CallProp.Pure, sig: Value }, Primitive),
	fn(base('cospi', 'sinpi', 'tanpi', 'gamma', 'lgamma', 'digamma', 'trigamma'), BuiltInProcName.DefaultReadAllArgs, { props: CallProp.Pure, sig: Value }, Primitive),
	fn(base('anyNA'), BuiltInProcName.DefaultReadAllArgs, { props: CallProp.Pure, sig: sig({ x: Forced.Value, recursive: Forced.Flag }) }, Primitive),
	fn(base('all'), BuiltInProcName.DefaultReadAllArgs, { props: CallProp.Pure, sig: sig({ '...': Forced.Value, 'na.rm': Forced.Flag }) }, Primitive),
	fn(base('inherits'), BuiltInProcName.DefaultReadAllArgs, { props: CallProp.Pure, sig: sig({ x: Forced.Value, what: Forced.Value, which: Forced.Flag }) }, Primitive),
	fn(base('identical'), BuiltInProcName.DefaultReadAllArgs, { props: CallProp.Pure, sig: sig({ x: Forced.Value, y: Forced.Value, '...': ArgProp.Forced }) }, Primitive),
	fn(base('all.equal'), BuiltInProcName.DefaultReadAllArgs, { props: CallProp.Pure, sig: sig({ target: Forced.Value, current: Forced.Value, '...': ArgProp.Forced }) }, Primitive),
	fn(pkg(PkgName.Rlang, 'is_null', 'is_logical', 'is_integer', 'is_double', 'is_complex', 'is_character', 'is_raw', 'is_function', 'is_environment', 'is_list', 'is_string', 'is_bool', 'is_scalar_logical', 'is_scalar_integer', 'is_scalar_double', 'is_scalar_complex', 'is_scalar_character', 'is_scalar_list'),
		BuiltInProcName.DefaultReadAllArgs, { libFn: true, props: CallProp.Pure }),
	fn(pkg(PkgName.Rlang, 'arg_match', 'arg_match0', 'check_required'), BuiltInProcName.DefaultReadAllArgs, { libFn: true, props: CallProp.Throws }),
	fn(pkg(PkgName.Rlang, 'env_poke', 'env_bind', 'caller_env', 'current_env'), BuiltInProcName.DefaultReadAllArgs, { libFn: true }),
	fn(pkg('checkmate', ...Object.keys(CheckmateChecks).flatMap(name => [snakeCased(name), camelCased(name)])), BuiltInProcName.DefaultReadAllArgs, { libFn: true, props: CallProp.Invisible | CallProp.Throws })
] as const satisfies AnyBuiltInDefinition[];

/** The definitions, each with the {@link GuardFacts} of its names on it, a replacement function by the name R calls, like `names<-`. */
export function markGuards(definitions: BuiltInDefinitions): BuiltInDefinitions {
	return definitions.map(def => {
		if(def.type === 'constant') {
			return def;
		}
		const named = def.type === 'replacement' ? (name: BrandedIdentifier): BrandedIdentifier => `${name}<-` : (name: BrandedIdentifier) => name;
		const guards = Object.fromEntries((def.names as readonly Identifier[]).flatMap(id => {
			const namespace = Identifier.getNamespace(id) ?? PkgName.Base;
			const name = named(Identifier.getName(id));
			const facts = GuardFactsOfPackages[namespace]?.[name];
			return facts === undefined ? [] : [[name, AttachedBasePackageSet.has(namespace) ? facts : { ...facts, pkg: namespace }]];
		}));
		if(Object.keys(guards).length === 0) {
			return def;
		}
		return def.type === 'replacement' ? { ...def, config: { ...def.config, guards } } : { ...def, config: { ...def.config, guards } };
	});
}

/** Every name there are facts about, as `[package, name]`. */
export function namesWithGuardFacts(this: void): readonly (readonly [BrandedNamespace, BrandedIdentifier])[] {
	return Object.entries(GuardFactsOfPackages).flatMap(([namespace, names]) => Object.keys(names).map(name => [namespace, name] as const));
}
