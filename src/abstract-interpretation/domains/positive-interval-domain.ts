import { Ternary } from '../../util/logic';
import type { AbstractDomain, SatifiableDomain } from './abstract-domain';
import { DEFAULT_INFERENCE_LIMIT } from './abstract-domain';
import { Bottom, Top } from './lattice';

/** The Top element of the positive interval domain as interval [0, +∞] */
export const PosIntervalTop = [0, +Infinity] as const satisfies readonly [number, number];

/** The type of the actual values of the positive interval domain as tuple of the lower and upper bound */
type PosIntervalValue = readonly [number, number];
/** The type of the Top element of the positive interval domain as interval [0, +∞] */
type PosIntervalTop = typeof PosIntervalTop;
/** The type of the Bottom element of the positive interval domain as {@link Bottom} symbol */
type PosIntervalBottom = typeof Bottom;
/** The type of the abstract values of the positive interval domain that are Top, Bottom, or actual values */
type PosIntervalLift = PosIntervalValue | PosIntervalTop | PosIntervalBottom;

/**
 * The positive interval abstract domain as positive intervals with possibly zero lower bounds and infinite upper bounds representing possible numeric values.
 * The Bottom element is defined as {@link Bottom} symbol and the Top element is defined as the interval [0, +∞].
 * @template Value - Type of the constraint in the abstract domain (Top, Bottom, or an actual value)
 */
export class PosIntervalDomain<Value extends PosIntervalLift = PosIntervalLift>
implements AbstractDomain<PosIntervalDomain, number, PosIntervalValue, PosIntervalTop, PosIntervalBottom, Value>, SatifiableDomain<number> {
	private readonly _value: Value;

	constructor(value: Value) {
		if(Array.isArray(value)) {
			if(value.some(isNaN) || value[0] > value[1] || value[0] < 0 || value[0] === Infinity) {
				this._value = Bottom as Value;
			} else {
				this._value = [value[0], value[1]] as PosIntervalValue as Value;
			}
		} else {
			this._value = value;
		}
	}

	public get value(): Value {
		return this._value;
	}

	public static top(): PosIntervalDomain<PosIntervalTop> {
		return new PosIntervalDomain(PosIntervalTop);
	}

	public static bottom(): PosIntervalDomain<PosIntervalBottom> {
		return new PosIntervalDomain(Bottom);
	}

	public static abstract(concrete: ReadonlySet<number> | typeof Top): PosIntervalDomain {
		if(concrete === Top) {
			return PosIntervalDomain.top();
		} else if(concrete.size === 0 || concrete.values().some(value => isNaN(value) || value < 0)) {
			return PosIntervalDomain.bottom();
		}
		return new PosIntervalDomain([Math.min(...concrete), Math.max(...concrete)]);
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

	public join(...values: PosIntervalDomain[]): PosIntervalDomain;
	public join(...values: PosIntervalLift[]): PosIntervalDomain;
	public join(...values: PosIntervalDomain[] | PosIntervalLift[]): PosIntervalDomain {
		let result: PosIntervalLift = this.value;

		for(const other of values) {
			const otherValue = other instanceof PosIntervalDomain ? other.value : other;

			if(result === Bottom) {
				result = otherValue;
			} else if(otherValue === Bottom) {
				continue;
			} else {
				result = [Math.min(result[0], otherValue[0]), Math.max(result[1], otherValue[1])];
			}
		}
		return new PosIntervalDomain(result);
	}

	public meet(...values: PosIntervalDomain[]): PosIntervalDomain;
	public meet(...values: PosIntervalLift[]): PosIntervalDomain;
	public meet(...values: PosIntervalDomain[] | PosIntervalLift[]): PosIntervalDomain {
		let result: PosIntervalLift = this.value;

		for(const other of values) {
			const otherValue = other instanceof PosIntervalDomain ? other.value : other;

			if(result === Bottom || otherValue === Bottom) {
				result = Bottom;
			} else if(Math.max(result[0], otherValue[0]) > Math.min(result[1], otherValue[1])) {
				result = Bottom;
			} else {
				result = [Math.max(result[0], otherValue[0]), Math.min(result[1], otherValue[1])];
			}
		}
		return new PosIntervalDomain(result);
	}

	public widen(other: PosIntervalDomain): PosIntervalDomain {
		if(this.value === Bottom) {
			return new PosIntervalDomain(other.value);
		} else if(other.value === Bottom) {
			return new PosIntervalDomain(this.value);
		} else {
			return new PosIntervalDomain([
				this.value[0] <= other.value[0] ? this.value[0] : 0,
				this.value[1] >= other.value[1] ? this.value[1] : +Infinity
			]);
		}
	}

	public narrow(other: PosIntervalDomain): PosIntervalDomain {
		if(this.value === Bottom || other.value === Bottom) {
			return this.bottom();
		} else if(Math.max(this.value[0], other.value[0]) > Math.min(this.value[1], other.value[1])) {
			return this.bottom();
		}
		return new PosIntervalDomain([
			this.value[0] === 0 ? other.value[0] : this.value[0],
			this.value[1] === +Infinity ? other.value[1] : this.value[1]
		]);
	}

	public concretize(limit: number = DEFAULT_INFERENCE_LIMIT): ReadonlySet<number> | typeof Top {
		if(this.value === Bottom) {
			return new Set();
		} else if(!isFinite(this.value[1]) || this.value[1] - this.value[0] + 1 > limit) {
			return Top;
		}
		const set = new Set<number>();

		for(let x = this.value[0]; x <= this.value[1]; x++) {
			set.add(x);
		}
		return set;
	}

	public abstract(concrete: ReadonlySet<number> | typeof Top): PosIntervalDomain {
		return PosIntervalDomain.abstract(concrete);
	}

	public satisfies(value: number): Ternary {
		if(this.isValue() && this.value[0] <= value && value <= this.value[1]) {
			return this.value[0] === this.value[1] ? Ternary.Always : Ternary.Maybe;
		}
		return Ternary.Never;
	}

	public satisfiesLeq(value: number): Ternary {
		if(this.isValue() && 0 <= value && value <= this.value[1]) {
			return value <= this.value[0] ? Ternary.Always : Ternary.Maybe;
		}
		return Ternary.Never;
	}

	/**
	 * Adds another abstract value to the current abstract value by adding the two lower and upper bounds, respectively.
	 */
	public add(other: PosIntervalDomain | PosIntervalLift): PosIntervalDomain {
		const otherValue = other instanceof PosIntervalDomain ? other.value : other;

		if(this.value === Bottom || otherValue === Bottom) {
			return this.bottom();
		} else {
			return new PosIntervalDomain([this.value[0] + otherValue[0], this.value[1] + otherValue[1]]);
		}
	}

	/**
	 * Subtracts another abstract value from the current abstract value by subtracting the two lower and upper bounds from each other, respectively.
	 */
	public subtract(other: PosIntervalDomain | PosIntervalLift): PosIntervalDomain {
		const otherValue = other instanceof PosIntervalDomain ? other.value : other;

		if(this.value === Bottom || otherValue === Bottom) {
			return this.bottom();
		} else {
			return new PosIntervalDomain([Math.max(this.value[0] - otherValue[0], 0), Math.max(this.value[1] - otherValue[1], 0)]);
		}
	}

	/**
	 * Creates the minimum between the current abstract value and another abstract value by creating the minimum of the two lower and upper bounds, respectively.
	 */
	public min(other: PosIntervalDomain | PosIntervalLift): PosIntervalDomain {
		const otherValue = other instanceof PosIntervalDomain ? other.value : other;

		if(this.value === Bottom || otherValue === Bottom) {
			return this.bottom();
		} else {
			return new PosIntervalDomain([Math.min(this.value[0], otherValue[0]), Math.min(this.value[1], otherValue[1])]);
		}
	}

	/**
	 * Creates the maximum between the current abstract value and another abstract value by creating the maximum of the two lower and upper bounds, respectively.
	 */
	public max(other: PosIntervalDomain | PosIntervalLift): PosIntervalDomain {
		const otherValue = other instanceof PosIntervalDomain ? other.value : other;

		if(this.value === Bottom || otherValue === Bottom) {
			return this.bottom();
		} else {
			return new PosIntervalDomain([Math.max(this.value[0], otherValue[0]), Math.max(this.value[1], otherValue[1])]);
		}
	}

	/**
	 * Extends the lower bound of the current abstract value down to 0.
	 */
	public extendDown(): PosIntervalDomain {
		if(this.value === Bottom) {
			return this.bottom();
		} else {
			return new PosIntervalDomain([0, this.value[1]]);
		}
	}

	/**
	 * Extends the upper bound of the current abstract value up to +∞.
	 */
	public extendUp(): PosIntervalDomain {
		if(this.value === Bottom) {
			return this.bottom();
		} else {
			return new PosIntervalDomain([this.value[0], +Infinity]);
		}
	}

	public toString(): string {
		if(this.value === Bottom) {
			return '⊥';
		}
		return `[${this.value[0]}, ${isFinite(this.value[1]) ? this.value[1] : '+∞'}]`;
	}

	public isTop(): this is PosIntervalDomain<PosIntervalTop> {
		return this.value !== Bottom && this.value[0] === 0 && this.value[1] === +Infinity;
	}

	public isBottom(): this is PosIntervalDomain<PosIntervalBottom> {
		return this.value === Bottom;
	}

	public isValue(): this is PosIntervalDomain<PosIntervalValue> {
		return this.value !== Bottom;
	}
}
