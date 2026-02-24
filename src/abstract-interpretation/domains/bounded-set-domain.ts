import { setEquals } from '../../util/collections/set';
import { Ternary } from '../../util/logic';
import { AbstractDomain, DEFAULT_INFERENCE_LIMIT, domainElementToString } from './abstract-domain';
import { Top, TopSymbol } from './lattice';
import type { SatisfiableDomain } from './satisfiable-domain';
/* eslint-disable @typescript-eslint/unified-signatures */

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
	extends AbstractDomain<T, BoundedSetValue<T>, BoundedSetTop, BoundedSetBottom, Value>
	implements SatisfiableDomain<T> {

	public readonly limit:    number;
	private readonly setType: typeof Set<T>;

	/**
	 * @param limit   - A limit for the maximum number of elements to store in the set
	 * @param setType - An optional set constructor for the domain elements if the type `T` is not storable in a HashSet
	 */
	constructor(value: Value | T[], limit: number = DEFAULT_INFERENCE_LIMIT, setType: typeof Set<T> = Set) {
		if(value !== Top) {
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

	public create(value: BoundedSetLift<T> | T[]): this;
	public create(value: BoundedSetLift<T> | T[]): BoundedSetDomain<T> {
		return new BoundedSetDomain(value, this.limit, this.setType);
	}

	public static top<T>(limit?: number, setType?: typeof Set<T>): BoundedSetDomain<T, BoundedSetTop> {
		return new BoundedSetDomain(Top, limit, setType);
	}

	public static bottom<T>(limit?: number, setType?: typeof Set<T>): BoundedSetDomain<T, BoundedSetBottom> {
		return new BoundedSetDomain(BoundedSetBottom, limit, setType);
	}

	public static abstract<T>(concrete: ReadonlySet<T> | typeof Top, limit?: number, setType?: typeof Set<T>): BoundedSetDomain<T> {
		return new BoundedSetDomain(concrete, limit, setType);
	}

	public top(): this & BoundedSetDomain<T, BoundedSetTop>;
	public top(): BoundedSetDomain<T, BoundedSetTop> {
		return BoundedSetDomain.top(this.limit, this.setType);
	}

	public bottom(): this & BoundedSetDomain<T, BoundedSetBottom>;
	public bottom(): BoundedSetDomain<T, BoundedSetBottom> {
		return BoundedSetDomain.bottom(this.limit, this.setType);
	}

	public equals(other: this): boolean {
		return this.value === other.value || (this.isValue() && other.isValue() && setEquals(this.value, other.value));
	}

	public leq(other: this): boolean {
		return other.value === Top || (this.isValue() && this.value.isSubsetOf(other.value));
	}

	public join(other: BoundedSetLift<T> | T[]): this;
	public join(other: this): this;
	public join(other: this | BoundedSetLift<T> | T[]): this {
		const otherValue = other instanceof BoundedSetDomain ? other.value : Array.isArray(other) ? new this.setType(other) : other;

		if(this.value === Top || otherValue === Top) {
			return this.top();
		} else {
			return this.create(this.value.union(otherValue));
		}
	}

	public meet(other: BoundedSetLift<T> | T[]): this;
	public meet(other: this): this;
	public meet(other: this | BoundedSetLift<T> | T[]): this {
		const otherValue = other instanceof BoundedSetDomain ? other.value : Array.isArray(other) ? new this.setType(other) : other;

		if(this.value === Top) {
			return this.create(otherValue);
		} else if(otherValue === Top) {
			return this.create(this.value);
		} else {
			return this.create(this.value.intersection(otherValue));
		}
	}

	/**
	 * Subtracts another abstract value from the current abstract value by removing all elements of the other abstract value from the current abstract value.
	 */
	public subtract(other: this | BoundedSetLift<T> | T[]): this {
		const otherValue = other instanceof BoundedSetDomain ? other.value : Array.isArray(other) ? new this.setType(other) : other;

		if(this.value === Top) {
			return this.top();
		} else if(otherValue === Top) {
			return this.create(this.value);
		} else {
			return this.create(this.value.difference(otherValue));
		}
	}

	public widen(other: this): this {
		return other.leq(this) ? this.create(this.value) : this.top();
	}

	public narrow(other: this): this {
		return this.isTop() ? this.create(other.value) : this.create(this.value);
	}

	public concretize(limit: number): ReadonlySet<T> | typeof Top {
		return this.value === Top || this.value.size > limit ? Top : this.value;
	}

	public abstract(concrete: ReadonlySet<T> | typeof Top): this;
	public abstract(concrete: ReadonlySet<T> | typeof Top): BoundedSetDomain<T> {
		return BoundedSetDomain.abstract(concrete, this.limit, this.setType);
	}

	public satisfies(value: T): Ternary {
		if(this.isValue() && this.value.has(value)) {
			return this.value.size === 1 ? Ternary.Always : Ternary.Maybe;
		} else if(this.isTop()) {
			return Ternary.Maybe;
		}
		return Ternary.Never;
	}

	public toJson(): unknown {
		if(this.value === Top) {
			return this.value.description;
		}
		return this.value.values().toArray();
	}

	public toString(): string {
		if(this.value === Top) {
			return TopSymbol;
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
