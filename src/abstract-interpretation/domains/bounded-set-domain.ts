import { setEquals } from '../../util/collections/set';
import type { AbstractDomain } from './abstract-domain';
import { Top } from './abstract-domain';

type BoundedSetValue<T> = ReadonlySet<T>;
type BoundedSetTop = typeof Top;
type BoundedSetBottom = ReadonlySet<never>;
type BoundedSetLift<T> = BoundedSetValue<T> | BoundedSetTop | BoundedSetBottom;

export class BoundedSetDomain<T, Value extends BoundedSetLift<T> = BoundedSetLift<T>>
implements AbstractDomain<BoundedSetValue<T>, BoundedSetTop, BoundedSetBottom, Value> {
	private readonly limit: number;
	private _value:         Value;

	constructor(value: Value | T[], limit: number = 50) {
		this._value = (Array.isArray(value) || value instanceof Set ? new Set(value) : value) as Value;
		this.limit = limit;
	}

	public get value(): Value {
		return this._value;
	}

	public static top<T>(limit?: number): BoundedSetDomain<T, BoundedSetTop> {
		return new BoundedSetDomain(Top, limit);
	}

	public static bottom<T>(limit?: number): BoundedSetDomain<T, BoundedSetBottom> {
		return new BoundedSetDomain(new Set<never>(), limit);
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
		return this.leq(other) ? new BoundedSetDomain(other.value, this.limit) : this.top();
	}

	public toString(): string {
		if(this.value === Top) {
			return '⊤';
		}
		return `{${this.value.values().toArray().join(', ')}}`;
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
