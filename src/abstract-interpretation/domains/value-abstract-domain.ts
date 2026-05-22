import type { Ternary } from '../../util/logic';

/**
 * A value abstract domain with abstraction function and a satisfiability check for concrete values.
 */
export interface ValueDomain<T> {
	/**
	 * Abstracts a list of concrete values into an abstract value of the value abstract domain.
	 */
	from(...values: T[]): this;

	/**
	 * Checks whether the current abstract value satisfies a concrete value (i.e. includes a concrete value).
	 * @see {@link Ternary} for the returned satisfiability result
	 */
	satisfies(value: T): Ternary;
}

/**
 * A string value abstract domain with string operations and a satisfiability check.
 */
export interface StringDomain extends ValueDomain<string> {
	/**
	 * Concatenates this string abstract value with another string abstract value.
	 */
	concat(other: this): this;

	satisfies(value: string, comparator?: StringComparator): Ternary;
}

/**
 * A numeric value abstract domain with numeric operations and a satisfiability check.
 */
export interface NumericDomain extends ValueDomain<number> {
	/**
	 * Negates this numeric abstract value.
	 */
	negate(): this;

	/**
	 * Adds an numeric abstract value to this numeric abstract value.
	 */
	add(other: this): this;

	/**
	 * Subtracts an numeric abstract value from this numeric abstract value.
	 */
	subtract(other: this): this;

	/**
	 * Multiplies this numeric abstract value with another numeric abstract value.
	 */
	multiply(other: this): this;

	/**
	 * Divides this numeric abstract value by another numeric abstract value.
	 */
	divide(other: this): this;

	/**
	 * Gets the minimum of this numeric abstract value and another numeric abstract value.
	 */
	min(other: this): this;

	/**
	 * Gets the maximum of this numeric abstract value and another numeric abstract value.
	 */
	max(other: this): this;

	satisfies(value: number, comparator?: NumericalComparator): Ternary;
}

export interface BooleanDomain extends ValueDomain<boolean> {
	/**
	 * Negates this boolean abstract value.
	 */
	negate(): this;

	/**
	 * Creates the conjunction between this boolean abstract value and another boolean abstract value.
	 */
	and(other: this): this;

	/**
	 * Creates the disjunction between this boolean abstract value and another boolean abstract value.
	 */
	or(other: this): this;
}

/**
 * A set value abstract domain with set operations and a satisfiability check.
 */
export interface SetDomain<T> extends ValueDomain<ReadonlySet<T>> {
	/**
	 * Creates the union between this set abstract value and another set abstract value.
	 */
	union(other: this): this;

	/**
	 * Creates the intersection between this set abstract value and another set abstract value.
	 */
	intersect(other: this): this;

	/**
	 * Subtracts another set abstract value from this set abstract value creating the set difference.
	 */
	subtract(other: this): this;

	satisfies(value: ReadonlySet<T>, comparator?: SetComparator): Ternary;
}

/**
 * Represents the different types of string comparators for satisfiability checks for an abstract domain.
 */
export enum StringComparator {
	Equal,
	StartsWith,
	EndsWith,
	Includes
}

/**
 * Represents the different types of numerical comparators for satisfiability checks for an abstract domain.
 */
export enum NumericalComparator {
	Equal,
	Less,
	LessOrEqual,
	Greater,
	GreaterOrEqual
}

/**
 * Represents the different types of set comparators for satisfiability checks for an abstract domain.
 */
export enum SetComparator {
	Equal,
	Subset,
	SubsetOrEqual
}
