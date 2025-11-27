import { assertUnreachable } from '../../util/assert';
import { Ternary } from '../../util/logic';
import { AbstractDomain } from './abstract-domain';
import { Bottom, BottomSymbol, Top } from './lattice';
import { type SatisfiableDomain, NumericalComparator } from './satisfiable-domain';
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
	extends AbstractDomain<number, IntervalValue, IntervalTop, IntervalBottom, Value>
	implements SatisfiableDomain<number> {

	constructor(value: Value) {
		if(Array.isArray(value)) {
			if(value.some(isNaN) || value[0] > value[1] || value[0] === +Infinity || value[1] === -Infinity) {
				super(Bottom as Value);
			} else {
				super([value[0], value[1]] as const as Value);
			}
		} else {
			super(value);
		}
	}

	public create(value: IntervalLift): this;
	public create(value: IntervalLift): IntervalDomain {
		return new IntervalDomain(value);
	}

	public static top(): IntervalDomain<IntervalTop> {
		return new IntervalDomain(IntervalTop);
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

	public top(): this & IntervalDomain<IntervalTop>;
	public top(): IntervalDomain<IntervalTop> {
		return IntervalDomain.top();
	}

	public bottom(): this & IntervalDomain<IntervalBottom>;
	public bottom(): IntervalDomain<IntervalBottom> {
		return IntervalDomain.bottom();
	}

	public equals(other: this): boolean {
		return this.value === other.value || (this.isValue() && other.isValue() && this.value[0] === other.value[0] && this.value[1] === other.value[1]);
	}

	public leq(other: this): boolean {
		return this.value === Bottom || (other.isValue() && other.value[0] <= this.value[0] && this.value[1] <= other.value[1]);
	}

	public join(other: this): this;
	public join(other: IntervalLift): this;
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

	public meet(other: this): this;
	public meet(other: IntervalLift): this;
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

	public concretize(limit: number): ReadonlySet<number> | typeof Top {
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

	public abstract(concrete: ReadonlySet<number> | typeof Top): this;
	public abstract(concrete: ReadonlySet<number> | typeof Top): IntervalDomain {
		return IntervalDomain.abstract(concrete);
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

	/**
	 * Adds another abstract value to the current abstract value by adding the two lower and upper bounds, respectively.
	 */
	public add(other: this | IntervalLift): this {
		const otherValue = other instanceof IntervalDomain ? other.value : other;

		if(this.value === Bottom || otherValue === Bottom) {
			return this.bottom();
		} else {
			return this.create([this.value[0] + otherValue[0], this.value[1] + otherValue[1]]);
		}
	}

	/**
	 * Subtracts another abstract value from the current abstract value by subtracting the two lower and upper bounds from each other, respectively.
	 */
	public subtract(other: this | IntervalLift): this {
		const otherValue = other instanceof IntervalDomain ? other.value : other;

		if(this.value === Bottom || otherValue === Bottom) {
			return this.bottom();
		} else {
			return this.create([this.value[0] - otherValue[0], this.value[1] - otherValue[1]]);
		}
	}

	/**
	 * Creates the minimum between the current abstract value and another abstract value by creating the minimum of the two lower and upper bounds, respectively.
	 */
	public min(other: this | IntervalLift): this {
		const otherValue = other instanceof IntervalDomain ? other.value : other;

		if(this.value === Bottom || otherValue === Bottom) {
			return this.bottom();
		} else {
			return this.create([Math.min(this.value[0], otherValue[0]), Math.min(this.value[1], otherValue[1])]);
		}
	}

	/**
	 * Creates the maximum between the current abstract value and another abstract value by creating the maximum of the two lower and upper bounds, respectively.
	 */
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
			return this.value.description;
		}
		return this.value;
	}

	public toString(): string {
		if(this.value === Bottom) {
			return BottomSymbol;
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
