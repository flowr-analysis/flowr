import type { BrandedIdentifier } from '../../environments/identifier';
import { Identifier } from '../../environments/identifier';
import type { BuiltInDefinitions } from '../../environments/built-in-config';
import { DefaultBuiltinConfig } from '../../environments/default-builtin-config';
import { GuardDemand, RValueType, type GuardFacts, type GuardFactsLookup, type RValueTypes } from '../../environments/guard-facts';
import { GuardTerm, type GuardCall } from './guard-term';

const { Null, Logical, Integer, Double, Complex, Character, Raw, List, Pairlist, Function: Fn, Environment, Symbol, Language, Expression, Other } = RValueType;

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

/** What the given built-in definitions state of guards, by the bare name of a function. */
export function guardFactsIn(this: void, definitions: BuiltInDefinitions): GuardFactsLookup {
	const known = new Map<BrandedIdentifier, GuardFacts>();
	for(const definition of definitions) {
		if(definition.type === 'function') {
			for(const [name, facts] of Object.entries(definition.config?.guards ?? {})) {
				known.set(Identifier.getName(name), facts);
			}
		}
	}
	return name => known.get(name);
}

let defaultFacts: GuardFactsLookup | undefined;

/** What the default built-in definitions state of guards. */
export function defaultGuardFacts(this: void): GuardFactsLookup {
	return defaultFacts ??= guardFactsIn(DefaultBuiltinConfig);
}

/** Whether the function is stated to do nothing but compute a value. */
export function onlyComputesBy(this: void, facts: GuardFacts | undefined): boolean {
	return facts !== undefined && (facts.computes === true || facts.predicate !== undefined || facts.measures !== undefined || facts.check !== undefined);
}

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

/** The condition each {@link GuardDemand} stands for. Every one is verified against R, and a dispatching one leaves out classed values. */
export const Demands: Readonly<Record<GuardDemand, Requirement>> = {
	[GuardDemand.Arithmetic]:         dispatched(Arithmetic),
	[GuardDemand.Compared]:           dispatched(Comparable),
	[GuardDemand.Mathematical]:       dispatched(Mathematical),
	[GuardDemand.NotLogical]:         dispatched(NotLogical),
	[GuardDemand.Dollar]:             dispatched(Dollar),
	[GuardDemand.Subsettable]:        dispatched(Subsettable),
	[GuardDemand.ElementSubsettable]: dispatched(ElementSubsettable),
	[GuardDemand.Character]:          IsCharacter,
	[GuardDemand.List]:               IsList,
	[GuardDemand.Logical]:            IsLogical,
	[GuardDemand.Environment]:        IsEnvironment,
	[GuardDemand.HasDim]:             HasDim,
	[GuardDemand.Named]:              Named
};

/** What R typically says when a {@link GuardDemand} fails, read off R itself. */
export const DemandMessages: Readonly<Record<GuardDemand, string>> = {
	[GuardDemand.Arithmetic]:         'non-numeric argument to binary operator',
	[GuardDemand.Compared]:           'comparison is possible only for atomic and list types',
	[GuardDemand.Mathematical]:       'non-numeric argument to mathematical function',
	[GuardDemand.NotLogical]:         'invalid argument type',
	[GuardDemand.Dollar]:             '$ operator is invalid for atomic vectors',
	[GuardDemand.Subsettable]:        'object of type ... is not subsettable',
	[GuardDemand.ElementSubsettable]: 'object of type ... is not subsettable',
	[GuardDemand.Character]:          'non-character argument',
	[GuardDemand.List]:               'second argument must be a list',
	[GuardDemand.Logical]:            'argument is not logical',
	[GuardDemand.Environment]:        'invalid envir argument',
	[GuardDemand.HasDim]:             'incorrect number of dimensions',
	[GuardDemand.Named]:              'invalid first argument'
};

/** What R says when a value handed over to be applied is no function. */
export const NotCallableMessage = 'is not a function, character or symbol';

/** What `if` and `while` say of a condition that is not one logical, see {@link condition}. */
export const ConditionMessages = { length: 'argument is of length zero, or the condition has length > 1', na: 'missing value where TRUE/FALSE needed' } as const;

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
