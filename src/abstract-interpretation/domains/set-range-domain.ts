import { assertUnreachable } from '../../util/assert';
import { setEquals } from '../../util/collections/set';
import { Ternary } from '../../util/logic';
import { AbstractDomain, DEFAULT_INFERENCE_LIMIT, domainElementToString } from './abstract-domain';
import { Bottom, Top } from './lattice';
import type { SatisfiableDomain } from './satisfiable-domain';
import { SetComparator } from './satisfiable-domain';
/* eslint-disable @typescript-eslint/unified-signatures */

/** The Top element of the set range domain with an empty set as minimum set and {@link Top} as range set */
export const SetRangeTop = [new Set<never>(), Top] as const satisfies SetRangeValue<unknown>;

/** The type of the actual values of the set range domain as tuple with a minimum set and range set of additional possible values */
type SetRangeValue<T> = readonly [min: ReadonlySet<T>, range: ReadonlySet<T> | typeof Top];
/** The type of the Top element of the set range domain as tuple with the empty set as minimum set and {@link Top} as range set (i.e. `[∅, Top]`) */
type SetRangeTop = typeof SetRangeTop;
/** The type of the Bottom element of the set range domain as {@link Bottom} */
type SetRangeBottom = typeof Bottom;
/** The type of the abstract values of the set range domain that are Top, Bottom, or actual values */
type SetRangeLift<T> = SetRangeValue<T> | SetRangeTop | SetRangeBottom;

export type ArrayRangeValue<T> = readonly [min: T[], range: T[] | typeof Top];

export type SetRangeLimit = readonly [min: number, range: number];
const DefaultLimit = [DEFAULT_INFERENCE_LIMIT, DEFAULT_INFERENCE_LIMIT] as const satisfies SetRangeLimit;

/**
 * The set range abstract domain as range of possible value sets with a minimum set of values and a range of possible additional values
 * (similar to an interval like structure with a lower bound and a difference to the upper bound).
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
	 * @param limit -  A limit for the maximum number of elements to store in the set
	 * @param newSet - An optional set constructor for the domain elements if the type `T` is not storable in a HashSet
	 */
	constructor(value: Value | ArrayRangeValue<T>, limit: SetRangeLimit | number = DefaultLimit, setType: typeof Set<T> = Set) {
		limit = typeof limit === 'number' ? [limit, limit] : limit;

		if(value !== Bottom) {
			const sizeMin = Array.isArray(value[0]) ? value[0].length : value[0].size;
			const sizeRange = value[1] === Top ? Infinity : Array.isArray(value[1]) ? value[1].length : value[1].size;
			const min = sizeMin > limit[0] ? new setType([...value[0]].slice(0, limit[0])) : new setType(value[0]);
			const range = (value[1] === Top || sizeRange > limit[1] || sizeMin + sizeRange > limit[0] + limit[1]) ? Top : new setType([...value[0], ...value[1]]).difference(min);
			super([min, range] as SetRangeValue<T> as Value);
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
	 * The minimum set of the set range representing all values that must exist (subset of {@link max}).
	 */
	public get min(): Value extends SetRangeBottom ? SetRangeValue<T>[0] | typeof Bottom : SetRangeValue<T>[0] {
		if(this.value === Bottom) {
			return Bottom as Value extends SetRangeBottom ? SetRangeValue<T>[0] | typeof Bottom : SetRangeValue<T>[0];
		}
		return this.value[0];
	}

	/**
	 * The maximum set of the set range representing all values that can possibly exist (union of {@link min} and range).
	 */
	public get max(): Value extends SetRangeBottom ? SetRangeValue<T>[1] | typeof Bottom : SetRangeValue<T>[1] {
		if(this.value === Bottom) {
			return Bottom as Value extends SetRangeBottom ? SetRangeValue<T>[1] | typeof Bottom : SetRangeValue<T>[1];
		}
		return this.value[1] === Top ? Top : this.value[0].union(this.value[1]);
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
		const min = concrete.values().reduce((result, set) => result.intersection(set));
		const max = concrete.values().reduce((result, set) => result.union(set));

		return new SetRangeDomain([min, max.difference(min)], limit, setType);
	}

	public top(): this & SetRangeDomain<T, SetRangeTop>;
	public top(): SetRangeDomain<T, SetRangeTop> {
		return SetRangeDomain.top(this.limit, this.setType);
	}

	public bottom(): this & SetRangeDomain<T, SetRangeBottom>;
	public bottom(): SetRangeDomain<T, SetRangeBottom> {
		return SetRangeDomain.bottom(this.limit, this.setType);
	}

	public equals(other: this): boolean {
		if(this.value === other.value) {
			return true;
		} else if(this.value === Bottom || other.value === Bottom || !setEquals(this.value[0], other.value[0])) {
			return false;
		} else if(this.value[1] === other.value[1]) {
			return true;
		}
		return this.value[1] !== Top && other.value[1] !== Top && setEquals(this.value[1], other.value[1]);
	}

	public leq(other: this): boolean {
		if(this.min === Bottom || this.max === Bottom) {
			return true;
		} else if(other.min === Bottom || other.max === Bottom || !other.min.isSubsetOf(this.min)) {
			return false;
		} else if(other.max === Top) {
			return true;
		}
		return this.max !== Top && this.max.isSubsetOf(other.max);
	}

	public join(other: this): this;
	public join(other: SetRangeLift<T> | ArrayRangeValue<T>): this;
	public join(other: this | SetRangeLift<T> | ArrayRangeValue<T>): this {
		other = other instanceof SetRangeDomain ? other : this.create(other);

		if(this.min === Bottom || this.max === Bottom) {
			return this.create(other.value);
		} else if(other.min === Bottom || other.max === Bottom) {
			return this.create(this.value);
		}
		const minJoin = this.min.intersection(other.min);
		let maxJoin;

		if(this.max === Top || other.max === Top) {
			maxJoin = Top;
		} else {
			maxJoin = this.max.union(other.max);
		}
		return this.create([minJoin, maxJoin === Top ? Top : maxJoin.difference(minJoin)]);
	}

	public meet(other: this): this;
	public meet(other: SetRangeLift<T> | ArrayRangeValue<T>): this;
	public meet(other: this | SetRangeLift<T> | ArrayRangeValue<T>): this {
		other = other instanceof SetRangeDomain ? other : this.create(other);

		if(this.min === Bottom || this.max === Bottom || other.min === Bottom || other.max === Bottom) {
			return this.bottom();
		}
		const minMeet = this.min.union(other.min);
		let maxMeet;

		if(this.max === Top) {
			maxMeet = other.max;
		} else if(other.max === Top) {
			maxMeet = this.max;
		} else {
			maxMeet = this.max.intersection(other.max);
		}
		if(maxMeet !== Top && !minMeet.isSubsetOf(maxMeet)) {
			return this.bottom();
		}
		return this.create([minMeet, maxMeet === Top ? Top : maxMeet.difference(minMeet)]);
	}

	/**
	 * Creates the union of this abstract value and another abstract value by creating the union of the minimum and maximum set, respectively.
	 */
	public union(other: this | SetRangeLift<T> | ArrayRangeValue<T>): this {
		other = other instanceof SetRangeDomain ? other : this.create(other);

		if(this.min === Bottom || this.max === Bottom) {
			return this.create(other.value);
		} else if(other.min === Bottom || other.max === Bottom) {
			return this.create(this.value);
		}
		const minAdd = this.min.union(other.min);
		let maxAdd;

		if(this.max === Top || other.max === Top) {
			maxAdd = Top;
		} else {
			maxAdd = this.max.union(other.max);
		}
		return this.create([minAdd, maxAdd === Top ? Top : maxAdd.difference(minAdd)]);
	}

	/**
	 * Creates the intersection of this abstract value and another abstract value by creating the intersection of the minimum and maximum set, respectively.
	 */
	public intersect(other: this | SetRangeLift<T> | ArrayRangeValue<T>): this {
		other = other instanceof SetRangeDomain ? other : this.create(other);

		if(this.min === Bottom || this.max === Bottom || other.min === Bottom || other.max === Bottom) {
			return this.bottom();
		}
		const minIntersect = this.min.intersection(other.min);
		let maxIntersect;

		if(this.max === Top) {
			maxIntersect = other.max;
		} else if(other.max === Top) {
			maxIntersect = this.max;
		} else {
			maxIntersect = this.max.intersection(other.max);
		}
		return this.create([minIntersect, maxIntersect === Top ? Top : maxIntersect.difference(minIntersect)]);
	}

	/**
	 * Subtracts another abstract value from the current abstract value by removing all elements of the other abstract value from the current abstract value.
	 */
	public subtract(other: this | SetRangeLift<T> | ArrayRangeValue<T>): this {
		other = other instanceof SetRangeDomain ? other : this.create(other);

		if(this.min === Bottom || this.max === Bottom) {
			return this.bottom();
		} else if(other.min === Bottom || other.max === Bottom) {
			return this.create(this.value);
		}
		let minSub;

		if(other.max === Top) {
			minSub = new Set<never>();
		} else {
			minSub = this.min.difference(other.max);
		}
		let maxSub;

		if(this.max === Top) {
			maxSub = Top;
		} else if(other.max === Top) {
			maxSub = this.max.difference(other.min);
		} else {
			maxSub = this.max.difference(other.max);
		}
		return this.create([minSub, maxSub === Top ? Top : maxSub.difference(minSub)]);
	}

	public widen(other: this): this {
		if(this.min === Bottom || this.max === Bottom) {
			return this.create(other.value);
		} else if(other.min === Bottom || other.max === Bottom) {
			return this.create(this.value);
		}
		let minWiden;

		if(!this.min.isSubsetOf(other.min)) {
			minWiden = new Set<never>();
		} else {
			minWiden = this.min;
		}
		let maxWiden;

		if(this.max === Top || other.max === Top || !other.max.isSubsetOf(this.max)) {
			maxWiden = Top;
		} else {
			maxWiden = this.max;
		}
		return this.create([minWiden, maxWiden === Top ? Top : maxWiden.difference(minWiden)]);
	}

	public narrow(other: this): this {
		if(this.min === Bottom || this.max === Bottom || other.min === Bottom || other.max === Bottom) {
			return this.bottom();
		}
		let maxMeet;

		if(this.max === Top) {
			maxMeet = other.max;
		} else if(other.max === Top) {
			maxMeet = this.max;
		} else {
			maxMeet = this.max.intersection(other.max);
		}
		if(maxMeet !== Top && !this.min.union(other.min).isSubsetOf(maxMeet)) {
			return this.bottom();
		}
		let minNarrow;

		if(this.min.size === 0) {
			minNarrow = other.min;
		} else {
			minNarrow = this.min;
		}
		let maxNarrow;

		if(this.max === Top) {
			maxNarrow = other.max;
		} else {
			maxNarrow = this.max;
		}
		return this.create([minNarrow, maxNarrow === Top ? Top : maxNarrow.difference(minNarrow)]);
	}

	public concretize(limit: number): ReadonlySet<ReadonlySet<T>> |  typeof Top {
		if(this.value === Bottom) {
			return new Set();
		} else if(this.value[1] === Top || 2**(this.value[1].size) > limit) {
			return Top;
		}
		const subsets = [new this.setType()];

		for(const element of this.value[1]) {
			const newSubsets = subsets.map(subset => new this.setType([...subset, element]));

			for(const subset of newSubsets) {
				subsets.push(subset);
			}
		}
		return new Set(subsets.map(subset => this.min === Bottom ? subset : this.min.union(subset)));
	}

	public abstract(concrete: ReadonlySet<ReadonlySet<T>> | typeof Top): this;
	public abstract(concrete: ReadonlySet<ReadonlySet<T>> | typeof Top): SetRangeDomain<T> {
		return SetRangeDomain.abstract(concrete, this.limit);
	}

	public satisfies(set: ReadonlySet<T> | T[], comparator: SetComparator = SetComparator.Equal): Ternary {
		const value = new this.setType(set);

		switch(comparator) {
			case SetComparator.Equal: {
				if(this.isValue() && this.min.isSubsetOf(value) && (this.max === Top || value.isSubsetOf(this.max))) {
					return this.value[1] !== Top && this.value[1].size === 0 ? Ternary.Always : Ternary.Maybe;
				}
				return Ternary.Never;
			}
			case SetComparator.SubsetOrEqual: {
				if(this.isValue() && (this.max === Top || value.isSubsetOf(this.max))) {
					return value.isSubsetOf(this.min) ? Ternary.Always : Ternary.Maybe;
				}
				return Ternary.Never;
			}
			case SetComparator.Subset: {
				if(this.isValue() && (this.max === Top || (value.isSubsetOf(this.max) && !setEquals(value, this.max)))) {
					return value.isSubsetOf(this.min) && !setEquals(value, this.min) ? Ternary.Always : Ternary.Maybe;
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
	public extendDown(): this {
		if(this.min === Bottom || this.max === Bottom) {
			return this.bottom();
		} else {
			return this.create([new this.setType(), this.max]);
		}
	}

	/**
	 * Extends the maximum set of the current abstract value up to {@link Top}.
	 */
	public extendUp(): this {
		if(this.min === Bottom || this.max === Bottom) {
			return this.bottom();
		} else {
			return this.create([this.min, Top]);
		}
	}

	public toJson(): unknown {
		if(this.value === Bottom) {
			return this.value.description;
		}
		const min = this.value[0].values().toArray();
		const range = this.value[1] === Top ? this.value[1].description : this.value[1].values().toArray();

		return [min, range];
	}

	public toString(): string {
		if(this.value === Bottom) {
			return '⊥';
		} else if(this.value[1] === Top) {
			const minString = this.value[0].values().map(domainElementToString).toArray().join(', ');

			return `[{${minString}}, ⊤]`;
		}
		const minString = this.value[0].values().map(domainElementToString).toArray().join(', ');
		const rangeString = this.value[1].values().map(domainElementToString).toArray().join(', ');

		return `[{${minString}}, {${rangeString}}]`;
	}

	public isTop(): this is SetRangeDomain<T, SetRangeTop> {
		return this.value !== Bottom && this.value[0].size === 0 && this.value[1] === Top;
	}

	public isBottom(): this is SetRangeDomain<T, SetRangeBottom> {
		return this.value === Bottom;
	}

	public isValue(): this is SetRangeDomain<T, SetRangeValue<T>> {
		return this.value !== Bottom;
	}
}
