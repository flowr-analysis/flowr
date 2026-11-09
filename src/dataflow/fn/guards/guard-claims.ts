import type { BrandedIdentifier } from '../../environments/identifier';
import { IntervalDomain } from '../../../abstract-interpretation/domains/interval-domain';
import { BoundedSetDomain } from '../../../abstract-interpretation/domains/bounded-set-domain';
import { GuardTerm, type GuardCall, type GuardConstant } from './guard-term';
import { AnyType, RValueType, type GuardFactsLookup, type RValueTypes } from '../../environments/guard-facts';
import { typeNames } from './guard-knowledge';

/** The inclusive bounds of a number, the upper one `Infinity` if there is none; JSON turns that into `null`, so it is stated as such. */
export type ClaimedRange = readonly [lower: number | null, upper: number | null];

/**
 * What a call that returns normally has made sure of one of the formals of a function, each read off the guards.
 * A field left out claims nothing.
 */
export interface FormalClaim {
	/** the value has one of these types (see {@link RValueType}) */
	readonly types?:      readonly string[]
	/** the same, for a value without a class attribute, as those can bring methods of their own; only stated if it says more than {@link FormalClaim.types} */
	readonly plainTypes?: readonly string[]
	/** a character value holds only these, or abbreviates one of them if {@link FormalClaim.partial} is set, numbers and logicals are only stated for a value that is one */
	readonly values?:     readonly (string | number | boolean)[]
	/** the {@link FormalClaim.values} are matched partially, as `match.arg` does */
	readonly partial?:    boolean
	/** `class(x)` holds at least one of these */
	readonly classes?:    readonly string[]
	/** the bounds of what the formal measures: `value` for a number without a class attribute, only stated if the formal is one, else `length`, `nchar`, `nrow`, `ncol`, `NROW`, or `NCOL`, which are taken to be whole numbers, as an S3 method of `length` returning anything else breaks its contract */
	readonly bounds?:     Readonly<Record<string, ClaimedRange>>
	/** no element is `NA` */
	readonly notNA?:      boolean
	/** must be usable as a function: being one, naming one, or being bound to a name another function can be found by */
	readonly callable?:   boolean
	/** what the formal has to complete into a name that exists, like `paste0("f_", x)` */
	readonly resolves?:   readonly ClaimedName[]
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

const Unconstrained: Abstract = { types: typeSet(AnyType), plain: typeSet(AnyType), values: NoValues, partial: false, classes: undefined, bounds: new Map(), notNA: false, callable: false, resolves: new Map() };

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
			const types = ofTypes(predicate.yes, predicate.classed);
			const typed = predicate.callable ? { ...types, callable: true } : types;
			return predicate.scalar ? both(typed, ofBound('length', 1, 1)) : typed;
		}
		const ruledOut = predicate.exact ? ofTypes(AnyType & ~predicate.yes) : Unconstrained;
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
	if(facts(name)?.applies !== undefined && isFormal(call.args[0]?.value, formal)) {
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
		...(plain.equals(types) || plain.isTop() ? {} : { plainTypes: typeNames(typeBits(plain)) }),
		...(values === undefined || values.size === 0 ? {} : { values: [...values], ...(partial ? { partial } : {}) }),
		...(classes === undefined ? {} : { classes: [...classes] }),
		...(stated === undefined ? {} : { bounds: stated }),
		...(notNA ? { notNA } : {}),
		...(callable ? { callable } : {}),
		...(resolves.size === 0 ? {} : { resolves: [...resolves.values()] })
	};
}

/** Whether every value passing `conditions` passes `implied` as far as the types can tell; as a wrong guess only loses a clause, not what is left. */
export function impliedBy(this: void, implied: GuardTerm, conditions: readonly GuardTerm[], formals: readonly BrandedIdentifier[], facts: GuardFactsLookup): boolean {
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

/** The given types, by what they leave out if that is the shorter way of saying it. */
function typesInWords(this: void, types: readonly string[]): string {
	const left = typeNames(AnyType).filter(t => !types.includes(t));
	return left.length < types.length ? `not ${left.join('|')}` : types.join('|');
}

/** Reads a claim in a few words each, as a page or a terminal shows it. */
export function claimWords(this: void, { types, plainTypes, values, partial, classes, bounds, notNA, callable, resolves }: FormalClaim): string[] {
	const range = (what: string, [lower, upper]: ClaimedRange) => lower !== null && lower === upper ? `${what} = ${lower}`
		: [lower === null ? '' : `${what} >= ${lower}`, upper === null ? '' : `${what} <= ${upper}`].filter(w => w !== '').join(', ');
	return [
		types === undefined ? '' : typesInWords(types),
		plainTypes === undefined ? '' : `${typesInWords(plainTypes)} unless classed`,
		values === undefined ? '' : `one of ${values.join(', ')}${partial ? ' (or a prefix)' : ''}`,
		classes === undefined ? '' : `class ${classes.join('|')}`,
		...Object.entries(bounds ?? {}).map(([measure, bound]) => range(measure, bound)),
		notNA ? 'not NA' : '',
		callable ? 'callable' : '',
		...(resolves ?? []).map(r => `${r.expression} exists`)
	].filter(w => w !== '');
}
