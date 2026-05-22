import { assertUnreachable } from '../../util/assert';
import { setEquals } from '../../util/collections/set';
import { Ternary } from '../../util/logic';
import { AbstractDomain, DEFAULT_INFERENCE_LIMIT } from './abstract-domain';
import { Bottom, BottomSymbol, Top, TopSymbol } from './lattice';
import { SetComparator, type SetDomain } from './value-abstract-domain';
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
	extends AbstractDomain<SetRangeValue<T>, SetRangeTop, SetRangeBottom, Value>
	implements SetDomain<T> {

	public readonly limit:      SetRangeLimit;
	protected readonly setType: typeof Set<T>;

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
			super({ min, range } as Value);
		} else {
			super(value);
		}
		this.limit = limit;
		this.setType = setType;
	}

	public create(value: SetRangeLift<T> | ArrayRangeValue<T>): this {
		return new SetRangeDomain(value, this.limit, this.setType) as this;
	}

	public from(...values: ReadonlySet<T>[] | T[][]): this {
		if(values.length === 0) {
			return this.bottom();
		}
		const sets = values.map(value => new Set(value));
		const min = sets.reduce((result, set) => result.intersection(set));
		const range = sets.reduce((result, set) => result.union(set)).difference(min);

		return this.create({ min, range });
	}

	/**
	 * The minimum set (lower bound) of the set range representing all values that must exist (subset of {@link upper}).
	 */
	public lower(): Value extends SetRangeValue<T> ? ReadonlySet<T> : ReadonlySet<T> | typeof Bottom {
		if(this.isValue()) {
			return this.value.min;
		}
		return Bottom as Value extends SetRangeValue<T> ? ReadonlySet<T> : ReadonlySet<T> | typeof Bottom;
	}

	/**
	 * The maximum set (upper bound) of the set range representing all values that can possibly exist (union of {@link lower} and range).
	 */
	public upper(): Value extends SetRangeFinite<T> ? ReadonlySet<T> : Value extends SetRangeValue<T> ? ReadonlySet<T> | typeof Top : ReadonlySet<T> | typeof Top | typeof Bottom {
		if(this.isFinite()) {
			return this.value.min.union(this.value.range) as ReadonlySet<T> as Value extends SetRangeFinite<T> ? ReadonlySet<T> : ReadonlySet<T> | typeof Top;
		} else if(this.isValue()) {
			return Top as Value extends SetRangeFinite<T> ? ReadonlySet<T> : ReadonlySet<T> | typeof Top;
		}
		return Bottom as Value extends SetRangeFinite<T> ? ReadonlySet<T> : Value extends SetRangeValue<T> ? ReadonlySet<T> | typeof Top : ReadonlySet<T> | typeof Top | typeof Bottom;
	}

	public static top<T>(limit?: SetRangeLimit | number, setType?: typeof Set<T>): SetRangeDomain<T, SetRangeTop> {
		return new this(SetRangeTop, limit, setType);
	}

	public static bottom<T>(limit?: SetRangeLimit | number, setType?: typeof Set<T>): SetRangeDomain<T, SetRangeBottom> {
		return new this(Bottom, limit, setType);
	}

	public static from<T>(values: Set<T> | T[] | Set<T>[] | T[][], limit?: SetRangeLimit | number, setType?: typeof Set<T>): SetRangeDomain<T> {
		values = !Array.isArray(values) ? [values] : values.every(value => value instanceof Set || Array.isArray(value)) ? values : [values];

		if(values.length === 0) {
			return this.bottom();
		}
		const sets = values.map(value => new Set(value));
		const min = sets.reduce((result, set) => result.intersection(set));
		const range = sets.reduce((result, set) => result.union(set)).difference(min);

		return new this({ min, range }, limit, setType);
	}

	public top(): this & SetRangeDomain<T, SetRangeTop> {
		return this.create(SetRangeTop) as this & SetRangeDomain<T, SetRangeTop>;
	}

	public bottom(): this & SetRangeDomain<T, SetRangeBottom> {
		return this.create(Bottom) as this & SetRangeDomain<T, SetRangeBottom>;
	}

	public equals(other: this): boolean {
		if(this.value === other.value) {
			return true;
		} else if(this.value === Bottom || other.value === Bottom || !setEquals(this.value.min, other.value.min)) {
			return false;
		} else if(this.value.range === other.value.range) {
			return true;
		}
		return this.value.range !== Top && other.value.range !== Top && setEquals(this.value.range, other.value.range);
	}

	public leq(other: this): boolean {
		const thisLower = this.lower(), thisUpper = this.upper();
		const otherLower = other.lower(), otherUpper = other.upper();

		if(thisLower === Bottom || thisUpper === Bottom) {
			return true;
		} else if(otherLower === Bottom || otherUpper === Bottom || !otherLower.isSubsetOf(thisLower)) {
			return false;
		} else if(otherUpper === Top) {
			return true;
		}
		return thisUpper !== Top && thisUpper.isSubsetOf(otherUpper);
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
		return this.create({
			min:   joinLower,
			range: joinUpper === Top ? Top : joinUpper.difference(joinLower)
		});
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
		return this.create({
			min:   meetLower,
			range: meetUpper === Top ? Top : meetUpper.difference(meetLower)
		});
	}

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
		return this.create({
			min:   unionLower,
			range: unionUpper === Top ? Top : unionUpper.difference(unionLower)
		});
	}

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
		return this.create({
			min:   subLower,
			range: subUpper === Top ? Top : subUpper.difference(subLower)
		});
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
		return this.create({
			min:   widenLower,
			range: widenUpper === Top ? Top : widenUpper.difference(widenLower)
		});
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
		return this.create({
			min:   narrowLower,
			range: narrowUpper === Top ? Top : narrowUpper.difference(narrowLower)
		});
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
			return Bottom.description;
		}
		const min = this.value.min.values().toArray();
		const range = this.value.range === Top ? Top.description : this.value.range.values().toArray();

		return { min, range };
	}

	public toString(): string {
		if(this.value === Bottom) {
			return BottomSymbol;
		}
		const minString = this.value.min.values().map(AbstractDomain.toString).toArray().join(', ');

		if(this.value.range === Top) {
			return `[{${minString}}, ${TopSymbol}]`;
		}
		const rangeString = this.value.range.values().map(AbstractDomain.toString).toArray().join(', ');

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
