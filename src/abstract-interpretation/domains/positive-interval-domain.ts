import { IntervalDomain } from './interval-domain';
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
export class PosIntervalDomain<Value extends PosIntervalLift = PosIntervalLift> extends IntervalDomain<Value> {
	constructor(value: Value) {
		if(Array.isArray(value) && value[0] < 0) {
			super(Bottom as Value);
		} else {
			super(value);
		}
	}

	public create(value: PosIntervalLift): PosIntervalDomain {
		return new PosIntervalDomain(value);
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
		return this.create(result);
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
		return this.create(result);
	}

	public widen(other: PosIntervalDomain): PosIntervalDomain {
		if(this.value === Bottom) {
			return this.create(other.value);
		} else if(other.value === Bottom) {
			return this.create(this.value);
		} else {
			return this.create([
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
		return this.create([
			this.value[0] === 0 ? other.value[0] : this.value[0],
			this.value[1] === +Infinity ? other.value[1] : this.value[1]
		]);
	}

	public abstract(concrete: ReadonlySet<number> | typeof Top): PosIntervalDomain {
		return PosIntervalDomain.abstract(concrete);
	}

	public add(other: PosIntervalDomain | PosIntervalLift): PosIntervalDomain {
		const otherValue = other instanceof PosIntervalDomain ? other.value : other;

		if(this.value === Bottom || otherValue === Bottom) {
			return this.bottom();
		} else {
			return this.create([this.value[0] + otherValue[0], this.value[1] + otherValue[1]]);
		}
	}

	public subtract(other: PosIntervalDomain | PosIntervalLift): PosIntervalDomain {
		const otherValue = other instanceof PosIntervalDomain ? other.value : other;

		if(this.value === Bottom || otherValue === Bottom) {
			return this.bottom();
		} else {
			return this.create([Math.max(this.value[0] - otherValue[0], 0), Math.max(this.value[1] - otherValue[1], 0)]);
		}
	}

	public min(other: PosIntervalDomain | PosIntervalLift): PosIntervalDomain {
		const otherValue = other instanceof PosIntervalDomain ? other.value : other;

		if(this.value === Bottom || otherValue === Bottom) {
			return this.bottom();
		} else {
			return this.create([Math.min(this.value[0], otherValue[0]), Math.min(this.value[1], otherValue[1])]);
		}
	}

	public max(other: PosIntervalDomain | PosIntervalLift): PosIntervalDomain {
		const otherValue = other instanceof PosIntervalDomain ? other.value : other;

		if(this.value === Bottom || otherValue === Bottom) {
			return this.bottom();
		} else {
			return this.create([Math.max(this.value[0], otherValue[0]), Math.max(this.value[1], otherValue[1])]);
		}
	}

	/**
	 * Extends the lower bound of the current abstract value down to 0.
	 */
	public extendDown(): PosIntervalDomain {
		if(this.value === Bottom) {
			return this.bottom();
		} else {
			return this.create([0, this.value[1]]);
		}
	}

	public extendUp(): PosIntervalDomain {
		if(this.value === Bottom) {
			return this.bottom();
		} else {
			return this.create([this.value[0], +Infinity]);
		}
	}

	public isTop(): this is PosIntervalDomain<PosIntervalTop> {
		return this.value !== Bottom && this.value[0] === 0 && this.value[1] === +Infinity;
	}
}
