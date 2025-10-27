import { Ternary } from '../../util/logic';
import type { AbstractDomain } from './abstract-domain';
import { domainElementToString } from './abstract-domain';
import { Bottom, Top } from './lattice';
import type { SatisfiableDomain } from './satisfiable-domain';

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
implements AbstractDomain<SingletonDomain<T>, T, SingletonValue<T>, SingletonTop, SingletonBottom, Value>, SatisfiableDomain<T> {
	private readonly _value: Value;

	constructor(value: Value) {
		this._value = value;
	}

	public create(value: SingletonLift<T>): SingletonDomain<T> {
		return new SingletonDomain(value);
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

	public join(...values: readonly SingletonDomain<T>[]): SingletonDomain<T>;
	public join(...values: readonly SingletonLift<T>[]): SingletonDomain<T>;
	public join(...values: readonly SingletonDomain<T>[] | readonly SingletonLift<T>[]): SingletonDomain<T> {
		let result: SingletonLift<T> = this.value;

		for(const other of values) {
			const otherValue = other instanceof SingletonDomain ? other.value : other;

			if(result === Bottom) {
				result = otherValue;
			} else if(otherValue === Bottom) {
				continue;
			} else if(result !== otherValue) {
				result = Top;
				break;
			}
		}
		return this.create(result);
	}

	public meet(...values: readonly SingletonDomain<T>[]): SingletonDomain<T>;
	public meet(...values: readonly SingletonLift<T>[]): SingletonDomain<T>;
	public meet(...values: readonly SingletonDomain<T>[] | readonly SingletonLift<T>[]): SingletonDomain<T> {
		let result: SingletonLift<T> = this.value;

		for(const other of values) {
			const otherValue = other instanceof SingletonDomain ? other.value : other;

			if(result === Top) {
				result = otherValue;
			} else if(otherValue === Top) {
				continue;
			} else if(result !== otherValue) {
				result = Bottom;
				break;
			}
		}
		return this.create(result);
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
