import { setEquals } from '../../util/collections/set';
import { Ternary } from '../../util/logic';
import type { AbstractDomain, SatifiableDomain } from './abstract-domain';
import { DEFAULT_INFERENCE_LIMIT, domainElementToString } from './abstract-domain';
import { Top } from './lattice';

/** The Bottom element of the bounded set domain as empty set */
export const BoundedSetBottom: ReadonlySet<never> = new Set();

/** The type of the actual values of the bounded set domain as set */
type BoundedSetValue<T> = ReadonlySet<T>;
/** The type of the Top element of the bounded set domain as {@link Top} symbol */
type BoundedSetTop = typeof Top;
/** The type of the Bottom element of the bounded set domain as empty set */
type BoundedSetBottom = typeof BoundedSetBottom;
/** The type of the abstract values of the bounded set domain that are Top, Bottom, or actual values */
type BoundedSetLift<T> = BoundedSetValue<T> | BoundedSetTop | BoundedSetBottom;

/**
 * The bounded set abstract domain as sets of possible values bounded by a `limit` indicating the maximum number of inferred values.
 * The Bottom element is defined as the empty set and the Top element is defined as {@link Top} symbol.
 * @template T     - Type of the values in the abstract domain
 * @template Value - Type of the constraint in the abstract domain (Top, Bottom, or an actual value)
 */
export class BoundedSetDomain<T, Value extends BoundedSetLift<T> = BoundedSetLift<T>>
implements AbstractDomain<BoundedSetDomain<T>, T, BoundedSetValue<T>, BoundedSetTop, BoundedSetBottom, Value>, SatifiableDomain<T> {
	public readonly limit:   number;
	private readonly _value: Value;

	constructor(value: Value | T[], limit: number = DEFAULT_INFERENCE_LIMIT) {
		if(value !== Top) {
			if(Array.isArray(value)) {
				this._value = (value.length > limit ? Top : new Set(value)) as Value;
			} else {
				this._value = (value.size > limit ? Top : new Set(value)) as Value;
			}
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
		return new BoundedSetDomain(BoundedSetBottom, limit);
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

	public join(...values: BoundedSetDomain<T>[]): BoundedSetDomain<T>;
	public join(...values: BoundedSetLift<T>[]): BoundedSetDomain<T>;
	public join(...values: (T[] | typeof Top | never[])[]): BoundedSetDomain<T>;
	public join(...values: BoundedSetDomain<T>[] | (BoundedSetLift<T> | T[])[]): BoundedSetDomain<T> {
		let result: BoundedSetLift<T> = this.value;

		for(const other of values) {
			const otherValue = other instanceof BoundedSetDomain ? other.value : Array.isArray(other) ? new Set(other) : other;

			if(result === Top ||otherValue === Top) {
				result = Top;
				break;
			} else {
				const join = result.union(otherValue);
				result = join.size > this.limit ? Top : join;
			}
		}
		return new BoundedSetDomain(result, this.limit);
	}

	public meet(...values: BoundedSetDomain<T>[]): BoundedSetDomain<T>;
	public meet(...values: BoundedSetLift<T>[]): BoundedSetDomain<T>;
	public meet(...values: (T[] | typeof Top | never[])[]): BoundedSetDomain<T>;
	public meet(...values: BoundedSetDomain<T>[] | (BoundedSetLift<T> | T[])[]): BoundedSetDomain<T> {
		let result: BoundedSetLift<T> = this.value;

		for(const other of values) {
			const otherValue = other instanceof BoundedSetDomain ? other.value : Array.isArray(other) ? new Set(other) : other;

			if(result === Top) {
				result = otherValue;
			} else if(otherValue === Top) {
				continue;
			} else {
				result = result.intersection(otherValue);
			}
		}
		return new BoundedSetDomain<T>(result, this.limit);
	}

	/**
	 * Subtracts another abstract value from the current abstract value by removing all elements of the other abstract value from the current abstract value.
	 */
	public subtract(other: BoundedSetDomain<T> | BoundedSetLift<T> | T[]): BoundedSetDomain<T> {
		const otherValue = other instanceof BoundedSetDomain ? other.value : Array.isArray(other) ? new Set(other) : other;

		if(this.value === Top) {
			return this.top();
		} else if(otherValue === Top) {
			return new BoundedSetDomain(this.value, this.limit);
		} else {
			return new BoundedSetDomain(this.value.difference(otherValue), this.limit);
		}
	}

	public widen(other: BoundedSetDomain<T>): BoundedSetDomain<T> {
		return other.leq(this) ? new BoundedSetDomain(this.value, this.limit) : this.top();
	}

	public narrow(other: BoundedSetDomain<T>): BoundedSetDomain<T> {
		return this.isTop() ? new BoundedSetDomain(other.value, this.limit) : new BoundedSetDomain(this.value, this.limit);
	}

	public concretize(limit: number = this.limit): ReadonlySet<T> |  typeof Top {
		return this.value === Top || this.value.size > limit ? Top : this.value;
	}

	public abstract(concrete: ReadonlySet<T> | typeof Top): BoundedSetDomain<T> {
		return BoundedSetDomain.abstract(concrete, this.limit);
	}

	public satisfies(value: T): Ternary {
		if(this.isValue() && this.value.has(value)) {
			return this.value.size === 1 ? Ternary.Always : Ternary.Maybe;
		} else if(this.isTop()) {
			return Ternary.Maybe;
		}
		return Ternary.Never;
	}

	public satisfiesLeq(value: T): Ternary {
		return this.satisfies(value);
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
