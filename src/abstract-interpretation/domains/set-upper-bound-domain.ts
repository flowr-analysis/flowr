import { assertUnreachable } from '../../util/assert';
import { setEquals } from '../../util/collections/set';
import { Ternary } from '../../util/logic';
import { AbstractDomain, DEFAULT_INFERENCE_LIMIT } from './abstract-domain';
import { Bottom, BottomSymbol, Top, TopSymbol } from './lattice';
import { type SetDomain, SetComparator } from './value-abstract-domain';
/* eslint-disable @typescript-eslint/unified-signatures */

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

	public equals(other: this): boolean {
		return this.value === other.value || (this.isValue() && other.isValue() && setEquals(this.value, other.value));
	}

	public leq(other: this): boolean {
		return this.value === Bottom || other.value === Top || (this.isValue() && other.isValue() && this.value.isSubsetOf(other.value));
	}

	public join(other: SetUpperBoundLift<T> | T[]): this;
	public join(other: this): this;
	public join(other: this | SetUpperBoundLift<T> | T[]): this {
		const otherValue = this.toValue(other);

		if(this.value === Top || otherValue === Top) {
			return this.top();
		} else if(this.value === Bottom) {
			return this.create(otherValue);
		} else if(otherValue === Bottom) {
			return this.create(this.value);
		} else {
			return this.create(this.value.union(otherValue));
		}
	}

	public meet(other: SetUpperBoundLift<T> | T[]): this;
	public meet(other: this): this;
	public meet(other: this | SetUpperBoundLift<T> | T[]): this {
		const otherValue = this.toValue(other);

		if(this.value === Bottom || otherValue === Bottom) {
			return this.bottom();
		} else if(this.value === Top) {
			return this.create(otherValue);
		} else if(otherValue === Top) {
			return this.create(this.value);
		} else {
			return this.create(this.value.intersection(otherValue));
		}
	}

	public union(other: this | SetUpperBoundLift<T> | T[]): this {
		const otherValue = this.toValue(other);

		if(this.value === Bottom || otherValue === Bottom) {
			return this.bottom();
		} else {
			return this.join(otherValue);
		}
	}

	public intersect(other: this | SetUpperBoundLift<T> | T[]): this {
		const otherValue = this.toValue(other);

		if(this.value === Bottom || otherValue === Bottom) {
			return this.bottom();
		} else {
			return this.meet(otherValue);
		}
	}

	public subtract(other: this | SetUpperBoundLift<T> | T[]): this {
		const otherValue = this.toValue(other);

		if(this.value === Top) {
			return this.top();
		} else if(this.value === Bottom) {
			return this.bottom();
		} else if(otherValue === Top || otherValue === Bottom) {
			return this.create(this.value);
		} else {
			return this.create(this.value.difference(otherValue));
		}
	}

	public widen(other: this): this {
		if(this.value === Bottom) {
			return this.create(other.value);
		} else if(other.value === Bottom) {
			return this.create(this.value);
		}
		return other.leq(this) ? this.create(this.value) : this.top();
	}

	public narrow(other: this): this {
		if(this.value === Bottom || other.value === Bottom) {
			return this.bottom();
		}
		return this.isTop() ? this.create(other.value) : this.create(this.value);
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

	public toJson(): unknown {
		if(this.value === Top || this.value === Bottom) {
			return this.value.description;
		}
		return this.value.values().toArray();
	}

	public toString(): string {
		if(this.value === Top) {
			return TopSymbol;
		} else if(this.value === Bottom) {
			return BottomSymbol;
		}
		const string = this.value.values().map(AbstractDomain.toString).toArray().join(', ');

		return `{${string}}`;
	}

	public isTop(): this is SetUpperBoundDomain<T, SetUpperBoundTop> {
		return this.value === Top;
	}

	public isBottom(): this is SetUpperBoundDomain<T, SetUpperBoundBottom> {
		return this.value === Bottom;
	}

	public isValue(): this is SetUpperBoundDomain<T, SetUpperBoundValue<T>> {
		return this.value !== Top && this.value !== Bottom;
	}

	private toValue(value: this | SetUpperBoundLift<T> | T[]): SetUpperBoundLift<T> {
		if(value instanceof SetUpperBoundDomain) {
			return value.value;
		} else if(Array.isArray(value)) {
			return new this.setType(value);
		}
		return value;
	}
}
