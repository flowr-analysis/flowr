import { domainElementToString, type AbstractDomain } from './abstract-domain';
import { Bottom, Top } from './lattice';

/** The type of the actual values of the singleton domain as single value */
export type SingletonValue<T> = T;
/** The type of the Top element of the singleton domain as {@link Top} symbol */
export type SingletonTop = typeof Top;
/** The type of the Bottom element of the singleton domain as {@link Bottom} symbol */
export type SingletonBottom = typeof Bottom;
/** The type of the abstract values of the singleton domain that are Top, Bottom, or actual values */
export type SingletonLift<T> = SingletonValue<T> | SingletonTop | SingletonBottom;

/**
 * The singleton abstract domain as single possible value.
 * The Bottom element is defined as {@link Bottom} symbol and the Top element is defined as {@link Top} symbol.
 * @template T     - Type of the value in the abstract domain
 * @template Value - Type of the constraint in the abstract domain (Top, Bottom, or an actual value)
 */
export class SingletonDomain<T, Value extends SingletonLift<T> = SingletonLift<T>>
implements AbstractDomain<T, SingletonValue<T>, SingletonTop, SingletonBottom, Value> {
	private _value: Value;

	constructor(value: Value) {
		this._value = value;
	}

	public get value(): Value {
		return this._value;
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

	public top(): SingletonDomain<T, SingletonTop> {
		return SingletonDomain.top();
	}

	public bottom(): SingletonDomain<T, SingletonBottom> {
		return SingletonDomain.bottom();
	}

	public equals(other: SingletonDomain<T>): boolean {
		return this.value === other.value;
	}

	public leq(other: SingletonDomain<T>): boolean {
		return this.value === Bottom || other.value === Top || (this.isValue() && other.isValue() && this.value <= other.value);
	}

	public join(...values: SingletonDomain<T>[]): SingletonDomain<T> {
		const result = new SingletonDomain<T>(this.value);

		for(const other of values) {
			if(result.value === Bottom) {
				result._value = other.value;
			} else if(other.value === Bottom) {
				result._value = result.value;
			} else if(result.value !== other.value) {
				result._value = Top;
			}
		}
		return result;
	}

	public meet(...values: SingletonDomain<T>[]): SingletonDomain<T> {
		const result = new SingletonDomain<T>(this.value);

		for(const other of values) {
			if(result.value === Top) {
				result._value = other.value;
			} else if(other.value === Top) {
				result._value = result.value;
			} else if(result.value !== other.value) {
				result._value = Bottom;
			}
		}
		return result;
	}

	public widen(other: SingletonDomain<T>): SingletonDomain<T> {
		return this.join(other);  // Using join for widening as the lattice is finite
	}

	public narrow(other: SingletonDomain<T>): SingletonDomain<T> {
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

	public abstract(concrete: ReadonlySet<T> | typeof Top): SingletonDomain<T> {
		return SingletonDomain.abstract(concrete);
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
