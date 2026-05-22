import { assertUnreachable } from '../../util/assert';
import { Ternary } from '../../util/logic';
import { AbstractDomain } from './abstract-domain';
import { Bottom, BottomSymbol, Top } from './lattice';
import { type NumericDomain, NumericalComparator } from './value-abstract-domain';
/* eslint-disable @typescript-eslint/unified-signatures */

/** The Top element of the interval domain as interval [-∞, +∞] */
export const IntervalTop: IntervalValue = [-Infinity, +Infinity];

/** The type of the actual values of the interval domain as tuple of the lower and upper bound */
type IntervalValue = readonly [lower: number, upper: number];
/** The type of the Top element of the interval domain as interval [-∞, +∞] */
type IntervalTop = typeof IntervalTop;
/** The type of the Bottom element of the interval domain as {@link Bottom} symbol */
type IntervalBottom = typeof Bottom;
/** The type of the abstract values of the interval domain that are Top, Bottom, or actual values */
type IntervalLift = IntervalValue | IntervalBottom;

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

	public equals(other: this): boolean {
		return this.value === other.value || (this.isValue() && other.isValue() && this.value[0] === other.value[0] && this.value[1] === other.value[1]);
	}

	public leq(other: this): boolean {
		return this.value === Bottom || (other.isValue() && other.value[0] <= this.value[0] && this.value[1] <= other.value[1]);
	}

	public join(other: IntervalLift): this;
	public join(other: this): this;
	public join(other: this | IntervalLift): this {
		const otherValue = other instanceof IntervalDomain ? other.value : other;

		if(this.value === Bottom) {
			return this.create(otherValue);
		} else if(otherValue === Bottom) {
			return this.create(this.value);
		} else {
			return this.create([Math.min(this.value[0], otherValue[0]), Math.max(this.value[1], otherValue[1])]);
		}
	}

	public meet(other: IntervalLift): this;
	public meet(other: this): this;
	public meet(other: this | IntervalLift): this {
		const otherValue = other instanceof IntervalDomain ? other.value : other;

		if(this.value === Bottom || otherValue === Bottom) {
			return this.bottom();
		} else {
			return this.create([Math.max(this.value[0], otherValue[0]), Math.min(this.value[1], otherValue[1])]);
		}
	}

	public widen(other: this): this {
		if(this.value === Bottom) {
			return this.create(other.value);
		} else if(other.value === Bottom) {
			return this.create(this.value);
		} else {
			return this.create([
				this.value[0] <= other.value[0] ? this.value[0] : -Infinity,
				this.value[1] >= other.value[1] ? this.value[1] : +Infinity
			]);
		}
	}

	public narrow(other: this): this {
		if(this.value === Bottom || other.value === Bottom) {
			return this.bottom();
		} else if(Math.max(this.value[0], other.value[0]) > Math.min(this.value[1], other.value[1])) {
			return this.bottom();
		}
		return this.create([
			this.value[0] === -Infinity ? other.value[0] : this.value[0],
			this.value[1] === +Infinity ? other.value[1] : this.value[1]
		]);
	}

	public satisfies(value: number, comparator: NumericalComparator = NumericalComparator.Equal): Ternary {
		switch(comparator) {
			case NumericalComparator.Equal: {
				if(this.isValue() && this.value[0] <= value && value <= this.value[1]) {
					return this.value[0] === this.value[1] ? Ternary.Always : Ternary.Maybe;
				} else {
					return Ternary.Never;
				}
			}
			case NumericalComparator.Less: {
				if(this.isValue() && value < this.value[1]) {
					return value < this.value[0] ? Ternary.Always : Ternary.Maybe;
				} else {
					return Ternary.Never;
				}
			}
			case NumericalComparator.LessOrEqual: {
				if(this.isValue() && value <= this.value[1]) {
					return value <= this.value[0] ? Ternary.Always : Ternary.Maybe;
				} else {
					return Ternary.Never;
				}
			}
			case NumericalComparator.Greater: {
				if(this.isValue() && this.value[0] <= value) {
					return this.value[1] <= value ? Ternary.Always : Ternary.Maybe;
				} else {
					return Ternary.Never;
				}
			}
			case NumericalComparator.GreaterOrEqual: {
				if(this.isValue() && this.value[0] < value) {
					return this.value[1] < value ? Ternary.Always : Ternary.Maybe;
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
		if(this.value === Bottom) {
			return this.bottom();
		} else {
			return this.create([-this.value[1], -this.value[0]]);
		}
	}

	public add(other: this | IntervalLift): this {
		const otherValue = other instanceof IntervalDomain ? other.value : other;

		if(this.value === Bottom || otherValue === Bottom) {
			return this.bottom();
		} else {
			return this.create([this.value[0] + otherValue[0], this.value[1] + otherValue[1]]);
		}
	}

	public subtract(other: this | IntervalLift): this {
		const otherValue = other instanceof IntervalDomain ? other.value : other;

		if(this.value === Bottom || otherValue === Bottom) {
			return this.bottom();
		} else {
			return this.create([this.value[0] - otherValue[0], this.value[1] - otherValue[1]]);
		}
	}

	public multiply(other: this | IntervalLift): this {
		const otherValue = other instanceof IntervalDomain ? other.value : other;

		if(this.value === Bottom || otherValue === Bottom) {
			return this.bottom();
		} else {
			const products = [
				this.value[0] * otherValue[0],
				this.value[0] * otherValue[1],
				this.value[1] * otherValue[0],
				this.value[1] * otherValue[1]
			];
			return this.create([Math.min(...products), Math.max(...products)]);
		}
	}

	public divide(other: this | IntervalLift): this {
		const otherValue = other instanceof IntervalDomain ? other.value : other;

		if(this.value === Bottom || otherValue === Bottom) {
			return this.bottom();
		} else if(otherValue[0] <= 0 && 0 <= otherValue[1]) {
			return this.top();
		} else {
			return this.multiply(this.create([1 / otherValue[1], 1 / otherValue[0]]));
		}
	}

	public min(other: this | IntervalLift): this {
		const otherValue = other instanceof IntervalDomain ? other.value : other;

		if(this.value === Bottom || otherValue === Bottom) {
			return this.bottom();
		} else {
			return this.create([Math.min(this.value[0], otherValue[0]), Math.min(this.value[1], otherValue[1])]);
		}
	}

	public max(other: this | IntervalLift): this {
		const otherValue = other instanceof IntervalDomain ? other.value : other;

		if(this.value === Bottom || otherValue === Bottom) {
			return this.bottom();
		} else {
			return this.create([Math.max(this.value[0], otherValue[0]), Math.max(this.value[1], otherValue[1])]);
		}
	}

	/**
	 * Extends the lower bound of the current abstract value down to -∞.
	 */
	public widenDown(): this {
		if(this.value === Bottom) {
			return this.bottom();
		} else {
			return this.create([-Infinity, this.value[1]]);
		}
	}

	/**
	 * Extends the upper bound of the current abstract value up to +∞.
	 */
	public widenUp(): this {
		if(this.value === Bottom) {
			return this.bottom();
		} else {
			return this.create([this.value[0], +Infinity]);
		}
	}

	public toJson(): unknown {
		if(this.value === Bottom) {
			return Bottom.description;
		}
		return this.value;
	}

	public toString(): string {
		if(this.value === Bottom) {
			return BottomSymbol;
		}
		return `[${Number.isFinite(this.value[0]) ? this.value[0] : '-∞'}, ${Number.isFinite(this.value[1]) ? this.value[1] : '+∞'}]`;
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

	public isFinite(): this is IntervalDomain<IntervalValue> {
		return this.isValue() && Number.isFinite(this.value[0]) && Number.isFinite(this.value[1]);
	}
}
