
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

	public equals(other: this): boolean {
		if(this.value === other.value || (this.isTop() && other.isTop()) || (this.isBottom() && other.isBottom())) {
			return true;
		} else if(!this.isValue() || !other.isValue()) {
			return false;
		}
		return this.equalsValue(other);
	}

	protected abstract equalsValue(this: AbstractDomain<Value, Top, Bot, Value>, other: AbstractDomain<Value, Top, Bot, Value>): boolean;

	public leq(other: this): boolean {
		if(this.isBottom() || other.isTop() || this.equals(other)) {
			return true;
		} else if(!this.isValue() || !other.isValue()) {
			return false;
		}
		return this.leqValue(other);
	}

	protected abstract leqValue(this: AbstractDomain<Value, Top, Bot, Value>, other: AbstractDomain<Value, Top, Bot, Value>): boolean;

	public join(other: this | Value | Top | Bot): this {
		other = other instanceof AbstractDomain ? other : this.create(other);

		if(this.isTop() || other.isTop()) {
			return this.top();
		} else if(this.isBottom()) {
			return this.create(other.value);
		} else if(other.isBottom()) {
			return this.create(this.value);
		} else if(!this.isValue() || !other.isValue()) {
			return this.bottom();
		}
		return this.joinValue(other);
	}

	protected abstract joinValue(this: AbstractDomain<Value, Top, Bot, Value>, other: AbstractDomain<Value, Top, Bot, Value>): this;

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

	public meet(other: this | Value | Top | Bot): this {
		other = other instanceof AbstractDomain ? other : this.create(other);

		if(this.isTop()) {
			return this.create(other.value);
		} else if(other.isTop()) {
			return this.create(this.value);
		} else if(this.isBottom() || other.isBottom()) {
			return this.bottom();
		} else if(!this.isValue() || !other.isValue()) {
			return this.top();
		}
		return this.meetValue(other);
	}

	protected abstract meetValue(this: AbstractDomain<Value, Top, Bot, Value>, other: AbstractDomain<Value, Top, Bot, Value>): this;

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
	public widen(other: this): this {
		if(this.isTop() || other.isTop()) {
			return this.top();
		} else if(this.isBottom()) {
			return this.create(other.value);
		} else if(other.isBottom()) {
			return this.create(this.value);
		} else if(!this.isValue() || !other.isValue()) {
			return this.bottom();
		}
		return this.widenValue?.(other) ?? (other.leq(this) ? this.create(this.value) : this.top());
	}

	protected widenValue?(this: AbstractDomain<Value, Top, Bot, Value>, other: AbstractDomain<Value, Top, Bot, Value>): this;

	/**
	 * Narrows the current abstract value with another abstract value as a sound over-approximation of the meet (greatest lower bound) to refine the value after widening.
	 */
	public narrow(other: this): this {
		if(this.isTop()) {
			return this.create(other.value);
		} else if(other.isTop()) {
			return this.create(this.value);
		} else if(this.isBottom() || other.isBottom()) {
			return this.bottom();
		} else if(!this.isValue() || !other.isValue()) {
			return this.top();
		}
		return this.narrowValue?.(other) ?? (this.isTop() ? this.create(other.value) : this.create(this.value));
	}

	protected narrowValue?(this: AbstractDomain<Value, Top, Bot, Value>, other: AbstractDomain<Value, Top, Bot, Value>): this;

	public transform(transform: (value: Value) => Value | Top | Bot, bottomDefault: Value | Top | Bot, topDefault: Value | Top | Bot): this;
	public transform(transform: (value: Value | Top) => Value | Top | Bot, bottomDefault: Value | Top | Bot): this;
	public transform(transform: (value: Value | Top | Bot) => Value | Top | Bot): this;
	public transform(transform: (value: Value) => Value | Top | Bot, bottomDefault?: Value | Top | Bot, topDefault?: Value | Top | Bot): this {
		if(bottomDefault !== undefined && this.isBottom()) {
			return this.create(bottomDefault);
		} else if(topDefault !== undefined && this.isTop()) {
			return this.create(topDefault);
		}
		return this.create(transform(this.value as Value));
	}

	public merge(other: this, merge: (first: Value, second: Value) => Value | Top | Bot, bottomDefault: (other: Value | Top | Bot) => Value | Top | Bot, topDefault: (other: Value | Top | Bot) => Value | Top | Bot): this;
	public merge(other: this, merge: (first: Value | Top, second: Value | Top) => Value | Top | Bot, bottomDefault: (other: Value | Top | Bot) => Value | Top | Bot): this;
	public merge(other: this, merge: (first: Value | Top | Bot, second: Value | Top | Bot) => Value | Top | Bot): this;
	public merge(other: this, merge: (first: Value, second: Value) => Value | Top | Bot, bottomDefault?: (other: Value | Top | Bot) => Value | Top | Bot, topDefault?: (other: Value | Top | Bot) => Value | Top | Bot): this {
		if(bottomDefault !== undefined) {
			if(this.isBottom() ) {
				return this.create(bottomDefault(other.value));
			} else if(other.isBottom()) {
				return this.create(bottomDefault(this.value));
			}
		}
		if(topDefault !== undefined) {
			if(this.isTop()) {
				return this.create(topDefault(other.value));
			} else if(other.isTop()) {
				return this.create(topDefault(this.value));
			}
		}
		return this.create(merge(this.value as Value, other.value as Value));
	}

	public toJson(): unknown {
		if(this.value === Top) {
			return Top.description;
		} else if(this.value === Bottom) {
			return Bottom.description;
		}
		return (this as this & AbstractDomain<Value, Top, Bot, Exclude<Lift, typeof Top | typeof Bottom>>).jsonify();
	}

	protected abstract jsonify(this: AbstractDomain<Value, Top, Bot, Exclude<Value | Top | Bot, typeof Top | typeof Bottom>>): unknown;

	public toString(): string {
		if(this.value === Top) {
			return TopSymbol;
		} else if(this.value === Bottom) {
			return BottomSymbol;
		}
		return (this as this & AbstractDomain<Value, Top, Bot, Exclude<Lift, typeof Top | typeof Bottom>>).stringify();
	}

	protected abstract stringify(this: AbstractDomain<Value, Top, Bot, Exclude<Value | Top | Bot, typeof Top | typeof Bottom>>): string;

	public abstract isTop(): this is this & AbstractDomain<Value, Top, Bot, Top>;

	public abstract isBottom(): this is this & AbstractDomain<Value, Top, Bot, Bot>;

	public abstract isValue(): this is this & AbstractDomain<Value, Top, Bot, Value>;

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
