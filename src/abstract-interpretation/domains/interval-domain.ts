import { DEFAULT_INFERENCE_LIMIT, type AbstractDomain } from './abstract-domain';
import { Bottom, Top } from './lattice';

/** The type of the actual values of the interval domain as tuple of the lower and upper bound */
export type IntervalValue = readonly [number, number];
/** The type of the Top element of the interval domain as interval [-∞, +∞] from -∞ to +∞ */
export type IntervalTop = readonly [typeof Infinity, typeof Infinity];
/** The type of the Bottom element of the interval domain as {@link Bottom} symbol */
export type IntervalBottom = typeof Bottom;
/** The type of the abstract values of the interval domain that are Top, Bottom, or actual values */
export type IntervalLift = IntervalValue | IntervalTop | IntervalBottom;

/**
 * The interval abstract domain as intervals with possibly infinite bounds representing possible numeric values.
 * The Bottom element is defined as {@link Bottom} symbol and the Top element is defined as the interval [-∞, +∞].
 * @template Value - Type of the constraint in the abstract domain (Top, Bottom, or an actual value)
 */
export class IntervalDomain<Value extends IntervalLift = IntervalLift>
implements AbstractDomain<number, IntervalValue, IntervalTop, IntervalBottom, Value> {
	private _value: Value;

	constructor(value: Value) {
		if(Array.isArray(value)) {
			if(value.some(isNaN) || value[0] > value[1] || value[0] === +Infinity || value[1] === -Infinity) {
				this._value = Bottom as Value;
			} else {
				this._value = [value[0], value[1]] as IntervalValue as Value;
			}
		} else {
			this._value = value;
		}
	}

	public get value(): Value {
		return this._value;
	}

	public static top(): IntervalDomain<IntervalTop> {
		return new IntervalDomain([-Infinity, +Infinity]);
	}

	public static bottom(): IntervalDomain<IntervalBottom> {
		return new IntervalDomain(Bottom);
	}

	public static abstract(concrete: ReadonlySet<number> | typeof Top): IntervalDomain {
		if(concrete === Top) {
			return IntervalDomain.top();
		} else if(concrete.size === 0 || concrete.values().some(isNaN)) {
			return IntervalDomain.bottom();
		}
		return new IntervalDomain([Math.min(...concrete), Math.max(...concrete)]);
	}

	public top(): IntervalDomain<IntervalTop> {
		return IntervalDomain.top();
	}

	public bottom(): IntervalDomain<IntervalBottom> {
		return IntervalDomain.bottom();
	}

	public equals(other: IntervalDomain): boolean {
		return this.value === other.value || (this.isValue() && other.isValue() && this.value[0] === other.value[0] && this.value[1] === other.value[1]);
	}

	public leq(other: IntervalDomain): boolean {
		return this.value === Bottom || (other.isValue() && other.value[0] <= this.value[0] && this.value[1] <= other.value[1]);
	}

	public join(...values: IntervalDomain[]): IntervalDomain {
		const result = new IntervalDomain<IntervalLift>(this.value);

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

	public meet(...values: IntervalDomain[]): IntervalDomain {
		const result = new IntervalDomain<IntervalLift>(this.value);

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

	public widen(other: IntervalDomain): IntervalDomain {
		if(this.value === Bottom) {
			return new IntervalDomain(other.value);
		} else if(other.value === Bottom) {
			return new IntervalDomain(this.value);
		} else {
			return new IntervalDomain([
				this.value[0] <= other.value[0] ? this.value[0] : -Infinity,
				this.value[1] >= other.value[1] ? this.value[1] : +Infinity
			]);
		}
	}

	public narrow(other: IntervalDomain): IntervalDomain {
		if(this.value === Bottom || other.value === Bottom) {
			return this.bottom();
		}
		return new IntervalDomain([
			this.value[0] === -Infinity ? other.value[0] : this.value[0],
			this.value[1] === +Infinity ? other.value[1] : this.value[1]
		]);
	}

	public concretize(limit: number = DEFAULT_INFERENCE_LIMIT): ReadonlySet<number> | typeof Top {
		if(this.value === Bottom) {
			return new Set();
		} else if(!isFinite(this.value[0]) || !isFinite(this.value[1]) || this.value[1] - this.value[0] + 1 > limit) {
			return Top;
		}
		const set = new Set<number>();

		for(let x = this.value[0]; x <= this.value[1]; x++) {
			set.add(x);
		}
		return set;
	}

	public abstract(concrete: ReadonlySet<number> | typeof Top): IntervalDomain {
		return IntervalDomain.abstract(concrete);
	}

	/**
	 * Adds another abstract value to the current abstract value by adding the two lower and upper bounds, respectively.
	 */
	public add(other: IntervalDomain): IntervalDomain {
		if(this.value === Bottom || other.value === Bottom) {
			return this.bottom();
		} else {
			return new IntervalDomain([this.value[0] + other.value[0], this.value[1] + other.value[1]]);
		}
	}

	/**
	 * Subtracts another abstract value from the current abstract value by subtracting the two lower and upper bounds from each other, respectively.
	 */
	public subtract(other: IntervalDomain): IntervalDomain {
		if(this.value === Bottom || other.value === Bottom) {
			return this.bottom();
		} else {
			return new IntervalDomain([this.value[0] - other.value[0], this.value[1] - other.value[1]]);
		}
	}

	/**
	 * Creates the minimum between the current abstract value and another abstract value by creating the minimum of the two lower and upper bounds, respectively.
	 */
	public min(other: IntervalDomain): IntervalDomain {
		if(this.value === Bottom || other.value === Bottom) {
			return this.bottom();
		} else {
			return new IntervalDomain([Math.min(this.value[0], other.value[0]), Math.min(this.value[1], other.value[1])]);
		}
	}

	/**
	 * Creates the maximum between the current abstract value and another abstract value by creating the maximum of the two lower and upper bounds, respectively.
	 */
	public max(other: IntervalDomain): IntervalDomain {
		if(this.value === Bottom || other.value === Bottom) {
			return this.bottom();
		} else {
			return new IntervalDomain([Math.max(this.value[0], other.value[0]), Math.max(this.value[1], other.value[1])]);
		}
	}

	/**
	 * Extends the lower bound of the current abstract value down to -∞.
	 */
	public extendDown(): IntervalDomain {
		if(this.value === Bottom) {
			return this.bottom();
		} else {
			return new IntervalDomain([-Infinity, this.value[1]]);
		}
	}

	/**
	 * Extends the upper bound of the current abstract value up to +∞.
	 */
	public extendUp(): IntervalDomain {
		if(this.value === Bottom) {
			return this.bottom();
		} else {
			return new IntervalDomain([this.value[0], +Infinity]);
		}
	}

	public toString(): string {
		if(this.value === Bottom) {
			return '⊥';
		}
		return `[${isFinite(this.value[0]) ? this.value[0] : '-∞'}, ${isFinite(this.value[1]) ? this.value[1] : '+∞'}]`;
	}

	public isTop(): this is IntervalDomain<IntervalTop> {
		return this.value !== Bottom && this.value[0] === -Infinity && this.value[1] === +Infinity;
	}

	public isBottom(): this is IntervalDomain<IntervalBottom> {
		return this.value === Bottom;
	}

	public isValue(): this is IntervalDomain<IntervalValue> {
		return this.value !== Bottom;
	}
}
