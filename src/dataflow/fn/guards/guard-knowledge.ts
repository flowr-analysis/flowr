import type { BrandedIdentifier } from '../../environments/identifier';
import { Identifier } from '../../environments/identifier';
import type { BuiltInDefinitions } from '../../environments/built-in-config';
import { DefaultBuiltinConfig } from '../../environments/default-builtin-config';
import { RValueType, type GuardFacts, type GuardFactsLookup, type RCondition, type RFailure, type RValueTypes, type RVersions } from '../../environments/guard-facts';
import { compareRVersions } from '../../../util/r-version-order';
import { RBaseGuardsVersion } from '../../../data/r-base-guards.generated';
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

/** Whether the R version is one of the given ones. */
export function holdsIn(this: void, { since, until }: RVersions, version: string): boolean {
	return (since === undefined || compareRVersions(version, since) >= 0) && (until === undefined || compareRVersions(version, until) < 0);
}

/** The facts as they hold in the given R version. */
function factsIn(this: void, { changed, ...facts }: GuardFacts, version: string): GuardFacts {
	const merged = (changed ?? []).filter(c => holdsIn(c, version)).reduce<GuardFacts>((acc, c) => ({ ...acc, ...c.facts }), facts);
	const asks = merged.asks === undefined ? undefined : Object.fromEntries(Object.entries(merged.asks).map(([formal, failures]) => [formal, failures.filter(f => holdsIn(f, version))]));
	return asks === undefined ? merged : { ...merged, asks };
}

/** The classes S3 dispatch sees for a value without a class attribute, as `.class2` names them, beyond `default`. */
export const ImplicitClasses: readonly string[] = ['matrix', 'array', 'integer', 'double', 'numeric', 'complex', 'character', 'logical', 'raw', 'list', 'function', 'NULL', 'environment', 'name', 'call', '(', '{', 'if', 'for', 'while', '<-', '=', 'expression', 'pairlist', 'externalptr', 'weakref', 'bytecode'];

/** What the given built-in definitions state of guards in the given R version, by the bare name of a function. */
export function guardFactsIn(this: void, definitions: BuiltInDefinitions, version: string = RBaseGuardsVersion): GuardFactsLookup {
	const known = new Map<BrandedIdentifier, GuardFacts>();
	for(const definition of definitions) {
		if(definition.type === 'function') {
			for(const [name, facts] of Object.entries(definition.config?.guards ?? {})) {
				known.set(Identifier.getName(name), factsIn(facts, version));
			}
		}
	}
	return name => known.get(name);
}

const defaultFacts = new Map<string, GuardFactsLookup>();

/** What the default built-in definitions state of guards, by default in the R version the guards of the base packages were read off. */
export function defaultGuardFacts(this: void, version: string = RBaseGuardsVersion): GuardFactsLookup {
	let facts = defaultFacts.get(version);
	if(facts === undefined) {
		facts = guardFactsIn(DefaultBuiltinConfig, version);
		defaultFacts.set(version, facts);
	}
	return facts;
}

/** Whether the function is stated to do nothing but compute a value. */
export function onlyComputesBy(this: void, facts: GuardFacts | undefined): boolean {
	return facts !== undefined && (facts.computes === true || facts.predicate !== undefined || facts.measures !== undefined || facts.check !== undefined);
}

const is = (fn: BrandedIdentifier, of: GuardTerm): GuardTerm => GuardTerm.known(fn, of);

/** The name of a function as a string in R, for `exists`. */
function exists(this: void, of: GuardTerm): GuardTerm {
	return { kind: 'call', fn: 'exists', known: true, args: [{ value: of }, { name: 'mode', value: GuardTerm.string('function') }] };
}

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

/** The condition in terms of the value `of`, with `resolves` telling whether a function of the name is around, see {@link callable}. */
function conditionOn(this: void, condition: RCondition, of: GuardTerm, resolves: (name: BrandedIdentifier) => boolean): GuardTerm {
	if('is' in condition) {
		return is(condition.is, condition.of === undefined ? of : is(condition.of, of));
	} else if('not' in condition) {
		return GuardTerm.known('!', conditionOn(condition.not, of, resolves));
	} else if('any' in condition) {
		return GuardTerm.any(...condition.any.map(c => conditionOn(c, of, resolves)));
	} else if('all' in condition) {
		return GuardTerm.all(...condition.all.map(c => conditionOn(c, of, resolves)));
	} else if('length' in condition) {
		return GuardTerm.known(condition.length, is('length', of), { kind: 'constant', lexeme: String(condition.to), value: condition.to });
	}
	return callable(of, resolves);
}

/** Whether the failure is about what can be applied, which also speaks of what is no formal, like a name spelled out at run time. */
export function asksCallable(this: void, { requires }: RFailure): boolean {
	return 'callable' in requires;
}

/** Whether the function applies what one of its formals holds. */
export function appliesFormal(this: void, facts: GuardFacts | undefined): boolean {
	return Object.values(facts?.asks ?? {}).some(failures => failures.some(asksCallable));
}

/** What it takes for `of` not to make R raise the failure, `other` being the second operand of an operator, which may bring a method of its own as well. */
export function passes(this: void, failure: RFailure, of: GuardTerm, resolves: (name: BrandedIdentifier) => boolean, other?: GuardTerm): GuardTerm {
	const condition = conditionOn(failure.requires, of, resolves);
	return failure.dispatches ? GuardTerm.any(condition, is('is.object', of), ...(other === undefined || other.kind === 'constant' ? [] : [is('is.object', other)])) : condition;
}

/** What R says on the failure for the value `of`. */
export function messageFor(this: void, { message }: RFailure, of: GuardTerm): string {
	return message.replace('%s', GuardTerm.render(of));
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
