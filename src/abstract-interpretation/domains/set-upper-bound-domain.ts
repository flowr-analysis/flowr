import { setEquals } from '../../util/collections/set';
import { Ternary } from '../../util/logic';
import type { AbstractDomain, SatisfiableDomain } from './abstract-domain';
import { DEFAULT_INFERENCE_LIMIT, domainElementToString } from './abstract-domain';
import { Bottom, Top } from './lattice';

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
implements AbstractDomain<SetUpperBoundDomain<T>, ReadonlySet<T>, SetUpperBoundValue<T>, SetUpperBoundTop, SetUpperBoundBottom, Value>, SatisfiableDomain<ReadonlySet<T>> {
	public readonly limit:   number;
	private readonly _value: Value;

	constructor(value: Value | T[], limit: number = DEFAULT_INFERENCE_LIMIT) {
		if(value !== Top && value !== Bottom) {
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

	public create(value: SetUpperBoundLift<T> | T[]): SetUpperBoundDomain<T> {
		return new SetUpperBoundDomain(value, this.limit);
	}

	public get value(): Value {
		return this._value;
	}

	public static top<T>(limit?: number): SetUpperBoundDomain<T, SetUpperBoundTop> {
		return new SetUpperBoundDomain(Top, limit);
	}

	public static bottom<T>(limit?: number): SetUpperBoundDomain<T, SetUpperBoundBottom> {
		return new SetUpperBoundDomain(Bottom, limit);
	}

	public static abstract<T>(concrete: ReadonlySet<ReadonlySet<T>> | typeof Top, limit?: number): SetUpperBoundDomain<T> {
		if(concrete === Top) {
			return SetUpperBoundDomain.top(limit);
		} else if(concrete.size === 0) {
			return SetUpperBoundDomain.bottom(limit);
		}
		return new SetUpperBoundDomain(concrete.values().reduce((result, set) => result.union(set)), limit);
	}

	public top(): SetUpperBoundDomain<T, SetUpperBoundTop> {
		return SetUpperBoundDomain.top(this.limit);
	}

	public bottom(): SetUpperBoundDomain<T, SetUpperBoundBottom> {
		return SetUpperBoundDomain.bottom(this.limit);
	}

	public equals(other: SetUpperBoundDomain<T>): boolean {
		return this.value === other.value || (this.isValue() && other.isValue() && setEquals(this.value, other.value));
	}

	public leq(other: SetUpperBoundDomain<T>): boolean {
		return this.value === Bottom || other.value === Top || (this.isValue() && other.isValue() && this.value.isSubsetOf(other.value));
	}

	public join(...values: SetUpperBoundDomain<T>[]): SetUpperBoundDomain<T>;
	public join(...values: SetUpperBoundLift<T>[]): SetUpperBoundDomain<T>;
	public join(...values: (T[] | typeof Top | typeof Bottom)[]): SetUpperBoundDomain<T>;
	public join(...values: SetUpperBoundDomain<T>[] | (SetUpperBoundLift<T> | T[])[]): SetUpperBoundDomain<T> {
		let result: SetUpperBoundLift<T> = this.value;

		for(const other of values) {
			const otherValue = other instanceof SetUpperBoundDomain ? other.value : Array.isArray(other) ? new Set(other) : other;

			if(result === Top || otherValue === Top) {
				result = Top;
				break;
			} else if(result === Bottom) {
				result = otherValue;
			} else if(otherValue === Bottom) {
				continue;
			} else {
				const join = result.union(otherValue);
				result = join.size > this.limit ? Top : join;
			}
		}
		return this.create(result);
	}

	public meet(...values: SetUpperBoundDomain<T>[]): SetUpperBoundDomain<T>;
	public meet(...values: SetUpperBoundLift<T>[]): SetUpperBoundDomain<T>;
	public meet(...values: (T[] | typeof Top | typeof Bottom)[]): SetUpperBoundDomain<T>;
	public meet(...values: SetUpperBoundDomain<T>[] | (SetUpperBoundLift<T> | T[])[]): SetUpperBoundDomain<T> {
		let result: SetUpperBoundLift<T> = this.value;

		for(const other of values) {
			const otherValue = other instanceof SetUpperBoundDomain ? other.value : Array.isArray(other) ? new Set(other) : other;

			if(result === Bottom || otherValue === Bottom) {
				result = Bottom;
				break;
			} else if(result === Top) {
				result = otherValue;
			} else if(otherValue === Top) {
				continue;
			} else {
				result = result.intersection(otherValue);
			}
		}
		return this.create(result);
	}

	/**
	 * Subtracts another abstract value from the current abstract value by removing all elements of the other abstract value from the current abstract value.
	 */
	public subtract(other: SetUpperBoundDomain<T> | SetUpperBoundLift<T> | T[]): SetUpperBoundDomain<T> {
		const otherValue = other instanceof SetUpperBoundDomain ? other.value : Array.isArray(other) ? new Set(other) : other;

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

	public widen(other: SetUpperBoundDomain<T>): SetUpperBoundDomain<T> {
		if(this.value === Bottom) {
			return this.create(other.value);
		} else if(other.value === Bottom) {
			return this.create(this.value);
		}
		return other.leq(this) ? this.create(this.value) : this.top();
	}

	public narrow(other: SetUpperBoundDomain<T>): SetUpperBoundDomain<T> {
		if(this.value === Bottom || other.value === Bottom) {
			return this.bottom();
		}
		return this.isTop() ? this.create(other.value) : this.create(this.value);
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

	public abstract(concrete: ReadonlySet<ReadonlySet<T>> | typeof Top): SetUpperBoundDomain<T> {
		return SetUpperBoundDomain.abstract(concrete, this.limit);
	}

	public satisfies(set: ReadonlySet<T> | T[]): Ternary {
		if(this.isTop() || (this.isValue() && [...set].every(value => this.value.has(value)))) {
			return Ternary.Maybe;
		}
		return Ternary.Never;
	}

	public satisfiesLeq(set: ReadonlySet<T> | T[]): Ternary {
		return this.satisfies(set);
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

	public isTop(): this is SetUpperBoundDomain<T, SetUpperBoundTop> {
		return this.value === Top;
	}

	public isBottom(): this is SetUpperBoundDomain<T, SetUpperBoundBottom> {
		return this.value === Bottom;
	}

	public isValue(): this is SetUpperBoundDomain<T, SetUpperBoundValue<T>> {
		return this.value !== Top && this.value !== Bottom;
	}
}
