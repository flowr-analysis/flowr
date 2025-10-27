import type { Ternary } from '../../util/logic';

/**
 * An abstract domain with satisfiability checks for concrete values.
 */

export interface SatisfiableDomain<T> {
	/**
	 * Checks whether the current abstract value satisfies a concrete value (i.e. includes a concrete value).
	 * @see {@link Ternary} for the returned satisfiability result
	 */
	satisfies(value: T): Ternary;
}

/**
 * Represents the different types of numerical comparators for satifiability checks for an abstract domain.
 */

export enum NumericalComparator {
	Equal,
	Less,
	LessOrEqual,
	Greater,
	GreaterOrEqual
}

/**
 * Represents the different types of set comparators for satifiability checks for an abstract domain.
 */

export enum SetComparator {
	Equal,
	Subset,
	SubsetOrEqual
}
