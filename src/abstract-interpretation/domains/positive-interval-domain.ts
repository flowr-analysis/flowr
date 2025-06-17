import type { AbstractDomain } from './abstract-domain';
import { Bottom } from './abstract-domain';

type PosIntervalValue = readonly [number, number];
type PosIntervalTop = readonly [0, typeof Infinity];
type PosIntervalBottom = typeof Bottom;
type PosIntervalLift = PosIntervalValue | PosIntervalTop | PosIntervalBottom;

export class PosIntervalDomain<Value extends PosIntervalLift = PosIntervalLift>
implements AbstractDomain<PosIntervalValue, PosIntervalTop, PosIntervalBottom, Value> {
	private _value: Value;

	constructor(value: Value) {
		this._value = (Array.isArray(value) ? [value[0], value[1]] : value) as Value;
	}

	public get value(): Value {
		return this._value;
	}

	public static top(): PosIntervalDomain<PosIntervalTop> {
		return new PosIntervalDomain([0, Infinity]);
	}

	public static bottom(): PosIntervalDomain<PosIntervalBottom> {
		return new PosIntervalDomain(Bottom);
	}

	public top(): PosIntervalDomain<PosIntervalTop> {
		return PosIntervalDomain.top();
	}

	public bottom(): PosIntervalDomain<PosIntervalBottom> {
		return PosIntervalDomain.bottom();
	}

	public equals(other: PosIntervalDomain): boolean {
		return this.value === other.value || (this.isValue() && other.isValue() && this.value[0] === other.value[0] && this.value[1] === other.value[1]);
	}

	public leq(other: PosIntervalDomain): boolean {
		return this.value === Bottom || (other.isValue() && other.value[0] <= this.value[0] && this.value[1] <= other.value[1]);
	}

	public join(...values: PosIntervalDomain[]): PosIntervalDomain {
		const result = new PosIntervalDomain<PosIntervalLift>(this.value);

		for(const other of values) {
			if(result.value === Bottom) {
				result._value = other.value;
			} else if(other.value === Bottom) {
				result._value = result.value;
			} else {
				result._value = [Math.min(result.value[0], other.value[0]), Math.max(result.value[1], other.value[1])];
			}
		}
		return result;
	}

	public meet(...values: PosIntervalDomain[]): PosIntervalDomain {
		const result = new PosIntervalDomain<PosIntervalLift>(this.value);

		for(const other of values) {
			if(this.value === Bottom || other.value === Bottom) {
				result._value = Bottom;
			} else if(Math.max(this.value[0], other.value[0]) > Math.min(this.value[1], other.value[1])) {
				result._value = Bottom;
			} else {
				result._value = [Math.max(this.value[0], other.value[0]), Math.min(this.value[1], other.value[1])];
			}
		}
		return result;
	}

	public widen(other: PosIntervalDomain): PosIntervalDomain {
		if(this.value === Bottom) {
			return new PosIntervalDomain(other.value);
		} else if(other.value === Bottom) {
			return new PosIntervalDomain(this.value);
		} else {
			return new PosIntervalDomain([this.value[0] <= other.value[0] ? this.value[0] : 0, this.value[1] >= other.value[1] ? this.value[1] : Infinity]);
		}
	}

	public add(other: PosIntervalDomain): PosIntervalDomain {
		if(this.value === Bottom || other.value === Bottom) {
			return this.bottom();
		} else {
			return new PosIntervalDomain([this.value[0] + other.value[0], this.value[1] + other.value[1]]);
		}
	}

	public subtract(other: PosIntervalDomain): PosIntervalDomain {
		if(this.value === Bottom || other.value === Bottom) {
			return this.bottom();
		} else {
			return new PosIntervalDomain([Math.max(this.value[0] - other.value[0], 0), Math.max(this.value[1] - other.value[1], 0)]);
		}
	}

	public min(other: PosIntervalDomain): PosIntervalDomain {
		if(this.value === Bottom || other.value === Bottom) {
			return this.bottom();
		} else {
			return new PosIntervalDomain([Math.min(this.value[0], other.value[0]), Math.min(this.value[1], other.value[1])]);
		}
	}

	public max(other: PosIntervalDomain): PosIntervalDomain {
		if(this.value === Bottom || other.value === Bottom) {
			return this.bottom();
		} else {
			return new PosIntervalDomain([Math.max(this.value[0], other.value[0]), Math.max(this.value[1], other.value[1])]);
		}
	}

	public extendToZero(): PosIntervalDomain {
		if(this.value === Bottom) {
			return this.bottom();
		} else {
			return new PosIntervalDomain( [0, this.value[1]]);
		}
	}

	public extendToInfinity(): PosIntervalDomain {
		if(this.value === Bottom) {
			return this.bottom();
		} else {
			return new PosIntervalDomain([this.value[0], Infinity]);
		}
	}

	public toString(): string {
		if(this.value === Bottom) {
			return '⊥';
		}
		return `[${this.value[0]}, ${isFinite(this.value[1]) ? this.value[1] : '∞'}]`;
	}

	public isTop(): this is PosIntervalDomain<PosIntervalTop> {
		return this.value !== Bottom && this.value[0] === 0 && !isFinite(this.value[1]);
	}

	public isBottom(): this is PosIntervalDomain<PosIntervalBottom> {
		return this.value === Bottom;
	}

	public isValue(): this is PosIntervalDomain<PosIntervalValue> {
		return this.value !== Bottom;
	}
}
