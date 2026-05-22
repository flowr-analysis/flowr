import { assertUnreachable } from '../../util/assert';
import { setEquals } from '../../util/collections/set';
import { Ternary } from '../../util/logic';
import { AbstractDomain, DEFAULT_INFERENCE_LIMIT } from './abstract-domain';
import { Bottom, Top } from './lattice';
import { type SetDomain, SetComparator } from './value-abstract-domain';

/** The type of the actual values of the set upper bound domain as set */
type SetUpperBoundValue<T> = ReadonlySet<T>;
/** The type of the Top element of the set upper bound domain as {@link Top} symbol */
type SetUpperBoundTop = typeof Top;
/** The type of the Bottom element of the set upper bound domain as {@link Bottom} symbol */
type SetUpperBoundBottom = typeof Bottom;
/** The type of the abstract values of the set upper bound domain that are Top, Bottom, or actual values */
type SetUpperBoundLift<T> = SetUpperBoundValue<T> | SetUpperBoundTop | SetUpperBoundBottom;

/**
 * The set upper bound abstract domain as sets capturing possible values of the concrete set bounded by a `limit` for the maximum number of inferred values.
 * The Bottom element is defined as the{@link Bottom} and the Top element is defined as {@link Top} symbol.
 * @template T     - Type of the values in the abstract domain
 * @template Value - Type of the constraint in the abstract domain (Top, Bottom, or an actual value)
 */
export class SetUpperBoundDomain<T, Value extends SetUpperBoundLift<T> = SetUpperBoundLift<T>>
	extends AbstractDomain<SetUpperBoundValue<T>, SetUpperBoundTop, SetUpperBoundBottom, Value>
	implements SetDomain<T> {

	public readonly limit:      number;
	protected readonly setType: typeof Set<T>;

	/**
	 * @param limit -  A limit for the maximum number of elements to store in the set
	 * @param newSet - An optional set constructor for the domain elements if the type `T` is not storable in a HashSet
	 */
	constructor(value: Value | T[], limit: number = DEFAULT_INFERENCE_LIMIT, setType: typeof Set<T> = Set) {
		if(value !== Top && value !== Bottom) {
			if(Array.isArray(value)) {
				super((value.length > limit ? Top : new setType(value)) as Value);
			} else {
				super((value.size > limit ? Top : new setType(value)) as Value);
			}
		} else {
			super(value);
		}
		this.limit = limit;
		this.setType = setType;
	}

	public create(value: SetUpperBoundLift<T> | T[]): this {
		return new SetUpperBoundDomain(value, this.limit, this.setType) as this;
	}

	public from(...values: ReadonlySet<T>[] | T[][]): this {
		if(values.length === 0) {
			return this.bottom();
		}
		const sets = values.map(value => new Set(value));

		return this.create(sets.reduce((result, set) => result.union(set)));
	}

	public static top<T>(limit?: number, setType?: typeof Set<T>): SetUpperBoundDomain<T, SetUpperBoundTop> {
		return new this(Top, limit, setType);
	}

	public static bottom<T>(limit?: number, setType?: typeof Set<T>): SetUpperBoundDomain<T, SetUpperBoundBottom> {
		return new this(Bottom, limit, setType);
	}

	public static from<T>(values: Set<T> | T[] | Set<T>[] | T[][], limit?: number, setType?: typeof Set<T>): SetUpperBoundDomain<T> {
		values = !Array.isArray(values) ? [values] : values.every(value => value instanceof Set || Array.isArray(value)) ? values : [values];

		if(values.length === 0) {
			return this.bottom();
		}
		const sets = values.map(value => new Set(value));

		return new this(sets.reduce((result, set) => result.union(set)), limit, setType);
	}

	public top(): this & SetUpperBoundDomain<T, SetUpperBoundTop> {
		return this.create(Top) as this & SetUpperBoundDomain<T, SetUpperBoundTop>;
	}

	public bottom(): this & SetUpperBoundDomain<T, SetUpperBoundBottom> {
		return this.create(Bottom) as this & SetUpperBoundDomain<T, SetUpperBoundBottom>;
	}

	protected equalsValue(this: SetUpperBoundDomain<T, SetUpperBoundValue<T>>, other: SetUpperBoundDomain<T, SetUpperBoundValue<T>>): boolean {
		return setEquals(this.value, other.value);
	}

	protected leqValue(this: SetUpperBoundDomain<T, SetUpperBoundValue<T>>, other: SetUpperBoundDomain<T, SetUpperBoundValue<T>>): boolean {
		return this.value.isSubsetOf(other.value);
	}

	protected joinValue(this: this & SetUpperBoundDomain<T, SetUpperBoundValue<T>>, other: SetUpperBoundDomain<T, SetUpperBoundValue<T>>): this {
		return this.create(this.value.union(other.value));
	}

	protected meetValue(this: this & SetUpperBoundDomain<T, SetUpperBoundValue<T>>, other: SetUpperBoundDomain<T, SetUpperBoundValue<T>>): this {
		return this.create(this.value.intersection(other.value));
	}

	public union(other: this | SetUpperBoundLift<T> | T[]): this {
		other = other instanceof AbstractDomain ? other : this.create(other);

		if(this.isBottom() || other.isBottom()) {
			return this.bottom();
		}
		return this.join(other);
	}

	public intersect(other: this | SetUpperBoundLift<T> | T[]): this {
		other = other instanceof AbstractDomain ? other : this.create(other);

		if(this.isBottom() || other.isBottom()) {
			return this.bottom();
		}
		return this.meet(other);
	}

	public subtract(other: this | SetUpperBoundLift<T>): this {
		other = other instanceof AbstractDomain ? other : this.create(other);

		if(this.isBottom() || other.isBottom()) {
			return this.bottom();
		} else if(this.isValue() && other.isValue()) {
			return this.create(this.value.difference(other.value));
		} else if(this.isValue()) {
			return this.create(this.value);
		}
		return this.top();
	}

	public satisfies(set: ReadonlySet<T> | T[], comparator: SetComparator = SetComparator.Equal): Ternary {
		switch(comparator) {
			case SetComparator.Equal:
			case SetComparator.SubsetOrEqual: {
				if(this.isTop() || (this.isValue() && [...set].length <= this.value.size && [...set].every(value => this.value.has(value)))) {
					return Ternary.Maybe;
				}
				return Ternary.Never;
			}
			case SetComparator.Subset: {
				if(this.isTop() || (this.isValue() && [...set].length < this.value.size && [...set].every(value => this.value.has(value)))) {
					return Ternary.Maybe;
				}
				return Ternary.Never;
			}
			default: {
				assertUnreachable(comparator);
			}
		}
	}

	protected jsonify(this: SetUpperBoundDomain<T, SetUpperBoundValue<T>>): unknown {
		return this.value.values().toArray();
	}

	protected stringify(this: SetUpperBoundDomain<T, SetUpperBoundValue<T>>): string {
		return `{${this.value.values().map(AbstractDomain.toString).toArray().join(', ')}}`;
	}

	public isTop(): this is this & SetUpperBoundDomain<T, SetUpperBoundTop> {
		return this.value === Top;
	}

	public isBottom(): this is this & SetUpperBoundDomain<T, SetUpperBoundBottom> {
		return this.value === Bottom;
	}

	public isValue(): this is this & SetUpperBoundDomain<T, SetUpperBoundValue<T>> {
		return this.value !== Top && this.value !== Bottom;
	}
}
