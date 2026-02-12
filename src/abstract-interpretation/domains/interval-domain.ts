import { assertUnreachable } from '../../util/assert';
import { Ternary } from '../../util/logic';
import { AbstractDomain, DEFAULT_SIGNIFICANT_FIGURES } from './abstract-domain';
import { Bottom, BottomSymbol, Top } from './lattice';
import { NumericalComparator, type SatisfiableDomain } from './satisfiable-domain';
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

	public readonly significantFigures: number;

	constructor(value: Value, significantFigures: number = DEFAULT_SIGNIFICANT_FIGURES) {
		if(Array.isArray(value)) {
			if(value.some(isNaN) || value[0] > value[1]) {
				super(Bottom as Value);
			} else {
				super([value[0], value[1]] as const as Value);
			}
		} else {
			super(value);
		}
		this.significantFigures = significantFigures;
	}

	public create(value: IntervalLift): this;
	public create(value: IntervalLift): IntervalDomain {
		return new IntervalDomain(value, this.significantFigures);
	}

	public static top(significantFigures: number = DEFAULT_SIGNIFICANT_FIGURES): IntervalDomain<IntervalTop> {
		return new IntervalDomain(IntervalTop, significantFigures);
	}

	public static bottom(significantFigures: number = DEFAULT_SIGNIFICANT_FIGURES): IntervalDomain<IntervalBottom> {
		return new IntervalDomain(Bottom, significantFigures);
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

	/**
	 * Compares two numbers for equality with a precision based on the number of significant figures of the interval domain.
	 * If the number of significant figures is not finite, an exact comparison is performed.
	 * @param a - The first number to compare.
	 * @param b - The second number to compare.
	 * @returns A ternary value indicating whether the two numbers are considered equal (Ternary.Always), not equal (Ternary.Never),
	 *          or maybe equal (Ternary.Maybe) based on the significance precision.
	 * @private
	 */
	private isEqualWithSignificancePrecision(a: number, b: number): Ternary {
		if(!isFinite(this.significantFigures)) {
			// If significantFigures is not finite, we consider the values to be exactly equal or not equal
			return a === b ? Ternary.Always : Ternary.Never;
		}

		if(isFinite(a) && isFinite(b) && a !== b) {
			const magnitude = Math.pow(10, Math.floor(Math.log10(Math.max(Math.abs(a), Math.abs(b)))));
			const tolerance = 0.5 * Math.pow(10, Math.round(Math.log10(magnitude)) - (Math.round(this.significantFigures) - 1));

			return Math.abs(Math.abs(a) - Math.abs(b)) <= tolerance ? Ternary.Maybe : Ternary.Never;
		}
		return a === b ? Ternary.Always : Ternary.Never;
	};

	/**
	 * Compares two numbers for less-than relation with a precision based on the number of significant figures of the interval domain.
	 * If the number of significant figures is not finite, an exact comparison is performed.
	 * @param a - The first number to compare.
	 * @param b - The second number to compare.
	 * @returns A ternary value indicating whether the first number is considered less than the second number (Ternary.Always),
	 *          not less than (Ternary.Never), or maybe less than (Ternary.Maybe) based on the significance precision.
	 * @private
	 */
	private isLowerWithSignificancePrecision(a: number, b: number): Ternary {
		if(!isFinite(this.significantFigures)) {
			return a < b ? Ternary.Always : Ternary.Never;
		}

		let less = a < b ? Ternary.Always : Ternary.Never;
		if(less === Ternary.Never) {
			// a is not less than b, so we check for equality with significance precision
			if(this.isEqualWithSignificancePrecision(a, b) !== Ternary.Never) {
				less = Ternary.Maybe;
			}
		}
		return less;
	}

	/**
	 * Compares two numbers for less-than-or-equal relation with a precision based on the number of significant figures of the interval domain.
	 * If the number of significant figures is not finite, an exact comparison is performed.
	 * @param a - The first number to compare.
	 * @param b - The second number to compare.
	 * @returns A ternary value indicating whether the first number is considered less than or equal to the second number (Ternary.Always),
	 *          not less than or equal to (Ternary.Never), or maybe less than or equal to (Ternary.Maybe) based on the significance precision.
	 * @private
	 */
	private isLowerEqualWithSignificancePrecision(a: number, b: number): Ternary {
		let leq = a < b ? Ternary.Always : Ternary.Never;
		if(leq === Ternary.Never) {
			// a is not less than b, so we check for equality with significance precision
			leq = this.isEqualWithSignificancePrecision(a, b);
		}
		return leq;
	}

	public equals(other: this): Ternary {
		if(this.isValue() && other.isValue()) {
			const [lowerA, upperA] = this.value;
			const [lowerB, upperB] = other.value;

			const lowerEqual: Ternary = this.isEqualWithSignificancePrecision(lowerA, lowerB);
			const upperEqual: Ternary = this.isEqualWithSignificancePrecision(upperA, upperB);

			if(lowerEqual === Ternary.Never || upperEqual === Ternary.Never) {
				return Ternary.Never;
			} else if(lowerEqual === Ternary.Always && upperEqual === Ternary.Always) {
				return Ternary.Always;
			} else {
				return Ternary.Maybe;
			}
		}

		return this.value === other.value ? Ternary.Always : Ternary.Never;
	}

	public leq(other: this): Ternary {
		if(this.value === Bottom) {
			return Ternary.Always;
		}

		if(other.value === Bottom) {
			return Ternary.Never;
		}

		const [thisLower, thisUpper] = this.value;
		const [otherLower, otherUpper] = other.value;

		const lowerLeq = this.isLowerEqualWithSignificancePrecision(otherLower, thisLower);
		const upperLeq = this.isLowerEqualWithSignificancePrecision(thisUpper, otherUpper);

		if(lowerLeq === Ternary.Never || upperLeq === Ternary.Never) {
			return Ternary.Never;
		} else if(lowerLeq === Ternary.Always && upperLeq === Ternary.Always) {
			return Ternary.Always;
		} else {
			return Ternary.Maybe;
		}
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
				if(this.isValue()) {
					if(this.value[0] === value && this.value[1] === value) {
						return Ternary.Always;
					}

					const lowerLeq = this.isLowerEqualWithSignificancePrecision(this.value[0], value);
					const upperGeq = this.isLowerEqualWithSignificancePrecision(value, this.value[1]);

					if(lowerLeq !== Ternary.Never && upperGeq !== Ternary.Never) {
						return Ternary.Maybe;
					}
				}
				return Ternary.Never;
			}
			case NumericalComparator.Less: {
				if(this.isValue()) {
					if(value < this.value[0]) {
						return Ternary.Always;
					}

					if(this.isLowerWithSignificancePrecision(value, this.value[1]) !== Ternary.Never) {
						return Ternary.Maybe;
					}
				}
				return Ternary.Never;
			}
			case NumericalComparator.LessOrEqual: {
				if(this.isValue()) {
					if(value <= this.value[0]) {
						return Ternary.Always;
					}

					if(this.isLowerEqualWithSignificancePrecision(value, this.value[1]) !== Ternary.Never) {
						return Ternary.Maybe;
					}
				}
				return Ternary.Never;
			}
			case NumericalComparator.Greater: {
				if(this.isValue()) {
					if(value > this.value[1]) {
						return Ternary.Always;
					}

					if(this.isLowerWithSignificancePrecision(this.value[0], value) !== Ternary.Never) {
						return Ternary.Maybe;
					}
				}
				return Ternary.Never;
			}
			case NumericalComparator.GreaterOrEqual: {
				if(this.isValue()) {
					if(value >= this.value[1]) {
						return Ternary.Always;
					}

					if(this.isLowerEqualWithSignificancePrecision(this.value[0], value) !== Ternary.Never) {
						return Ternary.Maybe;
					}
				}
				return Ternary.Never;
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
		const lower = `${isFinite(this.value[0]) ? this.value[0] : (this.value[0] > 0 ? '+∞' : '-∞')}`;
		const upper = `${isFinite(this.value[1]) ? this.value[1] : (this.value[1] > 0 ? '+∞' : '-∞')}`;
		return `[${lower}, ${upper}]`;
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
