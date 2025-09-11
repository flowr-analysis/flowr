import { setEquals } from '../../util/collections/set';
import { DEFAULT_INFERENCE_LIMIT, domainElementToString, type AbstractDomain } from './abstract-domain';
import { Bottom , Top } from './lattice';

/** The type of the actual values of the set bounded set domain as set */
export type SetBoundedSetValue<T> = ReadonlySet<T>;
/** The type of the Top element of the set bounded set domain as {@link Top} symbol */
export type SetBoundedSetTop = typeof Top;
/** The type of the Bottom element of the set bounded set domain as {@link Bottom} */
export type SetBoundedSetBottom = typeof Bottom;
/** The type of the abstract values of the set bounded set domain that are Top, Bottom, or actual values */
export type SetBoundedSetLift<T> = SetBoundedSetValue<T> | SetBoundedSetTop | SetBoundedSetBottom;

/**
 * The set bounded set abstract domain as sets capturing possible values of the concrete set bounded by a `limit` for the maximum number of inferred values.
 * The Bottom element is defined as the{@link Bottom} and the Top element is defined as {@link Top} symbol.
 * @template T     - Type of the values in the abstract domain
 * @template Value - Type of the constraint in the abstract domain (Top, Bottom, or an actual value)
 */
export class SetBoundedSetDomain<T, Value extends SetBoundedSetLift<T> = SetBoundedSetLift<T>>
implements AbstractDomain<ReadonlySet<T>, SetBoundedSetValue<T>, SetBoundedSetTop, SetBoundedSetBottom, Value> {
	private readonly limit: number;
	private _value:         Value;

	constructor(value: Value, limit: number = DEFAULT_INFERENCE_LIMIT) {
		if(value !== Top && value !== Bottom) {
			this._value = (value.size > limit ? Top : new Set(value)) as Value;
		} else {
			this._value = value;
		}
		this.limit = limit;
	}

	public get value(): Value {
		return this._value;
	}

	public static top<T>(limit?: number): SetBoundedSetDomain<T, SetBoundedSetTop> {
		return new SetBoundedSetDomain(Top, limit);
	}

	public static bottom<T>(limit?: number): SetBoundedSetDomain<T, SetBoundedSetBottom> {
		return new SetBoundedSetDomain(Bottom, limit);
	}

	public static abstract<T>(concrete: ReadonlySet<ReadonlySet<T>> | typeof Top, limit?: number): SetBoundedSetDomain<T> {
		if(concrete === Top) {
			return SetBoundedSetDomain.top(limit);
		} else if(concrete.size === 0) {
			return SetBoundedSetDomain.bottom(limit);
		}
		return new SetBoundedSetDomain(concrete.values().reduce((result, set) => result.union(set)), limit);
	}

	public top(): SetBoundedSetDomain<T, SetBoundedSetTop> {
		return SetBoundedSetDomain.top(this.limit);
	}

	public bottom(): SetBoundedSetDomain<T, SetBoundedSetBottom> {
		return SetBoundedSetDomain.bottom(this.limit);
	}

	public equals(other: SetBoundedSetDomain<T>): boolean {
		return this.value === other.value || (this.isValue() && other.isValue() && setEquals(this.value, other.value));
	}

	public leq(other: SetBoundedSetDomain<T>): boolean {
		return this.value === Bottom || other.value === Top || (this.isValue() && other.isValue() && this.value.isSubsetOf(other.value));
	}

	public join(...values: SetBoundedSetDomain<T>[]): SetBoundedSetDomain<T> {
		const result = new SetBoundedSetDomain<T>(this.value, this.limit);

		for(const other of values) {
			if(result.value === Top || other.value === Top) {
				result._value = Top;
			} else if(result.value === Bottom) {
				result._value = other.value;
			} else if(other.value === Bottom) {
				result._value = result.value;
			} else {
				const join = result.value.union(other.value);
				result._value = join.size > this.limit ? Top : join;
			}
		}
		return result;
	}

	public meet(...values: SetBoundedSetDomain<T>[]): SetBoundedSetDomain<T> {
		const result = new SetBoundedSetDomain<T>(this.value, this.limit);

		for(const other of values) {
			if(result.value === Bottom || other.value === Bottom) {
				result._value = Bottom;
			} else if(result.value === Top) {
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
	public subtract(other: SetBoundedSetDomain<T>): SetBoundedSetDomain<T> {
		if(this.value === Top) {
			return this.top();
		} else if(this.value === Bottom) {
			return this.bottom();
		} else if(other.value === Top || other.value === Bottom) {
			return new SetBoundedSetDomain(this.value, this.limit);
		} else {
			return new SetBoundedSetDomain(this.value.difference(other.value), this.limit);
		}
	}

	public widen(other: SetBoundedSetDomain<T>): SetBoundedSetDomain<T> {
		if(this.value === Bottom) {
			return new SetBoundedSetDomain(other.value, this.limit);
		} else if(other.value === Bottom) {
			return new SetBoundedSetDomain(this.value, this.limit);
		}
		return other.leq(this) ? new SetBoundedSetDomain(this.value, this.limit) : this.top();
	}

	public narrow(other: SetBoundedSetDomain<T>): SetBoundedSetDomain<T> {
		if(this.value === Bottom || other.value === Bottom) {
			return this.bottom();
		}
		return this.isTop() ? other : this;
	}

	public concretize(limit: number = DEFAULT_INFERENCE_LIMIT): ReadonlySet<ReadonlySet<T>> |  typeof Top {
		if(this.value === Bottom) {
			return new Set();
		} else if(this.value === Top || 2**(this.value.size) > limit) {
			return Top;
		}
		const subsets = [new Set<T>()];

		for(const element of this.value.values()) {
			const newSubsets = subsets.map(subset => new Set([...subset, element]));

			for(const subset of newSubsets) {
				subsets.push(subset);
			}
		}
		return new Set(subsets);
	}

	public abstract(concrete: ReadonlySet<ReadonlySet<T>> | typeof Top): SetBoundedSetDomain<T> {
		return SetBoundedSetDomain.abstract(concrete, this.limit);
	}

	public toString(): string {
		if(this.value === Top) {
			return '⊤';
		} else if(this.value === Bottom) {
			return '⊥';
		}
		const string = this.value.values().map(domainElementToString).toArray().join(', ');

		return `{${string}}`;
	}

	public isTop(): this is SetBoundedSetDomain<T, SetBoundedSetTop> {
		return this.value === Top;
	}

	public isBottom(): this is SetBoundedSetDomain<T, SetBoundedSetBottom> {
		return this.value == Bottom;
	}

	public isValue(): this is SetBoundedSetDomain<T, SetBoundedSetValue<T>> {
		return this.value !== Top && this.value !== Bottom;
	}
}
