import { assertUnreachable } from '../../util/assert';
import { setEquals } from '../../util/collections/set';
import { Ternary } from '../../util/logic';
import { AbstractDomain, DEFAULT_INFERENCE_LIMIT } from './abstract-domain';
import { Bottom, Top, TopSymbol } from './lattice';
import { SetComparator, type SetDomain } from './value-abstract-domain';


/** The Top element of the set range domain with an empty set as must set and {@link Top} as may set */
export const SetRangeTop = { must: new Set<never>(), may: Top } as const satisfies SetRangeValue<unknown>;

/** The type of the actual values of the set range domain as tuple with a set of values that must be present and a set of values that may be present (i.e. `[{"id","name"}, ∅]`, or `[{"id"}, {"score"}]`) */
export type SetRangeValue<T> = { readonly must: ReadonlySet<T>, readonly may: ReadonlySet<T> | typeof Top };
/** The type of the Top element of the set range domain as tuple with the empty set as must set and {@link Top} as may set (i.e. `[∅, Top]`) */
type SetRangeTop = typeof SetRangeTop;
/** The type of the Bottom element of the set range domain as {@link Bottom} */
type SetRangeBottom = typeof Bottom;
/** The type of the abstract values of the set range domain that are Top, Bottom, or actual values */
type SetRangeLift<T> = SetRangeValue<T> | SetRangeTop | SetRangeBottom;
/** The type of the actual values of the set range domain with a finite may set (the may set cannot be Top) */
type SetRangeFinite<T> = { readonly must: ReadonlySet<T>, readonly may: ReadonlySet<T> };

type SetRangeMustSet<T, Value extends SetRangeLift<T>> = Value extends SetRangeValue<T> ? ReadonlySet<T> : ReadonlySet<T> | typeof Bottom;
type SetRangeMaySet<T, Value extends SetRangeLift<T>> = Value extends SetRangeFinite<T> ? ReadonlySet<T> : Value extends SetRangeValue<T> ? ReadonlySet<T> | typeof Top : ReadonlySet<T> | typeof Top | typeof Bottom;

/** The type of the actual values of the set range domain as array tuple with a must array and may array for better readability (e.g. `[["id","name"], []]`, or `[["id"], ["score"]]`) */
export type ArrayRangeValue<T> = { readonly must: T[], readonly may: T[] | typeof Top };

/** The type for the maximum number of elements in the must set and may set of the set range domain before over-approximation */
export type SetRangeLimit = { readonly must: number, readonly may: number };

/**
 * The set range abstract domain as range of possible value sets with a set of values that must be present and a set of values that may be present
 * (similar to an interval-like structure with a lower bound and a difference to the upper bound).
 * The Bottom element is defined as {@link Bottom} symbol and the Top element is defined as the range `[∅, Top]` where the must set is the empty set and the may set is {@link Top}.
 * @template T     - Type of the values in the sets in the abstract domain
 * @template Value - Type of the constraint in the abstract domain (Top, Bottom, or an actual value)
 */
export class SetRangeDomain<T, Value extends SetRangeLift<T> = SetRangeLift<T>>
	extends AbstractDomain<SetRangeValue<T>, SetRangeTop, SetRangeBottom, Value>
	implements SetDomain<T> {

	public readonly limit:      SetRangeLimit;
	protected readonly setType: typeof Set<T>;

	/**
	 * @param limit -  A limit for the maximum number of elements to store in the must set and may set before over-approximation
	 * @param newSet - An optional set constructor for the domain elements if the type `T` is not storable in a HashSet
	 */
	constructor(value: Value | ArrayRangeValue<T>, limit: SetRangeLimit | number = DEFAULT_INFERENCE_LIMIT, setType: typeof Set<T> = Set) {
		limit = typeof limit === 'number' ? { must: limit, may: limit } : limit;

		if(value !== Bottom) {
			const mustSet = new setType(value.must);
			const maySet = value.may === Top ? Top : new setType(value.may);
			const mustExceeds = mustSet.size > limit.must;
			const mayExceeds = maySet === Top || maySet.size > limit.may || mustSet.size + maySet.size > limit.must + limit.may;

			const must = mustExceeds ? new setType(mustSet.values().take(limit.must)) : mustSet;
			const may = mayExceeds ? Top : mustSet.union(maySet).difference(must);
			super({ must, may } as Value);
		} else {
			super(value);
		}
		this.limit = limit;
		this.setType = setType;
	}

	public create(value: SetRangeLift<T> | ArrayRangeValue<T>): this {
		return new SetRangeDomain(value, this.limit, this.setType) as this;
	}

	/**
	 * The set of values that must be present in the set.
	 */
	public get must(): SetRangeMustSet<T, Value> {
		return (this.isValue() ? this.value.must : Bottom) as SetRangeMustSet<T, Value>;
	}

	/**
	 * The set of values that may be present in the set (can be {@link Top}).
	 */
	public get may(): SetRangeMaySet<T, Value> {
		return (this.isValue() ? this.value.may : Bottom) as SetRangeMaySet<T, Value>;
	}

	/**
	 * The lower bound of the set range representing all values that must be present (equals the must set).
	 */
	public lower(this: SetRangeDomain<T, SetRangeValue<T>>): ReadonlySet<T>;
	public lower(this: SetRangeDomain<T, SetRangeLift<T>>): ReadonlySet<T> | typeof Bottom;
	public lower(): ReadonlySet<T> | typeof Bottom {
		return this.must;
	}

	/**
	 * The upper bound of the set range representing all values that can possibly be present (union of must set and may set).
	 */
	public upper(this: SetRangeDomain<T, SetRangeFinite<T>>): ReadonlySet<T>;
	public upper(this: SetRangeDomain<T, SetRangeValue<T>>): ReadonlySet<T> | typeof Top;
	public upper(this: SetRangeDomain<T, SetRangeLift<T>>): ReadonlySet<T> | typeof Top | typeof Bottom;
	public upper(): ReadonlySet<T> | typeof Top | typeof Bottom {
		return this.isFinite() ? this.must.union(this.may) : this.may;
	}

	public from(...values: ReadonlySet<T>[] | T[][]): this {
		if(values.length === 0) {
			return this.bottom();
		}
		const sets = values.map(value => new Set(value));
		const must = sets.reduce((result, set) => result.intersection(set));
		const may = sets.reduce((result, set) => result.union(set)).difference(must);

		return this.create({ must, may });
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
		const must = sets.reduce((result, set) => result.intersection(set));
		const may = sets.reduce((result, set) => result.union(set)).difference(must);

		return new this({ must, may }, limit, setType);
	}

	public top(): this & SetRangeDomain<T, SetRangeTop> {
		return this.create(SetRangeTop) as this & SetRangeDomain<T, SetRangeTop>;
	}

	public bottom(): this & SetRangeDomain<T, SetRangeBottom> {
		return this.create(Bottom) as this & SetRangeDomain<T, SetRangeBottom>;
	}

	protected equalsValue(this: SetRangeDomain<T, SetRangeValue<T>>, other: SetRangeDomain<T, SetRangeValue<T>>): boolean {
		return setEquals(this.must, other.must) && (this.may === other.may || (this.may !== Top && other.may !== Top && setEquals(this.may, other.may)));
	}

	protected leqValue(this: SetRangeDomain<T, SetRangeValue<T>>, other: SetRangeDomain<T, SetRangeValue<T>>): boolean {
		const thisLower = this.lower(), thisUpper = this.upper();
		const otherLower = other.lower(), otherUpper = other.upper();

		return otherLower.isSubsetOf(thisLower) && (otherUpper === Top || (thisUpper !== Top && thisUpper.isSubsetOf(otherUpper)));
	}

	protected joinValue(this: this & SetRangeDomain<T, SetRangeValue<T>>, other: SetRangeDomain<T, SetRangeValue<T>>): this {
		const thisLower = this.lower(), thisUpper = this.upper();
		const otherLower = other.lower(), otherUpper = other.upper();

		const joinLower = thisLower.intersection(otherLower);
		let joinUpper;

		if(thisUpper === Top || otherUpper === Top) {
			joinUpper = Top;
		} else {
			joinUpper = thisUpper.union(otherUpper);
		}
		return this.create({
			must: joinLower,
			may:  joinUpper === Top ? Top : joinUpper.difference(joinLower)
		});
	}

	protected meetValue(this: this & SetRangeDomain<T, SetRangeValue<T>>, other: SetRangeDomain<T, SetRangeValue<T>>): this {
		const thisLower = this.lower(), thisUpper = this.upper();
		const otherLower = other.lower(), otherUpper = other.upper();

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
			must: meetLower,
			may:  meetUpper === Top ? Top : meetUpper.difference(meetLower)
		});
	}

	public union(other: this | SetRangeLift<T> | ArrayRangeValue<T>): this {
		other = other instanceof SetRangeDomain ? other : this.create(other);

		if(!this.isValue() || !other.isValue()) {
			return this.bottom();
		}
		const thisLower = this.lower(), thisUpper = this.upper();
		const otherLower = other.lower(), otherUpper = other.upper();

		const unionLower = thisLower.union(otherLower);
		let unionUpper;

		if(thisUpper === Top || otherUpper === Top) {
			unionUpper = Top;
		} else {
			unionUpper = thisUpper.union(otherUpper);
		}
		return this.create({
			must: unionLower,
			may:  unionUpper === Top ? Top : unionUpper.difference(unionLower)
		});
	}

	public intersect(other: this | SetRangeLift<T> | ArrayRangeValue<T>): this {
		other = other instanceof SetRangeDomain ? other : this.create(other);

		if(!this.isValue() || !other.isValue()) {
			return this.bottom();
		}
		const thisLower = this.lower(), thisUpper = this.upper();
		const otherLower = other.lower(), otherUpper = other.upper();

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
			must: intersectLower,
			may:  intersectUpper === Top ? Top : intersectUpper.difference(intersectLower)
		});
	}

	public subtract(other: this | SetRangeLift<T> | ArrayRangeValue<T>): this {
		other = other instanceof SetRangeDomain ? other : this.create(other);

		if(!this.isValue() || !other.isValue()) {
			return this.bottom();
		}
		const thisLower = this.lower(), thisUpper = this.upper();
		const otherLower = other.lower(), otherUpper = other.upper();

		let subtractLower;

		if(otherUpper === Top) {
			subtractLower = new Set<never>();
		} else {
			subtractLower = thisLower.difference(otherUpper);
		}
		let subtractUpper;

		if(thisUpper === Top) {
			subtractUpper = Top;
		} else if(otherUpper === Top) {
			subtractUpper = thisUpper.difference(otherLower);
		} else {
			subtractUpper = thisUpper.difference(otherUpper);
		}
		return this.create({
			must: subtractLower,
			may:  subtractUpper === Top ? Top : subtractUpper.difference(subtractLower)
		});
	}

	protected widenValue(this: this & SetRangeDomain<T, SetRangeValue<T>>, other: SetRangeDomain<T, SetRangeValue<T>>): this {
		const thisLower = this.lower(), thisUpper = this.upper();
		const otherLower = other.lower(), otherUpper = other.upper();

		let widenLower;

		if(thisLower.isSubsetOf(otherLower)) {
			widenLower = thisLower;
		} else {
			widenLower = new Set<never>();
		}
		let widenUpper;

		if(thisUpper !== Top && otherUpper !== Top && otherUpper.isSubsetOf(thisUpper)) {
			widenUpper = thisUpper;
		} else {
			widenUpper = Top;
		}
		return this.create({
			must: widenLower,
			may:  widenUpper === Top ? Top : widenUpper.difference(widenLower)
		});
	}

	protected narrowValue(this: this & SetRangeDomain<T, SetRangeValue<T>>, other: SetRangeDomain<T, SetRangeValue<T>>): this {
		const thisLower = this.lower(), thisUpper = this.upper();
		const otherLower = other.lower(), otherUpper = other.upper();

		if(this.meetValue(other).isBottom()) {
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
			must: narrowLower,
			may:  narrowUpper === Top ? Top : narrowUpper.difference(narrowLower)
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
	 * Extends the must set of the current abstract value down to the empty set.
	 */
	public widenDown(): this {
		if(this.isValue()) {
			return this.create({ must: new this.setType(), may: this.upper() });
		}
		return this.bottom();
	}

	/**
	 * Extends the may set of the current abstract value up to {@link Top}.
	 */
	public widenUp(): this {
		if(this.isValue()) {
			return this.create({ must: this.must, may: Top });
		}
		return this.bottom();
	}

	protected jsonify(this: SetRangeDomain<T, SetRangeValue<T>>): unknown {
		const must = this.must.values().toArray();
		const may = this.may === Top ? Top.description : this.may.values().toArray();

		return { must, may };
	}

	protected stringify(this: SetRangeDomain<T, SetRangeValue<T>>): string {
		const must = this.must.values().map(AbstractDomain.toString).toArray().join(', ');

		if(this.may === Top) {
			return `[{${must}}, ${TopSymbol}]`;
		}
		const may = this.may.values().map(AbstractDomain.toString).toArray().join(', ');

		return `[{${must}}, {${may}}]`;
	}

	public isTop(): this is this & SetRangeDomain<T, SetRangeTop> {
		return this.isValue() && this.must.size === 0 && this.may === Top;
	}

	public isBottom(): this is this & SetRangeDomain<T, SetRangeBottom> {
		return this.value === Bottom;
	}

	public isValue(): this is this & SetRangeDomain<T, SetRangeValue<T>> {
		return this.value !== Bottom;
	}

	public isFinite(): this is this & SetRangeDomain<T, SetRangeFinite<T>> {
		return this.isValue() && this.may !== Top;
	}
}
