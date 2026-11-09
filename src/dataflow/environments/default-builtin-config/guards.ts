import type { AnyBuiltInDefinition, BuiltInDefinitions } from '../built-in-config';
import { BuiltInProcName } from '../built-in-proc-name';
import { ArgProp, CallProp } from '../built-in-props';
import { AnyType, GuardDemand, RValueType, type CheckingCall, type GuardFacts, type ReturnedValue, type RValueTypes, type TypePredicate } from '../guard-facts';
import { Identifier, PkgName, type BrandedIdentifier, type BrandedNamespace } from '../identifier';
import { AttachedBasePackageSet } from '../../../util/r-base-packages';
import { base, fn, pkg, Primitive } from './define-helpers';
import { Forced, sig } from './shared-signatures';

const { Null, Logical, Integer, Double, Complex, Character, Raw, List, Pairlist, Function: Fn, Environment, Symbol, Language, Expression, Other } = RValueType;
const Numeric = Integer | Double;
const Atomic = Logical | Numeric | Complex | Character | Raw;

/** Spelled the way the facts below read best. */
const predicate = (yes: RValueTypes, more: Omit<TypePredicate, 'yes'> = {}): GuardFacts => ({ predicate: { yes, ...more } });
const exact = (yes: RValueTypes): GuardFacts => predicate(yes, { exact: true });
const scalar = (yes: RValueTypes): GuardFacts => predicate(yes, { scalar: true });
const Computes: GuardFacts = { computes: true };
const OneTruth: ReturnedValue = { types: Logical, scalar: true, notNA: true };
const SingleResult: GuardFacts = { computes: true, singleResult: true, returns: OneTruth };
/* `all(NA)` is `NA`, and `inherits(x, what, which = TRUE)` returns integers */
const OneLogical: GuardFacts = { singleResult: true, returns: { types: Logical, scalar: true } };
const Count: ReturnedValue = { types: Integer, scalar: true, notNA: true, count: true };
const Returns = (types: RValueTypes, more: Omit<ReturnedValue, 'types'> = {}): GuardFacts => ({ returns: { types, ...more } });
const OpensFrame: GuardFacts = { opensFrame: true };

const ArithmeticOperands = { asks: { e1: GuardDemand.Arithmetic, e2: GuardDemand.Arithmetic } };
const ComparedOperands = { asks: { e1: GuardDemand.Compared, e2: GuardDemand.Compared } };
const Math = { asks: { x: GuardDemand.Mathematical } };
const Summary = { asks: { '...': GuardDemand.Arithmetic } };
const Strings = { asks: { x: GuardDemand.Character } };
const Pathed = { asks: { path: GuardDemand.Character } };

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
 * `is.numeric` is false for a factor, so it is not exact, and `is.atomic(NULL)` is true before R 4.4.
 */
const GuardFactsOfPackages: Readonly<Record<BrandedNamespace, Readonly<Record<BrandedIdentifier, GuardFacts>>>> = {
	[PkgName.Base]: {
		'is.null':           exact(Null),
		'is.logical':        exact(Logical),
		'is.integer':        predicate(Integer, { exact: 'unclassed' }),
		'is.double':         exact(Double),
		'is.complex':        exact(Complex),
		'is.character':      exact(Character),
		'is.raw':            exact(Raw),
		'is.function':       predicate(Fn, { exact: true, callable: true }),
		'is.environment':    predicate(Environment, { exact: true, classedToo: Other }),
		'is.symbol':         predicate(Symbol, { exact: true, callable: true }),
		'is.name':           predicate(Symbol, { exact: true, callable: true }),
		'is.call':           exact(Language),
		'is.expression':     exact(Expression),
		'is.language':       exact(Symbol | Language | Expression),
		'is.list':           exact(List | Pairlist),
		'is.pairlist':       exact(Null | Pairlist),
		'is.numeric':        predicate(Numeric, { plain: true }),
		'is.atomic':         predicate(Atomic | Null, { plain: true }),
		'is.vector':         predicate(Atomic | List | Expression, { plain: true }),
		'is.recursive':      predicate(List | Pairlist | Fn | Environment | Language | Expression | Other),
		'is.primitive':      predicate(Fn),
		'is.matrix':         predicate(Atomic | List | Expression),
		'is.array':          predicate(Atomic | List | Expression),
		'is.data.frame':     predicate(List, { classed: true }),
		'is.factor':         predicate(Integer, { classed: true }),
		'is.ordered':        predicate(Integer, { classed: true }),
		'is.object':         predicate(AnyType, { classed: true }),
		'typeof':            { reads: TypeOf, computes: true },
		'storage.mode':      { reads: TypeOf, computes: true },
		'mode':              { reads: ModeOf, computes: true },
		'length':            { measures: 'single' },
		'NROW':              { measures: 'single' },
		'NCOL':              { measures: 'single' },
		/* what has no dimensions has `NULL` for these */
		'nrow':              { measures: 'nullable' },
		'ncol':              { measures: 'nullable' },
		'nchar':             { measures: 'elementwise' },
		'match.arg':         { check: { types: Character | Null, choices: 'choices', choicesFromDefault: true, partial: true } },
		'+':                 { ...ArithmeticOperands, computes: true },
		'-':                 { ...ArithmeticOperands, computes: true },
		'*':                 { ...ArithmeticOperands, computes: true },
		'/':                 { ...ArithmeticOperands, computes: true },
		'^':                 { ...ArithmeticOperands, computes: true },
		'%%':                { ...ArithmeticOperands, computes: true },
		'%/%':               { ...ArithmeticOperands, computes: true },
		'<':                 ComparedOperands,
		'<=':                ComparedOperands,
		'>':                 ComparedOperands,
		'>=':                ComparedOperands,
		'==':                ComparedOperands,
		'!=':                ComparedOperands,
		'!':                 { asks: { x: GuardDemand.NotLogical } },
		'$':                 { asks: { x: GuardDemand.Dollar }, computes: true },
		'[':                 { asks: { x: GuardDemand.Subsettable }, computes: true },
		'[[':                { asks: { x: GuardDemand.ElementSubsettable }, computes: true },
		'sqrt':              Math,
		'abs':               Math,
		'exp':               Math,
		'log':               Math,
		'floor':             Math,
		'ceiling':           Math,
		'round':             Math,
		'sum':               Summary,
		'prod':              Summary,
		'strsplit':          Strings,
		'startsWith':        Strings,
		'endsWith':          Strings,
		'basename':          Pathed,
		'dirname':           Pathed,
		'sprintf':           { asks: { fmt: GuardDemand.Character }, returns: { types: Character } },
		'file.exists':       { asks: { '...': GuardDemand.Character } },
		'dir.exists':        { asks: { paths: GuardDemand.Character } },
		'which':             { asks: { x: GuardDemand.Logical } },
		'new.env':           { asks: { parent: GuardDemand.Environment } },
		'apply':             { asks: { X: GuardDemand.HasDim } },
		'assign':            { asks: { x: GuardDemand.Character } },
		'get':               { asks: { x: GuardDemand.Named } },
		'exists':            { asks: { x: GuardDemand.Named }, computes: true, singleResult: true, returns: OneTruth },
		'do.call':           { asks: { args: GuardDemand.List }, applies: 'what' },
		'match.fun':         { applies: 'FUN' },
		'lapply':            { applies: 'FUN' },
		'sapply':            { applies: 'FUN' },
		'vapply':            { applies: 'FUN' },
		'mapply':            { applies: 'FUN' },
		'Map':               { applies: 'f' },
		/* `Reduce` returns for an empty `x` before it looks at `f`, so it asks nothing of it */
		'Filter':            { applies: 'f' },
		'inherits':          { computes: true, singleResult: true },
		'identical':         SingleResult,
		'isTRUE':            SingleResult,
		'isFALSE':           SingleResult,
		'all':               { ...OneLogical, computes: true },
		'any':               OneLogical,
		'anyNA':             SingleResult,
		'missing':           { singleResult: true, returns: OneTruth },
		'requireNamespace':  { singleResult: true, returns: OneTruth },
		'&&':                OneLogical,
		'||':                OneLogical,
		'nzchar':            { ...Computes, ...Returns(Logical) },
		'class':             { ...Computes, ...Returns(Character) },
		'oldClass':          { ...Computes, ...Returns(Character | Null) },
		'c':                 Computes,
		'stopifnot':         Computes,
		'invisible':         { ...Computes, returns: 'argument' },
		'list':              { ...Computes, ...Returns(List) },
		'names':             { ...Computes, ...Returns(Character | Null) },
		'dim':               Computes,
		'seq_len':           { ...Computes, ...Returns(Numeric, { notNA: true, count: true }) },
		'seq_along':         { ...Computes, ...Returns(Numeric, { notNA: true, count: true }) },
		'xor':               Computes,
		'|>':                Computes,
		'all.equal':         Computes,
		'nargs':             { ...Computes, returns: Count },
		'...length':         { ...Computes, returns: Count },
		'...elt':            Computes,
		'%in%':              { ...Computes, ...Returns(Logical, { notNA: true }) },
		'%*%':               Computes,
		':':                 Computes,
		'@':                 Computes,
		'identity':          { returns: 'argument' },
		'paste':             Returns(Character),
		'paste0':            Returns(Character),
		'toupper':           Returns(Character),
		'tolower':           Returns(Character),
		'as.character':      Returns(Character),
		'as.integer':        Returns(Integer),
		'as.numeric':        Returns(Double),
		'as.double':         Returns(Double),
		'as.logical':        Returns(Logical),
		'rm':                OpensFrame,
		'remove':            OpensFrame,
		'list2env':          OpensFrame,
		'makeActiveBinding': OpensFrame,
		'eval':              OpensFrame,
		'evalq':             OpensFrame,
		'eval.parent':       OpensFrame,
		'source':            OpensFrame,
		'sys.source':        OpensFrame,
		'attach':            OpensFrame,
		'sys.frame':         OpensFrame,
		'sys.frames':        OpensFrame,
		'as.environment':    OpensFrame
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
		'env_poke':            OpensFrame,
		'env_bind':            OpensFrame,
		'caller_env':          OpensFrame,
		'current_env':         OpensFrame
	},
	'checkmate': Object.fromEntries(Object.entries(CheckmateChecks).flatMap(([name, check]) => [[`assert_${name}`, { check }], [camelCased(name), { check }]]))
};

const Value = sig({ x: Forced.Value });

/** The functions the facts speak about that nothing else states anything of. */
export const GuardDefinitions = [
	fn(base('is.environment', 'is.symbol', 'is.name', 'is.call', 'is.expression', 'is.language', 'is.pairlist', 'is.atomic', 'is.recursive', 'is.primitive', 'is.array', 'is.object', 'typeof', 'mode', 'storage.mode', 'oldClass', 'isTRUE', 'isFALSE'),
		BuiltInProcName.DefaultReadAllArgs, { props: CallProp.Pure, sig: Value }, Primitive),
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

/** The definitions, each with the {@link GuardFacts} of its names on it. */
export function markGuards(definitions: BuiltInDefinitions): BuiltInDefinitions {
	return definitions.map(def => {
		if(def.type !== 'function') {
			return def;
		}
		const guards = Object.fromEntries((def.names as readonly Identifier[]).flatMap(id => {
			const namespace = Identifier.getNamespace(id) ?? PkgName.Base;
			const facts = GuardFactsOfPackages[namespace]?.[Identifier.getName(id)];
			return facts === undefined ? [] : [[Identifier.getName(id), AttachedBasePackageSet.has(namespace) ? facts : { ...facts, pkg: namespace }]];
		}));
		return Object.keys(guards).length === 0 ? def : { ...def, config: { ...def.config, guards } };
	});
}

/** Every name there are facts about, as `[package, name]`. */
export function namesWithGuardFacts(this: void): readonly (readonly [BrandedNamespace, BrandedIdentifier])[] {
	return Object.entries(GuardFactsOfPackages).flatMap(([namespace, names]) => Object.keys(names).map(name => [namespace, name] as const));
}
