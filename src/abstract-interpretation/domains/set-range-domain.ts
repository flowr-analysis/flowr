import { assertUnreachable } from '../../util/assert';
import { setEquals } from '../../util/collections/set';
import { Ternary } from '../../util/logic';
import { AbstractDomain, DEFAULT_INFERENCE_LIMIT, domainElementToString } from './abstract-domain';
import { Bottom, Top } from './lattice';
import type { SatisfiableDomain } from './satisfiable-domain';
import { SetComparator } from './satisfiable-domain';

/** The Top element of the set range domain with an empty set as minimum set and {@link Top} as range set */
export const SetRangeTop = { min: new Set<never>(), range: Top } as const satisfies SetRangeValue<unknown>;

/** The type of the actual values of the set range domain as record with a minimum set and range set of additional possible values */
type SetRangeValue<T> = { readonly min: ReadonlySet<T>, readonly range: ReadonlySet<T> | typeof Top };
/** The type of the Top element of the set range domain as record with the empty set as minimum set and {@link Top} as range set */
type SetRangeTop = typeof SetRangeTop;
/** The type of the Bottom element of the set range domain as {@link Bottom} */
type SetRangeBottom = typeof Bottom;
/** The type of the abstract values of the set range domain that are Top, Bottom, or actual values */
type SetRangeLift<T> = SetRangeValue<T> | SetRangeTop | SetRangeBottom;

type SetRangeLimit = { readonly min: number, readonly range: number };

const DefaultLimit = { min: DEFAULT_INFERENCE_LIMIT, range: DEFAULT_INFERENCE_LIMIT } as const satisfies SetRangeLimit;

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
	constructor(value: Value, limit: SetRangeLimit = DefaultLimit, setType: typeof Set<T> = Set) {
		if(value !== Bottom) {
			const min = value.min.size > limit.min ? new setType([...value.min].slice(0, limit.min)) : new setType(value.min);
			const range = (value.range === Top || value.range.size > limit.range || value.min.size + value.range.size > limit.min + limit.range) ? Top : new setType([...value.min, ...value.range]).difference(min);
			super({ min, range } as SetRangeValue<T> as Value);
		} else {
			super(value);
		}
		this.limit = limit;
		this.setType = setType;
	}

	public create(value: SetRangeLift<T>): this;
	public create(value: SetRangeLift<T>): SetRangeDomain<T> {
		return new SetRangeDomain(value, this.limit, this.setType);
	}

	/**
	 * The minimum set of the set range representing all values that must exist (subset of {@link max}).
	 */
	public get min(): Value extends SetRangeBottom ? ReadonlySet<T> | typeof Bottom : ReadonlySet<T> {
		if(this.value === Bottom) {
			return Bottom as Value extends SetRangeBottom ? ReadonlySet<T> | typeof Bottom : ReadonlySet<T>;
		}
		return this.value.min;
	}

	/**
	 * The maximum set of the set range representing all values that can possibly exist (union of {@link min} and range).
	 */
	public get max(): Value extends SetRangeBottom ? ReadonlySet<T> | typeof Bottom | typeof Top : ReadonlySet<T> | typeof Top {
		if(this.value === Bottom) {
			return Bottom as Value extends SetRangeBottom ? ReadonlySet<T> | typeof Bottom : ReadonlySet<T>;
		}
		return this.value.range === Top ? Top : this.value.min.union(this.value.range);
	}

	public static top<T>(limit?: SetRangeLimit, setType?: typeof Set<T>): SetRangeDomain<T, SetRangeTop> {
		return new SetRangeDomain({ min: new Set(), range: Top }, limit, setType);
	}

	public static bottom<T>(limit?: SetRangeLimit, setType?: typeof Set<T>): SetRangeDomain<T, SetRangeBottom> {
		return new SetRangeDomain(Bottom, limit, setType);
	}

	public static abstract<T>(concrete: ReadonlySet<ReadonlySet<T>> | typeof Top, limit?: SetRangeLimit, setType?: typeof Set<T>): SetRangeDomain<T> {
		if(concrete === Top) {
			return SetRangeDomain.top(limit, setType);
		} else if(concrete.size === 0) {
			return SetRangeDomain.bottom(limit, setType);
		}
		const min = concrete.values().reduce((result, set) => result.intersection(set));
		const max = concrete.values().reduce((result, set) => result.union(set));

		return new SetRangeDomain({ min: min, range: max.difference(min) }, limit);
	}

	public top(): this & SetRangeDomain<T, SetRangeTop>;
	public top(): SetRangeDomain<T, SetRangeTop> {
		return SetRangeDomain.top(this.limit, this.setType);
	}

	public bottom(): this & SetRangeDomain<T, SetRangeBottom>;
	public bottom(): SetRangeDomain<T, SetRangeBottom> {
		return SetRangeDomain.bottom(this.limit, this.setType);
	}

	public equals(other: SetRangeDomain<T>): boolean {
		if(this.value === other.value) {
			return true;
		} else if(this.value === Bottom || other.value === Bottom || !setEquals(this.value.min, other.value.min)) {
			return false;
		} else if(this.value.range === other.value.range) {
			return true;
		}
		return this.value.range !== Top && other.value.range !== Top && setEquals(this.value.range, other.value.range);
	}

	public leq(other: SetRangeDomain<T>): boolean {
		if(this.min === Bottom || this.value === Bottom) {
			return true;
		} else if(other.min === Bottom || other.value === Bottom || !other.min.isSubsetOf(this.min)) {
			return false;
		} else if(other.value.range === Top) {
			return true;
		}
		return this.value.range !== Top && this.value.range.isSubsetOf(other.value.range);
	}

	public join(other: this | SetRangeDomain<T>): this {
		if(this.min === Bottom || this.max === Bottom) {
			return this.create(other.value);
		} else if(other.min === Bottom || other.max === Bottom) {
			return this.create(this.value);
		}
		const minJoin = this.min.intersection(other.min);
		let rangeJoin;

		if(this.max === Top || other.max === Top) {
			rangeJoin = Top;
		} else {
			rangeJoin = this.max.union(other.max).difference(minJoin);
		}
		return this.create({ min: minJoin, range: rangeJoin });
	}

	public meet(other: this | SetRangeDomain<T>): this {
		if(this.min === Bottom || this.max === Bottom || other.min === Bottom || other.max === Bottom) {
			return this.bottom();
		}
		const minMeet = this.min.union(other.min);
		let rangeMeet;

		if(this.max === Top && other.max !== Top) {
			rangeMeet = other.max.difference(minMeet);
		} else if(this.max !== Top && other.max === Top) {
			rangeMeet = this.max.difference(minMeet);
		} else if(this.max !== Top && other.max !== Top) {
			if(!minMeet.isSubsetOf(this.max.intersection(other.max))) {
				return this.bottom();
			} else {
				rangeMeet = this.max.intersection(other.max).difference(minMeet);
			}
		} else {
			rangeMeet = Top;
		}
		return this.create({ min: minMeet, range: rangeMeet });
	}

	/**
	 * Subtracts another abstract value from the current abstract value by removing all elements of the other abstract value from the current abstract value.
	 */
	public subtract(other: this): this {
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
		let rangeSub;

		if(this.max === Top) {
			rangeSub = Top;
		} else if(other.max === Top) {
			rangeSub = this.max.difference(other.min).difference(minSub);
		} else {
			rangeSub = this.max.difference(other.max).difference(minSub);
		}
		return this.create({ min: minSub, range: rangeSub });
	}

	public widen(other: this): this {
		if(this.min === Bottom || this.max === Bottom) {
			return this.create(other.value);
		} else if(other.min === Bottom || other.max === Bottom) {
			return this.create(this.value);
		}
		let minWiden;

		if(this.min.isSubsetOf(other.min)) {
			minWiden = this.min;
		} else {
			minWiden = new Set<never>();
		}
		let rangeWiden;

		if(this.max !== Top && other.max !== Top && other.max.isSubsetOf(this.max)) {
			rangeWiden = this.max.difference(minWiden);
		} else {
			rangeWiden = Top;
		}
		return this.create({ min: minWiden, range: rangeWiden });
	}

	public narrow(other: this): this {
		if(this.min === Bottom || this.max === Bottom || other.min === Bottom || other.max === Bottom) {
			return this.bottom();
		}
		let minNarrow;

		if(this.min.size === 0) {
			minNarrow = other.min;
		} else {
			minNarrow = this.min;
		}
		let rangeNarrow;

		if(this.max === Top && other.max !== Top) {
			rangeNarrow = other.max.difference(minNarrow);
		} else if(this.max !== Top) {
			rangeNarrow = this.max.difference(minNarrow);
		} else {
			rangeNarrow = Top;
		}
		return this.create({ min: minNarrow, range: rangeNarrow });
	}

	public concretize(limit: number): ReadonlySet<ReadonlySet<T>> |  typeof Top {
		if(this.value === Bottom) {
			return new Set();
		} else if(this.value.range === Top || 2**(this.value.range.size) > limit) {
			return Top;
		}
		const subsets = [new this.setType()];

		for(const element of this.value.range) {
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
					return this.value.range !== Top && this.value.range.size === 0 ? Ternary.Always : Ternary.Maybe;
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
			return '⊥';
		} else if(this.value.range === Top) {
			const minString = this.value.min.values().map(domainElementToString).toArray().join(', ');

			return `[{${minString}}, ⊤]`;
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
}
