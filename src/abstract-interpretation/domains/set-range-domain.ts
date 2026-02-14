import { assertUnreachable } from '../../util/assert';
import { setEquals } from '../../util/collections/set';
import { Ternary } from '../../util/logic';
import { AbstractDomain, DEFAULT_INFERENCE_LIMIT, domainElementToString } from './abstract-domain';
import { Bottom, BottomSymbol, Top, TopSymbol } from './lattice';
import type { SatisfiableDomain } from './satisfiable-domain';
import { SetComparator } from './satisfiable-domain';
/* eslint-disable @typescript-eslint/unified-signatures */

/** The Top element of the set range domain with an empty set as minimum set and {@link Top} as range set */
export const SetRangeTop = { min: new Set<never>(), range: Top } as const satisfies SetRangeValue<unknown>;

/** The type of the actual values of the set range domain as tuple with a minimum set and range set of additional possible values (i.e. `[{"id","name"}, ∅]`, or `[{"id"}, {"score"}]`) */
type SetRangeValue<T> = { readonly min: ReadonlySet<T>, readonly range: ReadonlySet<T> | typeof Top };
/** The type of the Top element of the set range domain as tuple with the empty set as minimum set and {@link Top} as range set (i.e. `[∅, Top]`) */
type SetRangeTop = typeof SetRangeTop;
/** The type of the Bottom element of the set range domain as {@link Bottom} */
type SetRangeBottom = typeof Bottom;
/** The type of the abstract values of the set range domain that are Top, Bottom, or actual values */
type SetRangeLift<T> = SetRangeValue<T> | SetRangeTop | SetRangeBottom;
/** The type of the actual values of the set range domain with a finite range (the range cannot be Top) */
type SetRangeFinite<T> = { readonly min: ReadonlySet<T>, readonly range: ReadonlySet<T> };

/** The type of the actual values of the set range domain as array tuple with a minimum array and range array for better readability (e.g. `[["id","name"], []]`, or `[["id"], ["score"]]`) */
export type ArrayRangeValue<T> = { readonly min: T[], readonly range: T[] | typeof Top };

/** The type for the maximum number of elements in the minimum set and maximum set of the set range domain before over-approximation */
export type SetRangeLimit = { readonly min: number, readonly range: number };
const DefaultLimit = { min: DEFAULT_INFERENCE_LIMIT, range: DEFAULT_INFERENCE_LIMIT } as const satisfies SetRangeLimit;

/**
 * The set range abstract domain as range of possible value sets with a minimum set of values and a range of possible additional values
 * (similar to an interval-like structure with a lower bound and a difference to the upper bound).
 * The Bottom element is defined as {@link Bottom} symbol and the Top element is defined as the range `[∅, Top]` where the minimum set is the empty set and the range is {@link Top}.
 * @template T     - Type of the values in the sets in the abstract domain
 * @template Value - Type of the constraint in the abstract domain (Top, Bottom, or an actual value)
 */
export class SetRangeDomain<T, Value extends SetRangeLift<T> = SetRangeLift<T>>
	extends AbstractDomain<ReadonlySet<T>, SetRangeValue<T>, SetRangeTop, SetRangeBottom, Value>
	implements SatisfiableDomain<ReadonlySet<T>> {

	public readonly limit:    SetRangeLimit;
	private readonly setType: typeof Set<T>;

	/**
	 * @param limit -  A limit for the maximum number of elements to store in the minimum set and maximum set before over-approximation
	 * @param newSet - An optional set constructor for the domain elements if the type `T` is not storable in a HashSet
	 */
	constructor(value: Value | ArrayRangeValue<T>, limit: SetRangeLimit | number = DefaultLimit, setType: typeof Set<T> = Set) {
		limit = typeof limit === 'number' ? { min: limit, range: limit } : limit;

		if(value !== Bottom) {
			const minSet = new setType(value.min);
			const rangeSet = value.range === Top ? Top : new setType(value.range);
			const minExceeds = minSet.size > limit.min;
			const rangeExceeds = rangeSet === Top || rangeSet.size > limit.range || minSet.size + rangeSet.size > limit.min + limit.range;

			const min = minExceeds ? new setType(minSet.values().take(limit.min)) : minSet;
			const range = rangeExceeds ? Top : minSet.union(rangeSet).difference(min);
			super({ min, range } as SetRangeValue<T> as Value);
		} else {
			super(value);
		}
		this.limit = limit;
		this.setType = setType;
	}

	public create(value: SetRangeLift<T> | ArrayRangeValue<T>): this;
	public create(value: SetRangeLift<T> | ArrayRangeValue<T>): SetRangeDomain<T> {
		return new SetRangeDomain(value, this.limit, this.setType);
	}

	/**
	 * The minimum set (lower bound) of the set range representing all values that must exist (subset of {@link upper}).
	 */
	public lower(): Value extends SetRangeValue<T> ? ReadonlySet<T> : ReadonlySet<T> | typeof Bottom {
		if(this.value === Bottom) {
			return Bottom as Value extends SetRangeValue<T> ? ReadonlySet<T> : ReadonlySet<T> | typeof Bottom;
		}
		return this.value.min;
	}

	/**
	 * The maximum set (upper bound) of the set range representing all values that can possibly exist (union of {@link lower} and range).
	 */
	public upper(): Value extends SetRangeFinite<T> ? ReadonlySet<T> : Value extends SetRangeValue<T> ? ReadonlySet<T> | typeof Top : ReadonlySet<T> | typeof Top | typeof Bottom {
		if(this.value === Bottom) {
			return Bottom as Value extends SetRangeFinite<T> ? ReadonlySet<T> : Value extends SetRangeValue<T> ? ReadonlySet<T> | typeof Top : ReadonlySet<T> | typeof Top | typeof Bottom;
		} else if(this.value.range == Top) {
			return Top as Value extends SetRangeFinite<T> ? ReadonlySet<T> : ReadonlySet<T> | typeof Top;
		}
		return this.value.min.union(this.value.range) as ReadonlySet<T> as Value extends SetRangeFinite<T> ? ReadonlySet<T> : ReadonlySet<T> | typeof Top;
	}

	public static top<T>(limit?: SetRangeLimit | number, setType?: typeof Set<T>): SetRangeDomain<T, SetRangeTop> {
		return new SetRangeDomain(SetRangeTop, limit, setType);
	}

	public static bottom<T>(limit?: SetRangeLimit | number, setType?: typeof Set<T>): SetRangeDomain<T, SetRangeBottom> {
		return new SetRangeDomain(Bottom, limit, setType);
	}

	public static abstract<T>(concrete: ReadonlySet<ReadonlySet<T>> | typeof Top, limit?: SetRangeLimit | number, setType?: typeof Set<T>): SetRangeDomain<T> {
		if(concrete === Top) {
			return SetRangeDomain.top(limit, setType);
		} else if(concrete.size === 0) {
			return SetRangeDomain.bottom(limit, setType);
		}
		const lower = concrete.values().reduce((result, set) => result.intersection(set));
		const upper = concrete.values().reduce((result, set) => result.union(set));

		return new SetRangeDomain({ min: lower, range: upper.difference(lower) }, limit, setType);
	}

	public top(): this & SetRangeDomain<T, SetRangeTop>;
	public top(): SetRangeDomain<T, SetRangeTop> {
		return SetRangeDomain.top(this.limit, this.setType);
	}

	public bottom(): this & SetRangeDomain<T, SetRangeBottom>;
	public bottom(): SetRangeDomain<T, SetRangeBottom> {
		return SetRangeDomain.bottom(this.limit, this.setType);
	}

	public equals(other: this): Ternary {
		if(this.value === other.value) {
			return Ternary.Always;
		} else if(this.value === Bottom || other.value === Bottom || !setEquals(this.value.min, other.value.min)) {
			return Ternary.Never;
		} else if(this.value.range === other.value.range) {
			return Ternary.Always;
		}
		if(this.value.range !== Top && other.value.range !== Top && setEquals(this.value.range, other.value.range)) {
			return Ternary.Always;
		}
		return Ternary.Never;
	}

	public leq(other: this): Ternary {
		const thisLower = this.lower(), thisUpper = this.upper();
		const otherLower = other.lower(), otherUpper = other.upper();

		if(thisLower === Bottom || thisUpper === Bottom) {
			return Ternary.Always;
		} else if(otherLower === Bottom || otherUpper === Bottom || !otherLower.isSubsetOf(thisLower)) {
			return Ternary.Never;
		} else if(otherUpper === Top) {
			return Ternary.Always;
		}
		if(thisUpper !== Top && thisUpper.isSubsetOf(otherUpper)) {
			return Ternary.Always;
		}
		return Ternary.Never;
	}

	public join(other: SetRangeLift<T> | ArrayRangeValue<T>): this;
	public join(other: this): this;
	public join(other: this | SetRangeLift<T> | ArrayRangeValue<T>): this {
		other = other instanceof SetRangeDomain ? other : this.create(other);
		const thisLower = this.lower(), thisUpper = this.upper();
		const otherLower = other.lower(), otherUpper = other.upper();

		if(thisLower === Bottom || thisUpper === Bottom) {
			return this.create(other.value);
		} else if(otherLower === Bottom || otherUpper === Bottom) {
			return this.create(this.value);
		}
		const joinLower = thisLower.intersection(otherLower);
		let joinUpper;

		if(thisUpper === Top || otherUpper === Top) {
			joinUpper = Top;
		} else {
			joinUpper = thisUpper.union(otherUpper);
		}
		return this.create({ min: joinLower, range: joinUpper === Top ? Top : joinUpper.difference(joinLower) });
	}

	public meet(other: SetRangeLift<T> | ArrayRangeValue<T>): this;
	public meet(other: this): this;
	public meet(other: this | SetRangeLift<T> | ArrayRangeValue<T>): this {
		other = other instanceof SetRangeDomain ? other : this.create(other);
		const thisLower = this.lower(), thisUpper = this.upper();
		const otherLower = other.lower(), otherUpper = other.upper();

		if(thisLower === Bottom || thisUpper === Bottom || otherLower === Bottom || otherUpper === Bottom) {
			return this.bottom();
		}
		const meetLower = thisLower.union(otherLower);
		let meetUpper;

		if(thisUpper === Top) {
			meetUpper = otherUpper;
		} else if(otherUpper === Top) {
			meetUpper = thisUpper;
		} else {
			meetUpper = thisUpper.intersection(otherUpper);
		}
		if(meetUpper !== Top && !meetLower.isSubsetOf(meetUpper)) {
			return this.bottom();
		}
		return this.create({ min: meetLower, range: meetUpper === Top ? Top : meetUpper.difference(meetLower) });
	}

	/**
	 * Creates the union of this abstract value and another abstract value by creating the union of the minimum and maximum set, respectively.
	 */
	public union(other: this | SetRangeLift<T> | ArrayRangeValue<T>): this {
		other = other instanceof SetRangeDomain ? other : this.create(other);
		const thisLower = this.lower(), thisUpper = this.upper();
		const otherLower = other.lower(), otherUpper = other.upper();

		if(thisLower === Bottom || thisUpper === Bottom) {
			return this.create(other.value);
		} else if(otherLower === Bottom || otherUpper === Bottom) {
			return this.create(this.value);
		}
		const unionLower = thisLower.union(otherLower);
		let unionUpper;

		if(thisUpper === Top || otherUpper === Top) {
			unionUpper = Top;
		} else {
			unionUpper = thisUpper.union(otherUpper);
		}
		return this.create({ min: unionLower, range: unionUpper === Top ? Top : unionUpper.difference(unionLower) });
	}

	/**
	 * Creates the intersection of this abstract value and another abstract value by creating the intersection of the minimum and maximum set, respectively.
	 */
	public intersect(other: this | SetRangeLift<T> | ArrayRangeValue<T>): this {
		other = other instanceof SetRangeDomain ? other : this.create(other);
		const thisLower = this.lower(), thisUpper = this.upper();
		const otherLower = other.lower(), otherUpper = other.upper();

		if(thisLower === Bottom || thisUpper === Bottom || otherLower === Bottom || otherUpper === Bottom) {
			return this.bottom();
		}
		const intersectLower = thisLower.intersection(otherLower);
		let intersectUpper;

		if(thisUpper === Top) {
			intersectUpper = otherUpper;
		} else if(otherUpper === Top) {
			intersectUpper = thisUpper;
		} else {
			intersectUpper = thisUpper.intersection(otherUpper);
		}
		return this.create({
			min:   intersectLower,
			range: intersectUpper === Top ? Top : intersectUpper.difference(intersectLower)
		});
	}

	/**
	 * Subtracts another abstract value from the current abstract value by removing all elements of the other abstract value from the current abstract value.
	 */
	public subtract(other: this | SetRangeLift<T> | ArrayRangeValue<T>): this {
		other = other instanceof SetRangeDomain ? other : this.create(other);
		const thisLower = this.lower(), thisUpper = this.upper();
		const otherLower = other.lower(), otherUpper = other.upper();

		if(thisLower === Bottom || thisUpper === Bottom) {
			return this.bottom();
		} else if(otherLower === Bottom || otherUpper === Bottom) {
			return this.create(this.value);
		}
		let subLower;

		if(otherUpper === Top) {
			subLower = new Set<never>();
		} else {
			subLower = thisLower.difference(otherUpper);
		}
		let subUpper;

		if(thisUpper === Top) {
			subUpper = Top;
		} else if(otherUpper === Top) {
			subUpper = thisUpper.difference(otherLower);
		} else {
			subUpper = thisUpper.difference(otherUpper);
		}
		return this.create({ min: subLower, range: subUpper === Top ? Top : subUpper.difference(subLower) });
	}

	public widen(other: this): this {
		const thisLower = this.lower(), thisUpper = this.upper();
		const otherLower = other.lower(), otherUpper = other.upper();

		if(thisLower === Bottom || thisUpper === Bottom) {
			return this.create(other.value);
		} else if(otherLower === Bottom || otherUpper === Bottom) {
			return this.create(this.value);
		}
		let widenLower;

		if(!thisLower.isSubsetOf(otherLower)) {
			widenLower = new Set<never>();
		} else {
			widenLower = thisLower;
		}
		let widenUpper;

		if(thisUpper === Top || otherUpper === Top || !otherUpper.isSubsetOf(thisUpper)) {
			widenUpper = Top;
		} else {
			widenUpper = thisUpper;
		}
		return this.create({ min: widenLower, range: widenUpper === Top ? Top : widenUpper.difference(widenLower) });
	}

	public narrow(other: this): this {
		const thisLower = this.lower(), thisUpper = this.upper();
		const otherLower = other.lower(), otherUpper = other.upper();

		if(thisLower === Bottom || thisUpper === Bottom || otherLower === Bottom || otherUpper === Bottom) {
			return this.bottom();
		}
		let meetUpper;

		if(thisUpper === Top) {
			meetUpper = otherUpper;
		} else if(otherUpper === Top) {
			meetUpper = thisUpper;
		} else {
			meetUpper = thisUpper.intersection(otherUpper);
		}
		if(meetUpper !== Top && !thisLower.union(otherLower).isSubsetOf(meetUpper)) {
			return this.bottom();
		}
		let narrowLower;

		if(thisLower.size === 0) {
			narrowLower = otherLower;
		} else {
			narrowLower = thisLower;
		}
		let narrowUpper;

		if(thisUpper === Top) {
			narrowUpper = otherUpper;
		} else {
			narrowUpper = thisUpper;
		}
		return this.create({ min: narrowLower, range: narrowUpper === Top ? Top : narrowUpper.difference(narrowLower) });
	}

	public concretize(limit: number): ReadonlySet<ReadonlySet<T>> | typeof Top {
		if(this.value === Bottom) {
			return new Set();
		} else if(this.value.range === Top || 2 ** (this.value.range.size) > limit) {
			return Top;
		}
		const subsets = [new this.setType()];

		for(const element of this.value.range) {
			const newSubsets = subsets.map(subset => new this.setType([...subset, element]));

			for(const subset of newSubsets) {
				subsets.push(subset);
			}
		}
		return new Set(subsets.map(subset => this.value === Bottom ? subset : this.value.min.union(subset)));
	}

	public abstract(concrete: ReadonlySet<ReadonlySet<T>> | typeof Top): this;
	public abstract(concrete: ReadonlySet<ReadonlySet<T>> | typeof Top): SetRangeDomain<T> {
		return SetRangeDomain.abstract(concrete, this.limit);
	}

	public satisfies(set: ReadonlySet<T> | T[], comparator: SetComparator = SetComparator.Equal): Ternary {
		const value = new this.setType(set);
		const lower = this.lower(), upper = this.upper();

		if(lower === Bottom || upper === Bottom) {
			return Ternary.Never;
		}
		switch(comparator) {
			case SetComparator.Equal: {
				if(lower.isSubsetOf(value) && (upper === Top || value.isSubsetOf(upper))) {
					return upper !== Top && lower.size === upper.size ? Ternary.Always : Ternary.Maybe;
				}
				return Ternary.Never;
			}
			case SetComparator.SubsetOrEqual: {
				if(upper === Top || value.isSubsetOf(upper)) {
					return value.isSubsetOf(lower) ? Ternary.Always : Ternary.Maybe;
				}
				return Ternary.Never;
			}
			case SetComparator.Subset: {
				if(upper === Top || (value.isSubsetOf(upper) && !setEquals(value, upper))) {
					return value.isSubsetOf(lower) && !setEquals(value, lower) ? Ternary.Always : Ternary.Maybe;
				}
				return Ternary.Never;
			}
			default: {
				assertUnreachable(comparator);
			}
		}
	}

	/**
	 * Extends the minimum set of the current abstract value down to the empty set.
	 */
	public widenDown(): this {
		const upper = this.upper();

		if(upper === Bottom) {
			return this.bottom();
		} else {
			return this.create({ min: new this.setType(), range: upper });
		}
	}

	/**
	 * Extends the maximum set of the current abstract value up to {@link Top}.
	 */
	public widenUp(): this {
		const lower = this.lower();

		if(lower === Bottom) {
			return this.bottom();
		} else {
			return this.create({ min: lower, range: Top });
		}
	}

	public toJson(): unknown {
		if(this.value === Bottom) {
			return this.value.description;
		}
		const min = this.value.min.values().toArray();
		const range = this.value.range === Top ? this.value.range.description : this.value.range.values().toArray();

		return { min, range };
	}

	public toString(): string {
		if(this.value === Bottom) {
			return BottomSymbol;
		} else if(this.value.range === Top) {
			const minString = this.value.min.values().map(domainElementToString).toArray().join(', ');

			return `[{${minString}}, ${TopSymbol}]`;
		}
		const minString = this.value.min.values().map(domainElementToString).toArray().join(', ');
		const rangeString = this.value.range.values().map(domainElementToString).toArray().join(', ');

		return `[{${minString}}, {${rangeString}}]`;
	}

	public isTop(): this is SetRangeDomain<T, SetRangeTop> {
		return this.value !== Bottom && this.value.min.size === 0 && this.value.range === Top;
	}

	public isBottom(): this is SetRangeDomain<T, SetRangeBottom> {
		return this.value === Bottom;
	}

	public isValue(): this is SetRangeDomain<T, SetRangeValue<T>> {
		return this.value !== Bottom;
	}

	public isFinite(): this is SetRangeDomain<T, SetRangeFinite<T>> {
		return this.value !== Bottom && this.value.range !== Top;
	}
}
