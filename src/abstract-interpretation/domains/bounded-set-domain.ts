import { setEquals } from '../../util/collections/set';
import { DEFAULT_INFERENCE_LIMIT, domainElementToString, type AbstractDomain } from './abstract-domain';
import { Top } from './lattice';

/** The type of the actual values of the bounded set domain as set */
export type BoundedSetValue<T> = ReadonlySet<T>;
/** The type of the Top element of the bounded set domain as {@link Top} symbol */
export type BoundedSetTop = typeof Top;
/** The type of the Bottom element of the bounded set domain as empty set */
export type BoundedSetBottom = ReadonlySet<never>;
/** The type of the abstract values of the bounded set domain that are Top, Bottom, or actual values */
export type BoundedSetLift<T> = BoundedSetValue<T> | BoundedSetTop | BoundedSetBottom;

/**
 * The bounded set abstract domain as sets of possible values bounded by a `limit` indicating the maximum number of inferred values.
 * The Bottom element is defined as the empty set and the Top element is defined as {@link Top} symbol.
 * @template T     - Type of the values in the abstract domain
 * @template Value - Type of the constraint in the abstract domain (Top, Bottom, or an actual value)
 */
export class BoundedSetDomain<T, Value extends BoundedSetLift<T> = BoundedSetLift<T>>
implements AbstractDomain<T, BoundedSetValue<T>, BoundedSetTop, BoundedSetBottom, Value> {
	private readonly limit: number;
	private _value:         Value;

	constructor(value: Value, limit: number = DEFAULT_INFERENCE_LIMIT) {
		if(value !== Top) {
			this._value = (value.size > limit ? Top : new Set(value)) as Value;
		} else {
			this._value = value;
		}
		this.limit = limit;
	}

	public get value(): Value {
		return this._value;
	}

	public static top<T>(limit?: number): BoundedSetDomain<T, BoundedSetTop> {
		return new BoundedSetDomain(Top, limit);
	}

	public static bottom<T>(limit?: number): BoundedSetDomain<T, BoundedSetBottom> {
		return new BoundedSetDomain(new Set(), limit);
	}

	public static abstract<T>(concrete: ReadonlySet<T> | typeof Top, limit?: number): BoundedSetDomain<T> {
		return new BoundedSetDomain(concrete, limit);
	}

	public top(): BoundedSetDomain<T, BoundedSetTop> {
		return BoundedSetDomain.top(this.limit);
	}

	public bottom(): BoundedSetDomain<T, BoundedSetBottom> {
		return BoundedSetDomain.bottom(this.limit);
	}

	public equals(other: BoundedSetDomain<T>): boolean {
		return this.value === other.value || (this.isValue() && other.isValue() && setEquals(this.value, other.value));
	}

	public leq(other: BoundedSetDomain<T>): boolean {
		return other.value === Top || (this.isValue() && this.value.isSubsetOf(other.value));
	}

	public join(...values: BoundedSetDomain<T>[]): BoundedSetDomain<T> {
		const result = new BoundedSetDomain<T>(this.value, this.limit);

		for(const other of values) {
			if(result.value === Top || other.value === Top) {
				result._value = Top;
			} else {
				const join = result.value.union(other.value);
				result._value = join.size > this.limit ? Top : join;
			}
		}
		return result;
	}

	public meet(...values: BoundedSetDomain<T>[]): BoundedSetDomain<T> {
		const result = new BoundedSetDomain<T>(this.value, this.limit);

		for(const other of values) {
			if(result.value === Top) {
				result._value = other.value;
			} else if(other.value === Top) {
				result._value = result.value;
			} else {
				result._value = result.value.intersection(other.value);
			}
		}
		return result;
	}

	/**
	 * Subtracts another abstract value from the current abstract value by removing all elements of the other abstract value from the current abstract value.
	 */
	public subtract(other: BoundedSetDomain<T>): BoundedSetDomain<T> {
		if(this.value === Top) {
			return this.top();
		} else if(other.value === Top) {
			return new BoundedSetDomain(this.value, this.limit);
		} else {
			return new BoundedSetDomain(this.value.difference(other.value), this.limit);
		}
	}

	public widen(other: BoundedSetDomain<T>): BoundedSetDomain<T> {
		return other.leq(this) ? new BoundedSetDomain(this.value, this.limit) : this.top();
	}

	public narrow(other: BoundedSetDomain<T>): BoundedSetDomain<T> {
		return this.isTop() ? other : this;
	}

	public concretize(limit: number = this.limit): ReadonlySet<T> |  typeof Top {
		return this.value === Top || this.value.size > limit ? Top : this.value;
	}

	public abstract(concrete: ReadonlySet<T> | typeof Top): BoundedSetDomain<T> {
		return BoundedSetDomain.abstract(concrete, this.limit);
	}

	public toString(): string {
		if(this.value === Top) {
			return '⊤';
		}
		const string = this.value.values().map(domainElementToString).toArray().join(', ');

		return `{${string}}`;
	}

	public isTop(): this is BoundedSetDomain<T, BoundedSetTop> {
		return this.value === Top;
	}

	public isBottom(): this is BoundedSetDomain<T, BoundedSetBottom> {
		return this.value !== Top && this.value.size === 0;
	}

	public isValue(): this is BoundedSetDomain<T, BoundedSetValue<T>> {
		return this.value !== Top;
	}
}
