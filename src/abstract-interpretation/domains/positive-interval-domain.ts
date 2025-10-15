import { IntervalDomain } from './interval-domain';
import { Bottom, Top } from './lattice';

/** The type of the actual values of the positive interval domain as tuple of the lower and upper bound */
export type PosIntervalValue = readonly [number, number];
/** The type of the Top element of the positive interval domain as interval [0, +∞] from 0 to +∞ */
export type PosIntervalTop = readonly [0, typeof Infinity];
/** The type of the Bottom element of the positive interval domain as {@link Bottom} symbol */
export type PosIntervalBottom = typeof Bottom;
/** The type of the abstract values of the positive interval domain that are Top, Bottom, or actual values */
export type PosIntervalLift = PosIntervalValue | PosIntervalTop | PosIntervalBottom;

/**
 * The positive interval abstract domain as positive intervals with possibly zero lower bounds and infinite upper bounds representing possible numeric values.
 * The Bottom element is defined as {@link Bottom} symbol and the Top element is defined as the interval [0, +∞].
 * @template Value - Type of the constraint in the abstract domain (Top, Bottom, or an actual value)
 */
export class PosIntervalDomain<Value extends PosIntervalLift = PosIntervalLift> extends IntervalDomain<Value> {
	constructor(value: Value) {
		if(Array.isArray(value) && value[0] < 0) {
			super(Bottom as Value);
		} else {
			super(value);
		}
	}

	public static top(): PosIntervalDomain<PosIntervalTop> {
		return new PosIntervalDomain([0, +Infinity]);
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
			return PosIntervalDomain.bottom();
		}
		return new PosIntervalDomain([
			this.value[0] === 0 ? other.value[0] : this.value[0],
			this.value[1] === +Infinity ? other.value[1] : this.value[1]
		]);
	}

	public abstract(concrete: ReadonlySet<number> | typeof Top): PosIntervalDomain {
		return PosIntervalDomain.abstract(concrete);
	}

	public subtract(other: PosIntervalDomain): PosIntervalDomain {
		if(this.value === Bottom || other.value === Bottom) {
			return this.bottom();
		} else {
			return new PosIntervalDomain([Math.max(this.value[0] - other.value[0], 0), Math.max(this.value[1] - other.value[1], 0)]);
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

	public isTop(): this is PosIntervalDomain<PosIntervalTop> {
		return this.value !== Bottom && this.value[0] === 0 && this.value[1] !== +Infinity;
	}
}
