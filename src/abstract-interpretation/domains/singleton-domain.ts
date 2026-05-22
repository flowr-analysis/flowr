import { Ternary } from '../../util/logic';
import { AbstractDomain } from './abstract-domain';
import { Bottom, BottomSymbol, Top, TopSymbol } from './lattice';
import type { ValueDomain } from './value-abstract-domain';
/* eslint-disable @typescript-eslint/unified-signatures */

/** The type of the actual values of the singleton domain as single value */
type SingletonValue<T> = T;
/** The type of the Top element of the singleton domain as {@link Top} symbol */
type SingletonTop = typeof Top;
/** The type of the Bottom element of the singleton domain as {@link Bottom} symbol */
type SingletonBottom = typeof Bottom;
/** The type of the abstract values of the singleton domain that are Top, Bottom, or actual values */
type SingletonLift<T> = SingletonValue<T> | SingletonTop | SingletonBottom;

/**
 * The singleton abstract domain as a single possible value.
 * The Bottom element is defined as {@link Bottom} symbol and the Top element is defined as {@link Top} symbol.
 * @template T     - Type of the value in the abstract domain
 * @template Value - Type of the constraint in the abstract domain (Top, Bottom, or an actual value)
 */
export class SingletonDomain<T, Value extends SingletonLift<T> = SingletonLift<T>>
	extends AbstractDomain<SingletonValue<T>, SingletonTop, SingletonBottom, Value>
	implements ValueDomain<T> {

	public create(value: SingletonLift<T>): this {
		return new SingletonDomain(value) as this;
	}

	public from(...values: T[]): this {
		if(values.length === 0) {
			return this.bottom();
		} else if(values.length > 1) {
			return this.top();
		}
		return this.create(values[0]);
	}

	public static top<T>(): SingletonDomain<T, SingletonTop> {
		return new this(Top);
	}

	public static bottom<T>(): SingletonDomain<T, SingletonBottom> {
		return new this(Bottom);
	}

	public static from<T>(...values: T[]): SingletonDomain<T> {
		if(values.length === 0) {
			return this.bottom();
		} else if(values.length > 1) {
			return this.top();
		}
		return new this(values[0]);
	}

	public top(): this & SingletonDomain<T, SingletonTop> {
		return this.create(Top) as this & SingletonDomain<T, SingletonTop>;
	}

	public bottom(): this & SingletonDomain<T, SingletonBottom> {
		return this.create(Bottom) as this & SingletonDomain<T, SingletonBottom>;
	}

	public equals(other: this): boolean {
		return this.value === other.value;
	}

	public leq(other: this): boolean {
		return this.value === Bottom || other.value === Top || (this.isValue() && other.isValue() && this.value <= other.value);
	}

	public join(other: SingletonLift<T>): this;
	public join(other: this): this;
	public join(other: this | SingletonLift<T>): this {
		const otherValue = other instanceof SingletonDomain ? other.value : other;

		if(this.value === Bottom) {
			return this.create(otherValue);
		} else if(otherValue === Bottom) {
			return this.create(this.value);
		} else if(this.value !== otherValue) {
			return this.top();
		} else {
			return this.create(this.value);
		}
	}

	public meet(other: SingletonLift<T>): this;
	public meet(other: this): this;
	public meet(other: this | SingletonLift<T>): this {
		const otherValue = other instanceof SingletonDomain ? other.value : other;

		if(this.value === Top) {
			return this.create(otherValue);
		} else if(otherValue === Top) {
			return this.create(this.value);
		} else if(this.value !== otherValue) {
			return this.bottom();
		} else {
			return this.create(this.value);
		}
	}

	public widen(other: this): this {
		return this.join(other);  // Using join for widening as the lattice is finite
	}

	public narrow(other: this): this {
		return this.meet(other);  // Using meet for narrowing as the lattice is finite
	}

	public satisfies(value: T): Ternary {
		if(this.isValue() && this.value === value) {
			return Ternary.Always;
		} else if(this.isTop()) {
			return Ternary.Maybe;
		}
		return Ternary.Never;
	}

	public toJson(): unknown {
		if(this.value === Top) {
			return Top.description;
		} else if(this.value === Bottom) {
			return Bottom.description;
		}
		return this.value;
	}

	public toString(): string {
		if(this.value === Top) {
			return TopSymbol;
		} else if(this.value === Bottom) {
			return BottomSymbol;
		}
		return AbstractDomain.toString(this.value);
	}

	public isTop(): this is SingletonDomain<T, SingletonTop> {
		return this.value === Top;
	}

	public isBottom(): this is SingletonDomain<T, SingletonBottom> {
		return this.value === Bottom;
	}

	public isValue(): this is SingletonDomain<T, SingletonValue<T>> {
		return this.value !== Top && this.value !== Bottom;
	}
}
