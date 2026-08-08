import { Ternary } from '../../util/logic';
import { AbstractDomain } from './abstract-domain';
import { Bottom, Top } from './lattice';
import type { ValueDomain } from './value-abstract-domain';

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

	protected equalsValue(this: SingletonDomain<T, SingletonValue<T>>, other: SingletonDomain<T, SingletonValue<T>>): boolean {
		return this.value === other.value;
	}

	protected leqValue(this: SingletonDomain<T, SingletonValue<T>>, other: SingletonDomain<T, SingletonValue<T>>): boolean {
		return this.value <= other.value;
	}

	protected joinValue(this: this & SingletonDomain<T, SingletonValue<T>>, other: this & SingletonDomain<T, SingletonValue<T>>): this {
		return this.equals(other) ? this.create(this.value) : this.top();
	}

	protected meetValue(this: this & SingletonDomain<T, SingletonValue<T>>, other: this & SingletonDomain<T, SingletonValue<T>>): this {
		return this.equals(other) ? this.create(this.value) : this.bottom();
	}

	protected widenValue(this: this & SingletonDomain<T, SingletonValue<T>>, other: this & SingletonDomain<T, SingletonValue<T>>): this {
		return this.joinValue(other);  // Using join for widening as the lattice is finite
	}

	protected narrowValue(this: this & SingletonDomain<T, SingletonValue<T>>, other: this & SingletonDomain<T, SingletonValue<T>>): this {
		return this.meetValue(other);  // Using meet for narrowing as the lattice is finite
	}

	public satisfies(value: T): Ternary {
		if(this.equals(this.from(value))) {
			return Ternary.Always;
		} else if(this.isTop()) {
			return Ternary.Maybe;
		}
		return Ternary.Never;
	}

	protected jsonify(): unknown {
		return this.value;
	}

	protected stringify(): string {
		return AbstractDomain.toString(this.value);
	}

	public isTop(): this is this & SingletonDomain<T, SingletonTop> {
		return this.value === Top;
	}

	public isBottom(): this is this & SingletonDomain<T, SingletonBottom> {
		return this.value === Bottom;
	}

	public isValue(): this is this & SingletonDomain<T, SingletonValue<T>> {
		return this.value !== Top && this.value !== Bottom;
	}
}
