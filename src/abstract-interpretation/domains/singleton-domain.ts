import { Ternary } from '../../util/logic';
import { AbstractDomain, domainElementToString } from './abstract-domain';
import { Bottom, Top } from './lattice';
import type { SatisfiableDomain } from './satisfiable-domain';
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
	extends AbstractDomain<T, SingletonValue<T>, SingletonTop, SingletonBottom, Value>
	implements SatisfiableDomain<T> {

	public create(value: SingletonLift<T>): this;
	public create(value: SingletonLift<T>): SingletonDomain<T> {
		return new SingletonDomain(value);
	}

	public static top<T>(): SingletonDomain<T, SingletonTop> {
		return new SingletonDomain(Top);
	}

	public static bottom<T>(): SingletonDomain<T, SingletonBottom> {
		return new SingletonDomain(Bottom);
	}

	public static abstract<T>(concrete: ReadonlySet<T> | typeof Top): SingletonDomain<T> {
		if(concrete === Top || concrete.size > 1) {
			return SingletonDomain.top();
		} else if(concrete.size === 0) {
			return SingletonDomain.bottom();
		}
		return new SingletonDomain([...concrete][0]);
	}

	public top(): this & SingletonDomain<T, SingletonTop>;
	public top(): SingletonDomain<T, SingletonTop> {
		return SingletonDomain.top();
	}

	public bottom(): this & SingletonDomain<T, SingletonBottom>;
	public bottom(): SingletonDomain<T, SingletonBottom> {
		return SingletonDomain.bottom();
	}

	public equals(other: this): boolean {
		return this.value === other.value;
	}

	public leq(other: this): boolean {
		return this.value === Bottom || other.value === Top || (this.isValue() && other.isValue() && this.value <= other.value);
	}

	public join(other: this): this;
	public join(other: SingletonLift<T>): this;
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

	public meet(other: this): this;
	public meet(other: SingletonLift<T>): this;
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

	public concretize(): ReadonlySet<T> |  typeof Top {
		if(this.value === Top) {
			return Top;
		} else if(this.value === Bottom) {
			return new Set();
		}
		return new Set([this.value as T]);
	}

	public abstract(concrete: ReadonlySet<T> | typeof Top): this;
	public abstract(concrete: ReadonlySet<T> | typeof Top): SingletonDomain<T> {
		return SingletonDomain.abstract(concrete);
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
			return '⊤';
		} else if(this.value === Bottom) {
			return '⊥';
		}
		return domainElementToString(this.value);
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
