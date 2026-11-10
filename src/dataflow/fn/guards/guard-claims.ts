import type { BrandedIdentifier } from '../../environments/identifier';
import { IntervalDomain } from '../../../abstract-interpretation/domains/interval-domain';
import { BoundedSetDomain } from '../../../abstract-interpretation/domains/bounded-set-domain';
import { GuardTerm, type GuardCall, type GuardConstant } from './guard-term';
import { AnyType, RValueType, type GuardFacts, type GuardFactsLookup, type ReturnedValue, type RValueTypes } from '../../environments/guard-facts';
import { setEquals } from '../../../util/collections/set';
import { appliesFormal, typeNames } from './guard-knowledge';

/** The inclusive bounds of a number, the upper one `Infinity` if there is none; JSON turns that into `null`, so it is stated as such. */
export type ClaimedRange = readonly [lower: number | null, upper: number | null];

/**
 * What a call that returns normally has made sure of one of the formals of a function, each read off the guards.
 * A field left out claims nothing.
 */
export interface FormalClaim {
	/** the value has one of these types (see {@link RValueType}) */
	readonly types?:          readonly string[]
	/** the same, for a value without a class attribute, as those can bring methods of their own; only stated if it says more than {@link FormalClaim.types} */
	readonly unclassedTypes?: readonly string[]
	/** a character value holds only these, or abbreviates one of them if {@link FormalClaim.partial} is set, numbers and logicals are only stated for a value that is one */
	readonly values?:         readonly (string | number | boolean)[]
	/** the {@link FormalClaim.values} are matched partially, as `match.arg` does */
	readonly partial?:        boolean
	/** `class(x)` holds at least one of these, or `x` is an S4 object that `is` one, as `inherits` asks `is` for those */
	readonly classes?:        readonly string[]
	/** the bounds of what the formal measures: `value` for a number without a class attribute, only stated if the formal is one, else `length`, `nchar`, `nrow`, `ncol`, `NROW`, or `NCOL`, which are taken to be whole numbers, as an S3 method of `length` returning anything else breaks its contract */
	readonly bounds?:         Readonly<Record<string, ClaimedRange>>
	/** no element is `NA` */
	readonly notNA?:          boolean
	/** must be usable as a function: being one, naming one, or being bound to a name another function can be found by */
	readonly callable?:       boolean
	/** every element is a whole number, as `trunc(x) == x` asks */
	readonly whole?:          boolean
	/** what the formal has to complete into a name that exists, like `paste0("f_", x)` */
	readonly resolves?:       readonly ClaimedName[]
	/** what holds in each of the cases a branch on the formal tells apart, like `if(is.logical(center)) ... else ...` */
	readonly cases?:          readonly FormalCase[]
}

/** One of the cases a branch on a formal tells apart, with what a normal return makes sure of in it. */
export interface FormalCase {
	/** the condition of the case, in R syntax */
	readonly when:       string
	/** what holds of the formal in the case, the condition included */
	readonly claim:      FormalClaim
	/** what relates the formal to others in the case, see {@link ClaimedRelation} */
	readonly relations?: readonly ClaimedRelation[]
}

/** A condition with the conditions of the path it was found on, see {@link casesOf}. */
export interface CaseClause {
	readonly requires: GuardTerm
	/** what held on the way to the condition, outermost first */
	readonly under?:   readonly GuardTerm[]
}

/** A name a function looks up at run time, built from a formal. */
export interface ClaimedName {
	/** how the function spells it, in R syntax */
	readonly expression:  string
	/** what comes before the formal in the name, if that is known */
	readonly prefix?:     string
	/** what comes after the formal in the name, if that is known */
	readonly suffix?:     string
	/** the values of the formal that make it a function the program defines, which does not rule out functions from elsewhere */
	readonly candidates?: readonly string[]
}

/** {@link FormalClaim} while it is being worked out, which is a lattice: every field goes from what is known towards nothing. */
interface Abstract {
	readonly types:    TypeSet
	/** the types of a value without a class attribute */
	readonly plain:    TypeSet
	/** top for no claim, as bottom states that no character value passes */
	readonly values:   BoundedSetDomain<string | number | boolean>
	readonly partial:  boolean
	readonly classes:  ReadonlySet<string> | undefined
	readonly bounds:   ReadonlyMap<BrandedIdentifier, IntervalDomain>
	readonly notNA:    boolean
	readonly callable: boolean
	readonly whole:    boolean
	readonly resolves: ReadonlyMap<string, ClaimedName>
}

type TypeSet = BoundedSetDomain<RValueType>;

const AllTypes = typeNames(AnyType).length;

/** The types as a set, which is top once it holds every one of them. */
function typeSet(this: void, types: RValueTypes): TypeSet {
	return new BoundedSetDomain(Array.from({ length: AllTypes }, (_, i) => 1 << i).filter(bit => (types & bit) !== 0), AllTypes - 1);
}

/** The types of the set, all of them for top. */
function typeBits(this: void, types: TypeSet): RValueTypes {
	return types.isValue() ? types.value.values().reduce((acc, type) => acc | type, 0) : AnyType;
}

const NoValues = BoundedSetDomain.top<string | number | boolean>();

function ofValues(this: void, values: ReadonlySet<string | number | boolean> | undefined): BoundedSetDomain<string | number | boolean> {
	return values === undefined ? NoValues : NoValues.create(values);
}

const Unconstrained: Abstract = { types: typeSet(AnyType), plain: typeSet(AnyType), values: NoValues, partial: false, classes: undefined, bounds: new Map(), notNA: false, callable: false, whole: false, resolves: new Map() };

function ofTypes(this: void, types: RValueTypes, classed = false): Abstract {
	return { ...Unconstrained, types: typeSet(types), plain: typeSet(classed ? 0 : types) };
}

function ofBound(this: void, measure: BrandedIdentifier, lower: number, upper: number): Abstract {
	return { ...Unconstrained, bounds: new Map([[measure, new IntervalDomain([lower, upper])]]) };
}

function combineMaps(this: void, a: Abstract['bounds'], b: Abstract['bounds'], meet: boolean): Abstract['bounds'] {
	const result = new Map<BrandedIdentifier, IntervalDomain>();
	for(const key of new Set([...a.keys(), ...b.keys()])) {
		const [left, right] = [a.get(key), b.get(key)];
		if(left !== undefined && right !== undefined) {
			result.set(key, meet ? left.meet(right) : left.join(right));
		} else if(meet) {
			result.set(key, (left ?? right) as IntervalDomain);
		}
	}
	return result;
}

/** Both hold. */
function both(this: void, a: Abstract, b: Abstract): Abstract {
	const values = a.values.meet(b.values);
	return {
		types:    a.types.meet(b.types),
		plain:    a.plain.meet(b.plain),
		values,
		/* whichever narrowed it last keeps the exact values, those always pass the partial ones as well */
		partial:  (a.values.isTop() || a.partial) && (b.values.isTop() || b.partial) && !values.isTop(),
		/* each of them holds, and a class set says "at least one of these": either answer is true, the smaller says more */
		classes:  a.classes === undefined || (b.classes !== undefined && b.classes.size < a.classes.size) ? b.classes : a.classes,
		bounds:   combineMaps(a.bounds, b.bounds, true),
		notNA:    a.notNA || b.notNA,
		callable: a.callable || b.callable,
		whole:    a.whole || b.whole,
		resolves: new Map([...a.resolves, ...b.resolves])
	};
}

/** At least one of the two holds. */
function either(this: void, a: Abstract, b: Abstract): Abstract {
	const values = a.values.join(b.values);
	return {
		types:    a.types.join(b.types),
		plain:    a.plain.join(b.plain),
		values,
		partial:  !values.isTop() && (a.partial || b.partial),
		classes:  a.classes === undefined || b.classes === undefined ? undefined : a.classes.union(b.classes),
		bounds:   combineMaps(a.bounds, b.bounds, false),
		notNA:    a.notNA && b.notNA,
		callable: a.callable && b.callable,
		whole:    a.whole && b.whole,
		resolves: new Map([...a.resolves].filter(([expression]) => b.resolves.has(expression)))
	};
}

function isFormal(this: void, term: GuardTerm | undefined, formal: BrandedIdentifier): boolean {
	return term?.kind === 'formal' && term.name === formal;
}

/** The value of a constant that is one, skipping `NA` and the like. */
function valuesOf(this: void, constants: readonly GuardConstant[]): Set<string | number | boolean> | undefined {
	const values = constants.map(c => c.value);
	return values.every(v => v !== undefined) ? new Set(values) : undefined;
}

function ofPredicate(this: void, call: GuardCall, formal: BrandedIdentifier, holds: boolean, facts: GuardFactsLookup): Abstract {
	const [first, second] = call.args.map(a => a.value);
	const name = GuardTerm.bareName(call.fn);
	if(call.fn === 'isTRUE' || call.fn === 'isFALSE') {
		return holds && isFormal(first, formal) ? both(ofTypes(RValueType.Logical), ofBound('length', 1, 1)) : Unconstrained;
	}
	const stated = facts(name);
	const predicate = stated?.predicate;
	if(predicate !== undefined && isFormal(first, formal)) {
		if(holds) {
			const types = { ...ofTypes(predicate.yes | (predicate.classedToo ?? 0), predicate.classed), ...(predicate.classed ? {} : { plain: typeSet(predicate.yes) }) };
			const typed = predicate.callable ? { ...types, callable: true } : types;
			return predicate.scalar ? both(typed, ofBound('length', 1, 1)) : typed;
		}
		const others = typeSet(AnyType & ~predicate.yes);
		const ruledOut = predicate.exact === 'unclassed' ? { ...Unconstrained, plain: others } : predicate.exact ? { ...Unconstrained, types: others, plain: others } : Unconstrained;
		/* whatever a string can be measured against, this is not one */
		return call.fn === 'is.character' ? { ...ruledOut, values: NoValues.bottom() } : ruledOut;
	} else if(isFormal(first, formal) && (holds ? name === 'is.finite' : name === 'is.na' || name === 'anyNA')) {
		return { ...Unconstrained, notNA: true };
	} else if(stated?.measures !== undefined && isFormal(first, formal) && call.args.length === 1) {
		return holds ? boundOf(name, '>=', 1) : boundOf(name, '==', 0);
	} else if(holds && call.fn === 'inherits' && isFormal(first, formal) && call.args.length === 2) {
		const classes = valuesOf(GuardTerm.constants(second) ?? []);
		return classes?.size ? { ...Unconstrained, classes: new Set([...classes].map(String)) } : Unconstrained;
	}
	return Unconstrained;
}

/** The comparison operator read the other way around, `1 < x` being `x > 1`. */
const Swapped: Readonly<Record<BrandedIdentifier, BrandedIdentifier>> = { '<': '>', '>': '<', '<=': '>=', '>=': '<=', '==': '==', '!=': '!=' };

function boundOf(this: void, measure: BrandedIdentifier, op: BrandedIdentifier, value: number): Abstract {
	/* what counts comes in whole numbers, so a bound between two of them, or a strict one, says more than it spells out */
	const whole = measure !== 'value';
	switch(op) {
		case '==':
			return ofBound(measure, value, value);
		case '>':
			return ofBound(measure, whole ? Math.floor(value) + 1 : value, Infinity);
		case '>=':
			return ofBound(measure, whole ? Math.ceil(value) : value, Infinity);
		case '<':
			return ofBound(measure, -Infinity, whole ? Math.ceil(value) - 1 : value);
		case '<=':
			return ofBound(measure, -Infinity, whole ? Math.floor(value) : value);
		case '!=':
			return measure !== 'value' && value === 0 ? ofBound(measure, 1, Infinity) : Unconstrained;
		default:
			return Unconstrained;
	}
}

/** What `read op constants` says, `read` being a term reading something off the formal. */
function ofComparison(this: void, read: GuardTerm, op: BrandedIdentifier, right: GuardTerm, formal: BrandedIdentifier, facts: GuardFactsLookup): Abstract {
	const constants = GuardTerm.constants(right);
	if(GuardTerm.isCall(read) && read.known && isFormal(read.args[0]?.value, formal) && read.args.length === 1) {
		const reader = facts(read.fn)?.reads;
		const values = (op === '==' || op === '%in%') && constants !== undefined ? valuesOf(constants) : undefined;
		if(reader !== undefined && values !== undefined) {
			const types = [...values].map(v => reader[String(v)]);
			return types.every(t => t !== undefined) ? ofTypes(types.reduce((acc, t) => acc | t, 0)) : Unconstrained;
		} else if(read.fn === 'class' && values !== undefined) {
			return { ...Unconstrained, classes: new Set([...values].map(String)) };
		}
		const number = constants?.length === 1 ? constants[0].value : undefined;
		return facts(read.fn)?.measures !== undefined && typeof number === 'number' ? boundOf(read.fn, op, number) : Unconstrained;
	} else if(!isFormal(read, formal) || constants === undefined) {
		return Unconstrained;
	}
	const number = constants.length === 1 ? constants[0].value : undefined;
	if(op === '%in%' || (op === '==' && typeof number !== 'number')) {
		const values = valuesOf(constants);
		return values === undefined ? Unconstrained : { ...Unconstrained, values: ofValues(values) };
	}
	return typeof number === 'number' ? boundOf('value', op, number) : Unconstrained;
}

function ofCheck(this: void, call: GuardCall, formal: BrandedIdentifier, facts: GuardFactsLookup): Abstract {
	const name = GuardTerm.bareName(call.fn);
	if(name === 'UseMethod') {
		const [{ value: generic }, { value: object }] = call.args;
		return isFormal(object, formal) && generic.kind === 'constant' ? { ...Unconstrained, resolves: new Map([[`${generic.lexeme}.class(${formal})`, { expression: `paste0(${generic.lexeme}, ".", class(${formal}))`, prefix: `${String(generic.value)}.`, suffix: '' }]]) } : Unconstrained;
	}
	if(appliesFormal(facts(name)) && isFormal(call.args[0]?.value, formal)) {
		return { ...Unconstrained, callable: true };
	}
	const check = facts(name)?.check;
	if(check === undefined || !isFormal(call.args[0]?.value, formal)) {
		return Unconstrained;
	}
	let types = check.types ?? AnyType;
	let loosened = false;
	for(const [option, adds] of Object.entries(check.loosens ?? {})) {
		const given = call.args.find(a => a.name === option)?.value;
		/* left out, it stays at its default of not loosening anything */
		if(given !== undefined && !(given.kind === 'constant' && given.value === false)) {
			types |= adds;
			loosened ||= (adds & RValueType.Null) !== 0;
		}
	}
	const choices = check.choices === undefined ? undefined : call.args.find((a, i) => a.name === check.choices || (a.name === undefined && i === 1))?.value;
	const values = choices === undefined ? undefined : valuesOf(GuardTerm.constants(choices) ?? []);
	const claim = { ...ofTypes(types, check.classed), values: ofValues(values), partial: values !== undefined && check.partial === true };
	return check.scalar && !loosened ? both(claim, ofBound('length', 1, 1)) : claim;
}

/** What surrounds the formal in the `paste0`, `paste`, or `sprintf` that spells out a name, if that is all there is to it. */
function surroundings(this: void, term: GuardTerm, formal: BrandedIdentifier): Pick<ClaimedName, 'prefix' | 'suffix'> {
	if(!GuardTerm.isCall(term)) {
		return {};
	}
	const texts = term.args.filter(a => a.name === undefined).map(a => a.value);
	if(term.fn === 'sprintf') {
		const [format, ...rest] = texts;
		const parts = format?.kind === 'constant' && typeof format.value === 'string' ? format.value.split('%s') : [];
		return parts.length === 2 && rest.length === 1 && isFormal(rest[0], formal) ? { prefix: parts[0], suffix: parts[1] } : {};
	}
	const separator = term.args.find(a => a.name === 'sep')?.value;
	const glue = term.fn === 'paste0' ? '' : separator === undefined ? ' ' : separator.kind === 'constant' && typeof separator.value === 'string' ? separator.value : undefined;
	const at = texts.findIndex(t => isFormal(t, formal));
	const strings = texts.map(t => t.kind === 'constant' && typeof t.value === 'string' ? t.value : undefined);
	if(glue === undefined || at < 0 || strings.some((t, i) => i !== at && t === undefined) || term.args.some(a => a.name === 'collapse')) {
		return {};
	}
	const around = (from: readonly (string | undefined)[], outer: (text: string) => string) => from.length === 0 ? '' : outer(from.join(glue));
	return { prefix: around(strings.slice(0, at), t => t + glue), suffix: around(strings.slice(at + 1), t => glue + t) };
}

function resolving(this: void, named: GuardTerm, formal: BrandedIdentifier): Abstract {
	const expression = GuardTerm.render(named);
	return { ...Unconstrained, resolves: new Map([[expression, { expression, ...surroundings(named, formal) }]]) };
}

function ofExists(this: void, call: GuardCall, formal: BrandedIdentifier): Abstract {
	const [{ value: named }] = call.args;
	const isFunctionMode = call.args.some(a => a.name === 'mode' && a.value.kind === 'constant' && a.value.value === 'function');
	if(named.kind === 'constant' && named.value === formal) {
		return { ...Unconstrained, callable: isFunctionMode };
	}
	if(!GuardTerm.formalsOf(named).has(formal)) {
		return Unconstrained;
	}
	return isFormal(named, formal) ? { ...Unconstrained, callable: isFunctionMode } : resolving(named, formal);
}

/** What `all` lets through unbounded: of no number at all, each one holds. */
function withoutNullable(this: void, abstract: Abstract, facts: GuardFactsLookup): Abstract {
	return { ...abstract, bounds: new Map([...abstract.bounds].filter(([measure]) => facts(measure)?.measures !== 'nullable')) };
}

function abstractOf(this: void, term: GuardTerm, formal: BrandedIdentifier, facts: GuardFactsLookup): Abstract {
	if(!GuardTerm.isCall(term) || !term.known) {
		return Unconstrained;
	}
	const operands = term.args.map(a => a.value);
	const [first, second] = operands;
	switch(term.fn) {
		case '&&':
		case '&':
			return both(abstractOf(first, formal, facts), abstractOf(second, formal, facts));
		case '||':
		case '|':
			return either(abstractOf(first, formal, facts), abstractOf(second, formal, facts));
		case 'all':
			return operands.length === 1 ? withoutNullable(abstractOf(first, formal, facts), facts) : Unconstrained;
		case '!':
			return GuardTerm.isCall(first) && first.known ? ofPredicate(first, formal, false, facts) : Unconstrained;
		case 'succeeds':
			return GuardTerm.isCall(first) ? ofCheck(first, formal, facts) : Unconstrained;
		case 'exists':
			return ofExists(term, formal);
		case 'is.element':
		case 'identical':
			return operands.length === 2 ? ofComparison(first, term.fn === 'identical' ? '==' : '%in%', second, formal, facts) : Unconstrained;
		case '%in%':
			return ofComparison(first, '%in%', second, formal, facts);
		default:
			if(term.fn === '==' && operands.length === 2 && isWholeTest(first, second, formal)) {
				return { ...Unconstrained, whole: true };
			}
			if(Swapped[term.fn] !== undefined && operands.length === 2) {
				return first.kind === 'constant' ? ofComparison(second, Swapped[term.fn], first, formal, facts) : ofComparison(first, term.fn, second, formal, facts);
			}
			return ofPredicate(term, formal, true, facts);
	}
}

/** A bound the way {@link FormalClaim.bounds} states it, without one that is not known. */
function boundsOf(this: void, bounds: Abstract['bounds']): Record<string, ClaimedRange> | undefined {
	const kept = [...bounds].filter(([, domain]) => domain.isValue() && (Number.isFinite(domain.lower) || Number.isFinite(domain.upper)));
	return kept.length === 0 ? undefined : Object.fromEntries(kept.map(([measure, { lower, upper }]) => {
		const [low, high] = [lower as number, upper as number];
		return [measure, [Number.isFinite(low) ? low : null, Number.isFinite(high) ? high : null]];
	}));
}

const Numbers = RValueType.Integer | RValueType.Double;

/** Whether `==` tells the values apart for every value without a class, as R turns `TRUE == 1` and `"1" == 1` true, which only a string claim survives. */
function comparesExactly(this: void, plain: TypeSet, values: BoundedSetDomain<string | number | boolean>): values is BoundedSetDomain<string | number | boolean> & { value: ReadonlySet<string | number | boolean> } {
	const kinds = new Set(values.isValue() ? [...values.value].map(v => typeof v) : []);
	return kinds.size === 1 && (kinds.has('string') || plain.leq(typeSet(kinds.has('number') ? Numbers : RValueType.Logical)));
}

function toClaim(this: void, abstract: Abstract): FormalClaim {
	const { types, plain, partial, classes, notNA, callable, resolves } = abstract;
	const values = comparesExactly(plain, abstract.values) ? abstract.values.value : undefined;
	/* `"a" > 5` holds in R, so a bound on the value says something only of a number */
	const bounds = plain.leq(typeSet(Numbers | RValueType.Logical)) ? abstract.bounds : new Map([...abstract.bounds].filter(([measure]) => measure !== 'value'));
	const stated = boundsOf(bounds);
	return {
		...(types.isTop() ? {} : { types: typeNames(typeBits(types)) }),
		...(plain.equals(types) || plain.isTop() ? {} : { unclassedTypes: typeNames(typeBits(plain)) }),
		...(values === undefined || values.size === 0 ? {} : { values: [...values], ...(partial ? { partial } : {}) }),
		...(classes === undefined ? {} : { classes: [...classes] }),
		...(stated === undefined ? {} : { bounds: stated }),
		...(notNA ? { notNA } : {}),
		...(callable ? { callable } : {}),
		...(abstract.whole ? { whole: true } : {}),
		...(resolves.size === 0 ? {} : { resolves: [...resolves.values()] })
	};
}

/** The functions that drop the fraction of a number, so `trunc(x) == x` holds only for a whole `x`. */
const Rounding: ReadonlySet<BrandedIdentifier> = new Set(['trunc', 'round', 'floor', 'ceiling', 'as.integer']);

/** Whether `a == b` asks the formal to be a whole number: `trunc(x) == x` either way around, or `x %% 1 == 0`. */
function isWholeTest(this: void, a: GuardTerm, b: GuardTerm, formal: BrandedIdentifier): boolean {
	const rounds = (r: GuardTerm, x: GuardTerm) => GuardTerm.isCall(r) && r.known === true && Rounding.has(r.fn) && r.args.length === 1 && isFormal(r.args[0].value, formal) && isFormal(x, formal);
	const modulo = (m: GuardTerm, zero: GuardTerm) => GuardTerm.isCall(m, '%%') && m.known === true && isFormal(m.args[0]?.value, formal) && m.args[1]?.value.kind === 'constant' && m.args[1].value.value === 1 && zero.kind === 'constant' && zero.value === 0;
	return rounds(a, b) || rounds(b, a) || modulo(a, b) || modulo(b, a);
}

/** A comparison relating what two formals hold, like `length(x) >= m`, which holds on a normal return unless something else let the call through. */
export interface ClaimedRelation {
	/** the comparison in R syntax */
	readonly holds:        string
	/** the formals it relates */
	readonly formals:      readonly BrandedIdentifier[]
	/** what lets a call through instead, in R syntax */
	readonly unless?:      string
	/** the same, as a claim, if it speaks of a single formal */
	readonly unlessClaim?: { readonly formal: BrandedIdentifier, readonly claim: FormalClaim }
}

/** The comparison within `term`, also within the `all` that `stopifnot` spells a vector of them with, `undefined` if it is none. */
function comparisonOf(this: void, term: GuardTerm): GuardCall | undefined {
	const inner = GuardTerm.isCall(term, 'all') && term.known && term.args.length === 1 ? term.args[0].value : term;
	return GuardTerm.isCall(inner) && inner.known && Swapped[inner.fn] !== undefined && inner.args.length === 2 ? inner : undefined;
}

/** The relations between formals the given conditions state, each one a comparison of two sides that read different formals. */
export function relationsOf(this: void, conditions: readonly GuardTerm[], facts: GuardFactsLookup): ClaimedRelation[] {
	return conditions.flatMap(condition => {
		const alternatives = GuardTerm.disjuncts(condition);
		const relating = alternatives.filter(alternative => {
			const sides = comparisonOf(alternative)?.args.map(a => GuardTerm.formalsOf(a.value));
			return sides !== undefined && sides.every(side => side.size > 0) && !setEquals(sides[0], sides[1]);
		});
		if(relating.length !== 1) {
			return [];
		}
		const [relation] = relating;
		const others = alternatives.filter(alternative => alternative !== relation);
		const unless = GuardTerm.any(...others);
		const [only, ...more] = GuardTerm.formalsOf(unless);
		const unlessClaim = only === undefined || more.length > 0 ? undefined : toClaim(abstractOf(unless, only, facts));
		return [{
			holds:   GuardTerm.render(relation),
			formals: [...GuardTerm.formalsOf(relation)],
			...(others.length === 0 ? {} : { unless: GuardTerm.render(unless) }),
			...(unlessClaim === undefined || Object.keys(unlessClaim).length === 0 ? {} : { unlessClaim: { formal: only, claim: unlessClaim } })
		}];
	});
}

/** A claim on one formal that holds unless something else lets the call through, like `missing(package) || is.character(character.only)`. */
export interface ConditionalClaim {
	readonly formal: BrandedIdentifier
	readonly claim:  FormalClaim
	/** what lets a call through instead, in R syntax */
	readonly unless: string
}

/** The claims the given conditions make on a formal unless something not about that formal holds, see {@link ConditionalClaim}. */
export function conditionalClaimsOf(this: void, conditions: readonly GuardTerm[], formals: readonly BrandedIdentifier[], facts: GuardFactsLookup): ConditionalClaim[] {
	return conditions.flatMap(condition => {
		const alternatives = GuardTerm.disjuncts(condition);
		return formals.flatMap(formal => {
			const about = alternatives.filter(a => setEquals(GuardTerm.formalsOf(a), new Set([formal])));
			const others = alternatives.filter(a => !GuardTerm.formalsOf(a).has(formal));
			if(about.length === 0 || others.length === 0 || about.length + others.length !== alternatives.length) {
				return [];
			}
			const claim = toClaim(about.map(a => abstractOf(a, formal, facts)).reduce(either));
			/* that a formal has to have a class unless another one passes is all dispatching leaves, not a claim */
			const onlyClassed = Object.keys(claim).length === 1 && claim.unclassedTypes?.length === 0;
			return Object.keys(claim).length === 0 || onlyClassed ? [] : [{ formal, claim, unless: GuardTerm.render(GuardTerm.any(...others)) }];
		});
	});
}

/** The conditions that hold in the case `when`: a clause offering what the case rules out loses that alternative, one offering the case itself asks nothing. */
function inCase(this: void, clauses: readonly CaseClause[], when: GuardTerm, otherwise: GuardTerm): { readonly all: GuardTerm[], readonly own: GuardTerm[] } {
	const [yes, no] = [GuardTerm.render(when), new Set(GuardTerm.disjuncts(otherwise).map(d => GuardTerm.render(d)))];
	const all: GuardTerm[] = [...GuardTerm.conjuncts(when)];
	const own: GuardTerm[] = [];
	for(const { requires } of clauses) {
		const alternatives = GuardTerm.disjuncts(requires);
		if(alternatives.some(a => GuardTerm.render(a) === yes)) {
			continue;
		}
		const kept = alternatives.filter(a => !no.has(GuardTerm.render(a)));
		if(kept.length + no.size === alternatives.length) {
			own.push(GuardTerm.any(...kept));
		}
		all.push(GuardTerm.any(...kept));
	}
	return { all, own };
}

/**
 * The cases of each formal: the first branch on it alone that the conditions were found under, as `if(is.logical(center)) ... else ...`,
 * where both ways something more is asked of it, each with what a normal return makes sure of in it.
 */
export function casesOf(this: void, clauses: readonly CaseClause[], formals: readonly BrandedIdentifier[], facts: GuardFactsLookup): Record<BrandedIdentifier, FormalCase[]> {
	const cases: Record<BrandedIdentifier, FormalCase[]> = {};
	const branches = [...new Map(clauses.flatMap(c => c.under ?? []).map(term => [GuardTerm.render(term), term])).values()];
	for(const formal of formals) {
		for(const when of branches.filter(b => setEquals(GuardTerm.formalsOf(b), new Set([formal])))) {
			const otherwise = GuardTerm.truth(when, false, facts);
			const split = [[when, inCase(clauses, when, otherwise)], [otherwise, inCase(clauses, otherwise, when)]] as const;
			if(!split.every(([, { own }]) => own.some(c => GuardTerm.formalsOf(c).has(formal)))) {
				continue;
			}
			cases[formal] = split.map(([term, { all }]) => {
				const relations = relationsOf(all, facts).filter(r => r.formals.includes(formal));
				return { when: GuardTerm.render(term), claim: toClaim(all.reduce<Abstract>((acc, c) => both(acc, abstractOf(c, formal, facts)), Unconstrained)), ...(relations.length > 0 ? { relations } : {}) };
			});
			break;
		}
	}
	return cases;
}

/** Whether every value passing `conditions` passes `implied` as far as the types can tell; as a wrong guess only loses a clause, not what is left. */
export function impliedBy(this: void, implied: GuardTerm, conditions: readonly GuardTerm[], formals: readonly BrandedIdentifier[], facts: GuardFactsLookup): boolean {
	const alternatives = GuardTerm.disjuncts(implied);
	/* what implies one of the alternatives implies all of them together */
	if(alternatives.length > 1) {
		return alternatives.some(alternative => impliedBy(alternative, conditions, formals, facts));
	}
	const mentioned = formals.filter(formal => GuardTerm.formalsOf(implied).has(formal));
	return mentioned.length === 1 && GuardTerm.isCall(implied) && mentioned.every(formal => {
		const known = conditions.reduce<Abstract>((acc, c) => both(acc, abstractOf(c, formal, facts)), Unconstrained);
		const { plain } = abstractOf(implied, formal, facts);
		return !known.types.isTop() && !plain.isTop() && known.types.leq(plain);
	});
}

/** What the given conditions, all of which hold on a normal return, claim about each of the given formals; a formal without any claim is left out. */
export function claimsOf(this: void, conditions: readonly GuardTerm[], formals: readonly BrandedIdentifier[], facts: GuardFactsLookup): Record<BrandedIdentifier, FormalClaim> {
	const claims: Record<BrandedIdentifier, FormalClaim> = {};
	for(const formal of formals) {
		const claim = toClaim(conditions.reduce<Abstract>((acc, c) => both(acc, abstractOf(c, formal, facts)), Unconstrained));
		if(Object.keys(claim).length > 0) {
			claims[formal] = claim;
		}
	}
	return claims;
}

/** One way a function returns normally: the value it returns, `undefined` if flowR cannot state it, and what holds on the way there. */
export interface ReturnedTerm {
	readonly value: GuardTerm | undefined
	readonly holds: readonly GuardTerm[]
}

/** What a function states of the values it returns, also by being a predicate, a measure, or a reader of the type. */
function returnedBy(this: void, facts: GuardFacts | undefined): ReturnedValue | 'argument' | undefined {
	if(facts?.returns !== undefined) {
		return facts.returns;
	} else if(facts?.predicate !== undefined) {
		return { types: RValueType.Logical, scalar: true, notNA: true };
	} else if(facts?.reads !== undefined) {
		return { types: RValueType.Character, scalar: true, notNA: true };
	}
	switch(facts?.measures) {
		case 'single':
			return { types: Numbers, scalar: true, notNA: true, count: true };
		/* `ncol` of a table of one dimension is `NA` */
		case 'nullable':
			return { types: RValueType.Integer | RValueType.Null, count: true };
		case 'elementwise':
			return { types: RValueType.Integer };
		default:
			return undefined;
	}
}

function ofReturned(this: void, { types, scalar, notNA, count, nonEmpty }: ReturnedValue): Abstract {
	const typed: Abstract = { ...ofTypes(types), notNA: notNA === true, whole: count === true };
	const counted = count ? both(typed, ofBound('value', 0, Infinity)) : typed;
	return scalar ? both(counted, ofBound('length', 1, 1)) : nonEmpty ? both(counted, ofBound('length', 1, Infinity)) : counted;
}

/** What a function is stated to return, a classed value bringing a method of its own making it a case of the unclassed one, see {@link ReturnedValue.dispatchesOn}. */
export function returnedClaimOf(this: void, returned: ReturnedValue): FormalClaim | undefined {
	const claim = toClaim(ofReturned(returned));
	if(Object.keys(claim).length === 0) {
		return undefined;
	}
	return returned.dispatchesOn === undefined ? claim : { cases: [{ when: `!is.object(${returned.dispatchesOn})`, claim }] };
}

/** The types `c` turns its elements into, from the weakest to the strongest. */
const Coerced: readonly RValueType[] = [RValueType.Logical, RValueType.Integer, RValueType.Double, RValueType.Complex, RValueType.Character];
const TypeOfSymbol: Readonly<Record<string, RValueType>> = { NULL: RValueType.Null, NA: RValueType.Logical, NaN: RValueType.Double, Inf: RValueType.Double, NA_integer_: RValueType.Integer, NA_real_: RValueType.Double, NA_character_: RValueType.Character, NA_complex_: RValueType.Complex };

function typeOfConstant(this: void, { lexeme, value }: GuardConstant): RValueType | undefined {
	switch(typeof value) {
		case 'string':
			return RValueType.Character;
		case 'boolean':
			return RValueType.Logical;
		case 'number':
			return lexeme.endsWith('L') ? RValueType.Integer : lexeme.endsWith('i') ? RValueType.Complex : RValueType.Double;
		default:
			return TypeOfSymbol[lexeme];
	}
}

/** What `c` of the constants is, a single one being itself. */
function ofConstants(this: void, constants: readonly GuardConstant[]): Abstract {
	const types = constants.map(typeOfConstant);
	if(types.includes(undefined)) {
		return Unconstrained;
	}
	const elements = constants.filter((_, at) => types[at] !== RValueType.Null);
	const ranks = types.filter(t => t !== RValueType.Null).map(t => Coerced.indexOf(t as RValueType));
	if(ranks.length === 0) {
		return both(ofTypes(RValueType.Null), ofBound('length', 0, 0));
	}
	const type = Coerced[Math.max(...ranks)];
	const values = elements.map(c => c.value);
	/* `NaN` and `Inf` are numbers to the parser */
	const known = values.every(v => v !== undefined && (typeof v !== 'number' || Number.isFinite(v)));
	const numbers = (type & Numbers) !== 0 && known ? values as number[] : undefined;
	const counted = both(ofTypes(type), ofBound('length', elements.length, elements.length));
	return {
		...(numbers === undefined ? counted : both(counted, ofBound('value', Math.min(...numbers), Math.max(...numbers)))),
		values: known ? ofValues(new Set(values as (string | number | boolean)[])) : NoValues,
		notNA:  values.every(v => v !== undefined && !Number.isNaN(v)),
		whole:  numbers?.every(n => Number.isInteger(n)) ?? false
	};
}

/** What the value of the term is, `conditions` holding of the formals. */
function ofValue(this: void, term: GuardTerm | undefined, conditions: readonly GuardTerm[], facts: GuardFactsLookup): Abstract {
	if(term?.kind === 'formal') {
		return conditions.reduce<Abstract>((acc, c) => both(acc, abstractOf(c, term.name, facts)), Unconstrained);
	}
	const constants = GuardTerm.constants(term);
	if(constants !== undefined && (!GuardTerm.isCall(term) || term.args.every(a => a.name === undefined))) {
		return ofConstants(constants);
	} else if(!GuardTerm.isCall(term) || !term.known) {
		return Unconstrained;
	}
	const [only] = term.args;
	/* the internal code of a function of R returns what that function does, as in `.Internal(toupper(x))` */
	if(term.fn === '.Internal' && term.args.length === 1 && GuardTerm.isCall(only.value)) {
		return ofValue({ ...only.value, known: true }, conditions, facts);
	}
	const returned = returnedBy(facts(GuardTerm.bareName(term.fn)));
	if(returned === 'argument') {
		return term.args.length === 0 ? ofConstants([]) : term.args.length === 1 ? ofValue(only.value, conditions, facts) : Unconstrained;
	}
	/* a method for a classed argument may return anything */
	return returned === undefined || returned.dispatchesOn !== undefined ? Unconstrained : ofReturned(returned);
}

/** What holds of the value of every normal return, given what holds of the formals on every one of them, `undefined` if that is nothing. */
export function returnsOf(this: void, returned: readonly ReturnedTerm[], conditions: readonly GuardTerm[], facts: GuardFactsLookup): FormalClaim | undefined {
	const claim = returned.length === 0 ? {} : toClaim(returned.map(r => ofValue(r.value, [...conditions, ...r.holds], facts)).reduce(either));
	return Object.keys(claim).length === 0 ? undefined : claim;
}

/** The formal the term hands back as it is. */
function passedOn(this: void, term: GuardTerm | undefined, facts: GuardFactsLookup): BrandedIdentifier | undefined {
	if(term?.kind === 'formal') {
		return term.name;
	}
	return GuardTerm.isCall(term) && term.known && term.args.length === 1 && returnedBy(facts(GuardTerm.bareName(term.fn))) === 'argument' ? passedOn(term.args[0].value, facts) : undefined;
}

/** The formal every normal return hands back unchanged, if there is one. */
export function returnedFormalOf(this: void, returned: readonly ReturnedTerm[], facts: GuardFactsLookup): BrandedIdentifier | undefined {
	const [first, ...rest] = returned.map(r => passedOn(r.value, facts));
	return rest.every(f => f === first) ? first : undefined;
}

/** `succeeds(f(x, ...))` in words: what the check `f` states of `x`, or that the call runs without an error. */
function succeedsInWords(this: void, call: GuardCall, facts: GuardFactsLookup): string {
	const checked = call.args[0]?.value;
	const claim = checked?.kind === 'formal' && facts(GuardTerm.bareName(call.fn))?.check !== undefined ? toClaim(ofCheck(call, checked.name, facts)) : undefined;
	/* the choices say what the type adds for anyone reading it */
	const said = claim === undefined || checked?.kind !== 'formal' ? [] : claimConditions(String(checked.name), claim.values === undefined ? claim : { values: claim.values, ...(claim.partial ? { partial: true } : {}) });
	return said.length > 0 ? said.join(' && ') : `${GuardTerm.render(call)} runs without an error`;
}

/**
 * A condition as a reader without flowR's notation reads it, `undefined` if it reads as written: each `succeeds` stated by what it checks,
 * and, for a condition of a call of a member of a group generic, a class letting the call through as the method it may bring.
 * @param group - the group generic the failing call dispatches through, like `Math`
 */
export function readingOf(this: void, condition: GuardTerm, facts: GuardFactsLookup, group?: BrandedIdentifier): string | undefined {
	const alternatives = GuardTerm.disjuncts(condition);
	const read = (term: GuardTerm) => {
		if(GuardTerm.isCall(term, 'succeeds') && term.known && GuardTerm.isCall(term.args[0]?.value)) {
			return succeedsInWords(term.args[0].value, facts);
		}
		const [of] = GuardTerm.isCall(term, 'is.object') && term.known ? term.args : [];
		return group !== undefined && of !== undefined ? `${GuardTerm.render(of.value)} may have a ${group} method` : undefined;
	};
	const readings = alternatives.map(read);
	return readings.every(r => r === undefined) ? undefined : alternatives.map((a, at) => readings[at] ?? GuardTerm.render(a)).join(' || ');
}

/** `a`, `a or b`, `a, b, or c`. */
function listed(this: void, words: readonly string[]): string {
	return words.length <= 2 ? words.join(' or ') : `${words.slice(0, -1).join(', ')}, or ${words[words.length - 1]}`;
}

/** The given types, by what they leave out if that is the shorter way of saying it. */
function typesInWords(this: void, types: readonly string[]): string {
	const left = typeNames(AnyType).filter(t => !types.includes(t));
	return left.length < types.length ? `anything but ${listed(left)}` : listed(types);
}

/** `{a, b}`, or the one value itself. */
function setOf(this: void, words: readonly (string | number | boolean)[]): string {
	return words.length === 1 ? String(words[0]) : `{${words.join(', ')}}`;
}

/**
 * Reads a claim on `formal` as conditions written the way R would test them, all of which hold, like
 * `typeof(m) in {integer, double}`, `length(m) == 1`, and `m >= 0`.
 */
export function claimConditions(this: void, formal: string, { types, unclassedTypes, values, partial, classes, bounds, notNA, callable, whole, resolves }: FormalClaim): string[] {
	const ofTypes = (named: readonly string[], unclassed: boolean) => {
		const left = typeNames(AnyType).filter(t => !named.includes(t));
		const said = left.length < named.length ? `typeof(${formal}) not in ${setOf(left)}` : `typeof(${formal}) in ${setOf(named)}`;
		return unclassed ? `${said} unless is.object(${formal})` : said;
	};
	const range = (measure: string, [lower, upper]: ClaimedRange) => {
		const of = measure === 'value' ? formal : `${measure}(${formal})`;
		return lower !== null && lower === upper ? [`${of} == ${lower}`]
			: [...lower === null ? [] : [`${of} >= ${lower}`], ...upper === null ? [] : [`${of} <= ${upper}`]];
	};
	return [
		...types === undefined ? [] : [ofTypes(types, false)],
		...unclassedTypes === undefined ? [] : [ofTypes(unclassedTypes, true)],
		...values === undefined ? [] : [`${formal} ${partial ? 'pmatches' : 'in'} ${setOf(values.map(v => JSON.stringify(v)))}`],
		...classes === undefined ? [] : [classes.length === 1 ? `inherits(${formal}, ${JSON.stringify(classes[0])})` : `inherits(${formal}, c(${classes.map(c => JSON.stringify(c)).join(', ')}))`],
		...Object.entries(bounds ?? {}).flatMap(([measure, bound]) => range(measure, bound)),
		...notNA ? [`!anyNA(${formal})`] : [],
		...callable ? [`is.function(match.fun(${formal}))`] : [],
		...whole ? [`trunc(${formal}) == ${formal}`] : [],
		...(resolves ?? []).map(r => `exists(${r.expression})`)
	];
}

/** Reads a claim in a few words each, as a page or a terminal shows it. */
export function claimWords(this: void, { types, unclassedTypes, values, partial, classes, bounds, notNA, callable, whole, resolves, cases }: FormalClaim): string[] {
	const range = (what: string, [lower, upper]: ClaimedRange) => lower !== null && lower === upper ? `${what} = ${lower}`
		: [lower === null ? '' : `${what} >= ${lower}`, upper === null ? '' : `${what} <= ${upper}`].filter(w => w !== '').join(', ');
	return [
		types === undefined ? '' : typesInWords(types),
		unclassedTypes === undefined ? '' : `${typesInWords(unclassedTypes)}, unless classed`,
		values === undefined ? '' : `one of ${values.join(', ')}${partial ? ' (or a prefix)' : ''}`,
		classes === undefined ? '' : `class ${listed(classes)}`,
		...Object.entries(bounds ?? {}).map(([measure, bound]) => range(measure, bound)),
		notNA ? 'not NA' : '',
		callable ? 'callable' : '',
		whole ? 'whole number' : '',
		...(resolves ?? []).map(r => `${r.expression} exists`),
		...(cases ?? []).map(c => `if ${c.when}: ${[...claimWords(c.claim), ...(c.relations ?? []).map(r => r.holds)].join(', ')}`)
	].filter(w => w !== '');
}

/** Each case of a claim as its condition and what holds in it, see {@link claimConditions}. */
export function caseConditions(this: void, formal: string, { cases }: FormalClaim): string[] {
	return (cases ?? []).map(c => `if ${c.when}: ${[...claimConditions(formal, c.claim), ...(c.relations ?? []).map(r => r.holds)].join(' && ')}`);
}

/** What a call returns in a few words, see {@link claimWords}: what holds of it, and the formal it hands back. */
export function returnWords(this: void, returns: FormalClaim | undefined, passes: BrandedIdentifier | undefined): string[] {
	return [...passes === undefined ? [] : [`the value of ${passes}`], ...claimWords(returns ?? {})];
}

/** The same as {@link claimConditions}, of the value a call returns, named `result`. */
export function returnConditions(this: void, returns: FormalClaim | undefined, passes: BrandedIdentifier | undefined): string[] {
	return [...passes === undefined ? [] : [`identical(result, ${passes})`], ...claimConditions('result', returns ?? {})];
}
