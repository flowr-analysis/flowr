import { assertUnreachable } from '../../util/assert';
import { Ternary } from '../../util/logic';
import { AbstractDomain } from './abstract-domain';
import { Bottom } from './lattice';
import { type NumericDomain, NumericalComparator } from './value-abstract-domain';

/** The Top element of the interval domain as interval [-∞, +∞] */
export const IntervalTop: IntervalValue = [-Infinity, +Infinity];

/** The type of the actual values of the interval domain as tuple of the lower and upper bound */
export type IntervalValue = readonly [lower: number, upper: number];
/** The type of the Top element of the interval domain as interval [-∞, +∞] */
export type IntervalTop = typeof IntervalTop;
/** The type of the Bottom element of the interval domain as {@link Bottom} symbol */
export type IntervalBottom = typeof Bottom;
/** The type of the abstract values of the interval domain that are Top, Bottom, or actual values */
export type IntervalLift = IntervalValue | IntervalBottom;

type IntervalBound<Value extends IntervalLift> = Value extends IntervalValue ? number : number | typeof Bottom;

/**
 * The interval abstract domain as intervals with possibly infinite bounds representing possible numeric values.
 * The Bottom element is defined as {@link Bottom} symbol and the Top element is defined as the interval [-∞, +∞].
 * @template Value - Type of the constraint in the abstract domain (Top, Bottom, or an actual value)
 */
export class IntervalDomain<Value extends IntervalLift = IntervalLift>
	extends AbstractDomain<IntervalValue, IntervalTop, IntervalBottom, Value>
	implements NumericDomain {

	constructor(value: Value) {
		if(Array.isArray(value)) {
			if(value.some(Number.isNaN) || value[0] > value[1] || value[0] === +Infinity || value[1] === -Infinity) {
				super(Bottom as Value);
			} else {
				super([value[0], value[1]] as const as Value);
			}
		} else {
			super(value);
		}
	}

	public create(value: IntervalLift): this {
		return new IntervalDomain(value) as this;
	}

	public get lower(): IntervalBound<Value> {
		return (this.isValue() ? this.value[0] : Bottom) as IntervalBound<Value>;
	}

	public get upper(): IntervalBound<Value> {
		return (this.isValue() ? this.value[1] : Bottom) as IntervalBound<Value>;
	}

	public from(...values: number[]): this {
		if(values.length === 0) {
			return this.bottom();
		}
		return this.create([Math.min(...values), Math.max(...values)]);
	}

	public static top(): IntervalDomain<IntervalTop> {
		return new this(IntervalTop);
	}

	public static bottom(): IntervalDomain<IntervalBottom> {
		return new this(Bottom);
	}

	public static from(...values: number[]): IntervalDomain {
		if(values.length === 0) {
			return this.bottom();
		}
		return new this([Math.min(...values), Math.max(...values)]);
	}

	public top(): this & IntervalDomain<IntervalTop> {
		return this.create(IntervalTop) as this & IntervalDomain<IntervalTop>;
	}

	public bottom(): this & IntervalDomain<IntervalBottom> {
		return this.create(Bottom) as this & IntervalDomain<IntervalBottom>;
	}

	protected equalsValue(this: IntervalDomain<IntervalValue>, other: IntervalDomain<IntervalValue>): boolean {
		return this.lower === other.lower && this.upper === other.upper;
	}

	protected leqValue(this: IntervalDomain<IntervalValue>, other: IntervalDomain<IntervalValue>): boolean {
		return other.lower <= this.lower && this.upper <= other.upper;
	}

	protected joinValue(this: this & IntervalDomain<IntervalValue>, other: IntervalDomain<IntervalValue>): this {
		return this.create([Math.min(this.lower, other.lower), Math.max(this.upper, other.upper)]);
	}

	protected meetValue(this: this & IntervalDomain<IntervalValue>, other: IntervalDomain<IntervalValue>): this {
		return this.create([Math.max(this.lower, other.lower), Math.min(this.upper, other.upper)]);
	}

	protected widenValue(this: this & IntervalDomain<IntervalValue>, other: IntervalDomain<IntervalValue>): this {
		return this.create([
			this.lower <= other.lower ? this.lower : -Infinity,
			this.upper >= other.upper ? this.upper : +Infinity
		]);
	}

	protected narrowValue(this: this & IntervalDomain<IntervalValue>, other: IntervalDomain<IntervalValue>): this {
		if(Math.max(this.lower, other.lower) > Math.min(this.upper, other.upper)) {
			return this.bottom();
		}
		return this.create([
			this.lower === -Infinity ? other.lower : this.lower,
			this.upper === +Infinity ? other.upper : this.upper
		]);
	}

	public satisfies(value: number, comparator: NumericalComparator = NumericalComparator.Equal): Ternary {
		switch(comparator) {
			case NumericalComparator.Equal: {
				if(this.isValue() && this.lower <= value && value <= this.upper) {
					return this.lower === this.upper ? Ternary.Always : Ternary.Maybe;
				} else {
					return Ternary.Never;
				}
			}
			case NumericalComparator.Less: {
				if(this.isValue() && value < this.upper) {
					return value < this.lower ? Ternary.Always : Ternary.Maybe;
				} else {
					return Ternary.Never;
				}
			}
			case NumericalComparator.LessOrEqual: {
				if(this.isValue() && value <= this.upper) {
					return value <= this.lower ? Ternary.Always : Ternary.Maybe;
				} else {
					return Ternary.Never;
				}
			}
			case NumericalComparator.Greater: {
				if(this.isValue() && this.lower <= value) {
					return this.upper <= value ? Ternary.Always : Ternary.Maybe;
				} else {
					return Ternary.Never;
				}
			}
			case NumericalComparator.GreaterOrEqual: {
				if(this.isValue() && this.lower < value) {
					return this.upper < value ? Ternary.Always : Ternary.Maybe;
				} else {
					return Ternary.Never;
				}
			}
			default: {
				assertUnreachable(comparator);
			}
		}
	}

	public negate(): this {
		if(this.isValue()) {
			return this.create([-this.value[1], -this.value[0]]);
		}
		return this.bottom();
	}

	public add(other: this | IntervalLift): this {
		const otherValue = other instanceof AbstractDomain ? other.value : other;

		if(this.isValue() && otherValue !== Bottom) {
			return this.create([this.lower + otherValue[0], this.upper + otherValue[1]]);
		}
		return this.bottom();
	}

	public subtract(other: this | IntervalLift): this {
		const otherValue = other instanceof AbstractDomain ? other.value : other;

		if(this.isValue() && otherValue !== Bottom) {
			return this.create([this.lower - otherValue[0], this.upper - otherValue[1]]);
		}
		return this.bottom();
	}

	public multiply(other: this | IntervalLift): this {
		const otherValue = other instanceof AbstractDomain ? other.value : other;

		if(this.isValue() && otherValue !== Bottom) {
			const products = [
				this.value[0] * otherValue[0],
				this.value[0] * otherValue[1],
				this.value[1] * otherValue[0],
				this.value[1] * otherValue[1]
			];
			return this.create([Math.min(...products), Math.max(...products)]);
		}
		return this.bottom();
	}

	public divide(other: this | IntervalLift): this {
		const otherValue = other instanceof AbstractDomain ? other.value : other;

		if(this.isValue() && otherValue !== Bottom) {
			if(otherValue[0] <= 0 && 0 <= otherValue[1]) {
				return this.top();
			}
			return this.multiply(this.create([1 / otherValue[1], 1 / otherValue[0]]));
		}
		return this.bottom();
	}

	public min(other: this | IntervalLift): this {
		const otherValue = other instanceof AbstractDomain ? other.value : other;

		if(this.isValue() && otherValue !== Bottom) {
			return this.create([Math.min(this.lower, otherValue[0]), Math.min(this.upper, otherValue[1])]);
		}
		return this.bottom();
	}

	public max(other: this | IntervalLift): this {
		const otherValue = other instanceof AbstractDomain ? other.value : other;

		if(this.isValue() && otherValue !== Bottom) {
			return this.create([Math.max(this.lower, otherValue[0]), Math.max(this.upper, otherValue[1])]);
		}
		return this.bottom();
	}

	/**
	 * Extends the lower bound of the current abstract value down to -∞.
	 */
	public widenDown(): this {
		if(this.isValue()) {
			return this.create([-Infinity, this.upper]);
		}
		return this.bottom();
	}

	/**
	 * Extends the upper bound of the current abstract value up to +∞.
	 */
	public widenUp(): this {
		if(this.isValue()) {
			return this.create([this.lower, +Infinity]);
		}
		return this.bottom();
	}

	protected jsonify(): unknown {
		return this.value;
	}

	protected stringify(this: IntervalDomain<IntervalValue>): string {
		return `[${Number.isFinite(this.lower) ? this.lower : '-∞'}, ${Number.isFinite(this.upper) ? this.upper : '+∞'}]`;
	}

	public isTop(): this is this & IntervalDomain<IntervalTop> {
		return this.value !== Bottom && this.lower === -Infinity && this.upper === +Infinity;
	}

	public isBottom(): this is this & IntervalDomain<IntervalBottom> {
		return this.value === Bottom;
	}

	public isValue(): this is this & IntervalDomain<IntervalValue> {
		return this.value !== Bottom;
	}

	public isFinite(): this is this & IntervalDomain<IntervalValue> {
		return this.isValue() && Number.isFinite(this.lower) && Number.isFinite(this.upper);
	}
}
