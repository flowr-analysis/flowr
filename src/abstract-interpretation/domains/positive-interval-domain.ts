import { AbstractDomain } from './abstract-domain';
import { IntervalDomain } from './interval-domain';
import { Bottom } from './lattice';

/** The Top element of the positive interval domain as interval [0, +∞] */
export const PosIntervalTop: PosIntervalValue = [0, +Infinity];

/** The type of the actual values of the positive interval domain as tuple of the lower and upper bound */
export type PosIntervalValue = readonly [lower: number, upper: number];
/** The type of the Top element of the positive interval domain as interval [0, +∞] */
export type PosIntervalTop = typeof PosIntervalTop;
/** The type of the Bottom element of the positive interval domain as {@link Bottom} symbol */
export type PosIntervalBottom = typeof Bottom;
/** The type of the abstract values of the positive interval domain that are Top, Bottom, or actual values */
export type PosIntervalLift = PosIntervalValue | PosIntervalBottom;

/**
 * The positive interval abstract domain as positive intervals with possibly zero lower bounds and infinite upper bounds representing possible numeric values.
 * The Bottom element is defined as {@link Bottom} symbol and the Top element is defined as the interval [0, +∞].
 * @template Value - Type of the constraint in the abstract domain (Top, Bottom, or an actual value)
 */
export class PosIntervalDomain<Value extends PosIntervalLift = PosIntervalLift>
	extends IntervalDomain<Value> {

	constructor(value: Value) {
		if(Array.isArray(value) && value[0] < 0) {
			super(Bottom as Value);
		} else {
			super(value);
		}
	}

	public create(value: PosIntervalLift): this {
		return new PosIntervalDomain(value) as this;
	}

	public static top(): PosIntervalDomain<PosIntervalTop> {
		return new this(PosIntervalTop);
	}

	public static bottom(): PosIntervalDomain<PosIntervalBottom> {
		return new this(Bottom);
	}

	public top(): this & PosIntervalDomain<PosIntervalTop> {
		return this.create(PosIntervalTop) as this & PosIntervalDomain<PosIntervalTop>;
	}

	protected widenValue(this: this & PosIntervalDomain<PosIntervalValue>, other: PosIntervalDomain<PosIntervalValue>): this {
		return this.create([
			this.lower <= other.lower ? this.lower : 0,
			this.upper >= other.upper ? this.upper : +Infinity
		]);
	}

	protected narrowValue(this: this & PosIntervalDomain<PosIntervalValue>, other: PosIntervalDomain<PosIntervalValue>): this {
		if(Math.max(this.lower, other.lower) > Math.min(this.upper, other.upper)) {
			return this.bottom();
		}
		return this.create([
			this.lower === 0 ? other.lower : this.lower,
			this.upper === +Infinity ? other.upper : this.upper
		]);
	}

	public subtract(other: this | PosIntervalLift): this {
		const otherValue = other instanceof AbstractDomain ? other.value : other;

		if(this.isValue() && otherValue !== Bottom) {
			return this.create([Math.max(this.lower - otherValue[0], 0), Math.max(this.upper - otherValue[1], 0)]);
		}
		return this.bottom();
	}

	/**
	 * Extends the lower bound of the current abstract value down to 0.
	 */
	public widenDown(): this {
		if(this.isValue()) {
			return this.create([0, this.upper]);
		}
		return this.bottom();
	}

	public isTop(): this is this & PosIntervalDomain<PosIntervalTop> {
		return this.value !== Bottom && this.lower === 0 && this.upper === +Infinity;
	}
}
