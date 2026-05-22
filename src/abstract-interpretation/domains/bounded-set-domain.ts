import { setEquals } from '../../util/collections/set';
import { Ternary } from '../../util/logic';
import { AbstractDomain, DEFAULT_INFERENCE_LIMIT } from './abstract-domain';
import { Top } from './lattice';
import type { ValueDomain } from './value-abstract-domain';

/** The Bottom element of the bounded set domain as empty set */
export const SetBottom: ReadonlySet<never> = new Set();

/** The type of the actual values of the bounded set domain as set */
type BoundedSetValue<T> = ReadonlySet<T>;
/** The type of the Top element of the bounded set domain as {@link Top} symbol */
type BoundedSetTop = typeof Top;
/** The type of the Bottom element of the bounded set domain as empty set */
type BoundedSetBottom = typeof SetBottom;
/** The type of the abstract values of the bounded set domain that are Top, Bottom, or actual values */
type BoundedSetLift<T> = BoundedSetValue<T> | BoundedSetTop | BoundedSetBottom;

/**
 * The bounded set abstract domain as sets of possible values bounded by a `limit` indicating the maximum number of inferred values.
 * The Bottom element is defined as the empty set and the Top element is defined as {@link Top} symbol.
 * @template T     - Type of the values in the abstract domain
 * @template Value - Type of the constraint in the abstract domain (Top, Bottom, or an actual value)
 */
export class BoundedSetDomain<T, Value extends BoundedSetLift<T> = BoundedSetLift<T>>
	extends AbstractDomain<BoundedSetValue<T>, BoundedSetTop, BoundedSetBottom, Value>
	implements ValueDomain<T> {

	public readonly limit:      number;
	protected readonly setType: typeof Set<T>;

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

	public create(value: BoundedSetLift<T> | T[]): this {
		return new BoundedSetDomain(value, this.limit, this.setType) as this;
	}

	public from(...values: T[]): this {
		return this.create(values);
	}

	public static top<T>(limit?: number, setType?: typeof Set<T>): BoundedSetDomain<T, BoundedSetTop> {
		return new this(Top, limit, setType);
	}

	public static bottom<T>(limit?: number, setType?: typeof Set<T>): BoundedSetDomain<T, BoundedSetBottom> {
		return new this(SetBottom, limit, setType);
	}

	public static from<T>(values: T | T[], limit?: number, setType?: typeof Set<T>): BoundedSetDomain<T> {
		return new this(Array.isArray(values) ? values : [values], limit, setType);
	}

	public top(): this & BoundedSetDomain<T, BoundedSetTop> {
		return this.create(Top) as this & BoundedSetDomain<T, BoundedSetTop>;
	}

	public bottom(): this & BoundedSetDomain<T, BoundedSetBottom> {
		return this.create(SetBottom) as this & BoundedSetDomain<T, BoundedSetBottom>;
	}

	protected equalsValue(this: BoundedSetDomain<T, BoundedSetValue<T>>, other: BoundedSetDomain<T, BoundedSetValue<T>>): boolean {
		return setEquals(this.value, other.value);
	}

	protected leqValue(this: BoundedSetDomain<T, BoundedSetValue<T>>, other: BoundedSetDomain<T, BoundedSetValue<T>>): boolean {
		return this.value.isSubsetOf(other.value);
	}

	protected joinValue(this: this & BoundedSetDomain<T, BoundedSetValue<T>>, other: BoundedSetDomain<T, BoundedSetValue<T>>): this {
		return this.create(this.value.union(other.value));
	}

	protected meetValue(this: this & BoundedSetDomain<T, BoundedSetValue<T>>, other: BoundedSetDomain<T, BoundedSetValue<T>>): this {
		return this.create(this.value.intersection(other.value));
	}

	public satisfies(value: T): Ternary {
		if(this.isValue() && this.value.has(value)) {
			return this.value.size === 1 ? Ternary.Always : Ternary.Maybe;
		} else if(this.isTop()) {
			return Ternary.Maybe;
		}
		return Ternary.Never;
	}

	protected jsonify(this: BoundedSetDomain<T, BoundedSetValue<T>>): unknown {
		return this.value.values().toArray();
	}

	protected stringify(this: BoundedSetDomain<T, BoundedSetValue<T>>): string {
		return `{${this.value.values().map(AbstractDomain.toString).toArray().join(', ')}}`;
	}

	public isTop(): this is this & BoundedSetDomain<T, BoundedSetTop> {
		return this.value === Top;
	}

	public isBottom(): this is this & BoundedSetDomain<T, BoundedSetBottom> {
		return this.value !== Top && this.value.size === 0;
	}

	public isValue(): this is this & BoundedSetDomain<T, BoundedSetValue<T>> {
		return this.value !== Top;
	}
}
