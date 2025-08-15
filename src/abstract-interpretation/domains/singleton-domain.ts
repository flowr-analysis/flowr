import type { AbstractDomain } from './abstract-domain';
import { Bottom, Top } from './lattice';

type SingletonValue<T> = T;
type SingletonTop = typeof Top;
type SingletonBottom = typeof Bottom;
type SingletonLift<T> = SingletonValue<T> | SingletonTop | SingletonBottom;

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
			if(!result.isBottom() && !other.isBottom() && !result.equals(other)) {
				result._value = Top;
			}
		}
		return result;
	}

	public meet(...values: SingletonDomain<T>[]): SingletonDomain<T> {
		const result = new SingletonDomain<T>(this.value);

		for(const other of values) {
			if(!result.isTop() && !other.isTop() && !result.equals(other)) {
				result._value = Bottom;
			}
		}
		return result;
	}

	public widen(other: SingletonDomain<T>): SingletonDomain<T> {
		return this.leq(other) ? new SingletonDomain(other.value) : this.top();
	}

	public narrow(other: SingletonDomain<T>): SingletonDomain<T> {
		return this.isTop() ? other : this;
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
		return typeof this.value === 'object' && this.value !== null ? this.value.toString() : JSON.stringify(this.value);
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
