import { guard } from '../../util/assert';
import { type Lattice, Bottom, BottomSymbol, Top, TopSymbol } from './lattice';

/**
 * The default limit of inferred constraints in {@link AbstractDomain|AbstractDomains}.
 */
export const DEFAULT_INFERENCE_LIMIT = 50;

/**
 * An abstract domain as complete lattice with a widening and narrowing operator.
 * All operations of value abstract domains should not modify the domain in-place but return new values using {@link create}.
 * @template Value - Type of an abstract element of the abstract domain representing possible elements (excludes `Top` and `Bot`)
 * @template Top   - Type of the Top element of the abstract domain representing all possible elements
 * @template Bot   - Type of the Bottom element of the abstract domain representing no possible elements
 * @template Lift  - Type of the current abstract value in the abstract domain (defaults to `Value` or `Top` or `Bot`)
 */
export abstract class AbstractDomain<Value, Top, Bot, Lift extends Value | Top | Bot = Value | Top | Bot>
implements Lattice<Value, Top, Bot, Lift> {
	protected readonly _value: Lift;

	constructor(value: Lift) {
		this._value = value;
	}

	public get value(): Lift {
		return this._value;
	}

	public abstract create(value: Value | Top | Bot): this;

	public abstract top(): this & AbstractDomain<Value, Top, Bot, Top>;

	public abstract bottom(): this & AbstractDomain<Value, Top, Bot, Bot>;

	public abstract equals(other: this): boolean;

	public abstract leq(other: this): boolean;

	public abstract join(other: this): this;

	/**
	 * Joins the current abstract value with multiple other abstract values.
	 */
	public joinAll(values: readonly this[]): this {
		let result = this.create(this.value);

		for(const other of values) {
			result = result.join(other);
		}
		return result;
	}

	public abstract meet(other: this): this;

	/**
	 * Meets the current abstract value with multiple other abstract values.
	 */
	public meetAll(values: readonly this[]): this {
		let result = this.create(this.value);

		for(const other of values) {
			result = result.meet(other);
		}
		return result;
	}

	/**
	 * Widens the current abstract value with another abstract value as a sound over-approximation of the join (least upper bound) for fixpoint iteration acceleration.
	 */
	public abstract widen(other: this): this;

	/**
	 * Narrows the current abstract value with another abstract value as a sound over-approximation of the meet (greatest lower bound) to refine the value after widening.
	 */
	public abstract narrow(other: this): this;

	public abstract toJson(): unknown;

	public abstract toString(): string;

	public abstract isTop(): this is AbstractDomain<Value, Top, Bot, Top>;

	public abstract isBottom(): this is AbstractDomain<Value, Top, Bot, Bot>;

	public abstract isValue(): this is AbstractDomain<Value, Top, Bot, Value>;

	/**
	 * Joins an array of abstract values by joining the first abstract value with the other values in the array.
	 * The provided array of abstract values must not be empty or a default value must be provided!
	 */
	public static joinAll<Domain extends AnyAbstractDomain>(values: Domain[], defaultValue?: Domain): Domain {
		guard(values.length > 0 || defaultValue !== undefined, 'Abstract values to join cannot be empty');
		return values[0]?.joinAll(values.slice(1)) ?? defaultValue;
	}

	/**
	 * Meets an array of abstract values by meeting the first abstract value with the other values in the array.
	 * The provided array of abstract values must not be empty or a default value must be provided!
	 */
	public static meetAll<Domain extends AnyAbstractDomain>(values: Domain[], defaultValue?: Domain): Domain {
		guard(values.length > 0 || defaultValue !== undefined, 'Abstract values to meet cannot be empty');
		return values[0]?.meetAll(values.slice(1)) ?? defaultValue;
	}

	/**
	 * Converts an element of an abstract domain into a string.
	 */
	public static toString(this: void, value: AnyAbstractDomain | unknown): string {
		if(value instanceof Map) {
			return `{${value.entries().map(([key, value]) => `${AbstractDomain.toString(key)} -> ${AbstractDomain.toString(value)}`).toArray().join(', ')}}`;
		} else if(value instanceof Set) {
			return `{${value.values().map(AbstractDomain.toString).toArray().join(', ')}}`;
		} else if(typeof value === 'object' && value !== null && value.toString !== Object.prototype.toString) {
			// eslint-disable-next-line @typescript-eslint/no-base-to-string
			return value.toString();
		} else if(Array.isArray(value)) {
			return `[${value.map(AbstractDomain.toString).join(', ')}]`;
		} else if(value === Top) {
			return TopSymbol;
		} else if(value === Bottom) {
			return BottomSymbol;
		}
		return JSON.stringify(value);
	}
}

/**
 * A type representing any abstract domain without additional information.
 */
export type AnyAbstractDomain = AbstractDomain<unknown, unknown, unknown>;

/**
 * The type of the abstract values of an abstract domain (including the Top and Bottom element).
 * @template Domain - The abstract domain to get the abstract value type for
 */
export type AbstractValue<Domain extends AnyAbstractDomain> =
	Domain extends AbstractDomain<infer Value, infer Top, infer Bot> ? Value | Top | Bot : never;

/**
 * The type of an abstract domain holding an abstract value of the domain.
 * @template Domain - The abstract domain abstract domain value type for
 */
export type AbstractDomainValue<Domain extends AnyAbstractDomain> =
	Domain extends AbstractDomain<infer Value, infer Top, infer Bot> ? Domain & AbstractDomain<Value, Top, Bot, Value> : never;

/**
 * The type an abstract domain holding the Top element (greatest element) of the domain.
 * @template Domain - The abstract domain to get the abstract domain top for
 */
export type AbstractDomainTop<Domain extends AnyAbstractDomain> =
	Domain extends AbstractDomain<infer Value, infer Top, infer Bot> ? Domain & AbstractDomain<Value, Top, Bot, Top> : never;

/**
 * The type an abstract domain holding the Bottom element (least element) of the domain.
 * @template Domain - The abstract domain to get the abstract domain bottom for
 */
export type AbstractDomainBottom<Domain extends AnyAbstractDomain> =
	Domain extends AbstractDomain<infer Value, infer Top, infer Bot> ? Domain & AbstractDomain<Value, Top, Bot, Bot> : never;
