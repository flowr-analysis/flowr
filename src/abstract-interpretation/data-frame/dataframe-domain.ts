import type { AbstractDomain } from '../domains/abstract-domain';
import { PosIntervalDomain } from '../domains/positive-interval-domain';
import { ProductDomain } from '../domains/product-domain';
import { SetBoundedSetDomain } from '../domains/set-bounded-set-domain';
import { StateAbstractDomain } from '../domains/state-abstract-domain';

/** The type of the abstract product representing the shape of data frames */
export type AbstractDataFrameShape = {
	colnames: SetBoundedSetDomain<string>;
	cols:     PosIntervalDomain;
	rows:     PosIntervalDomain;
}

/** The type of abstract values of a sub abstract domain (shape property) of the data frame shape product */
type DataFrameShapeProperty<Property extends keyof AbstractDataFrameShape> =
	AbstractDataFrameShape[Property] extends AbstractDomain<unknown, unknown, unknown, unknown, infer Lift> ? Lift : never;

/**
 * The data frame abstract domain as product domain of a column names domain, column count domain, and row count domain.
 */
export class DataFrameDomain extends ProductDomain<AbstractDataFrameShape> {
	constructor(value: AbstractDataFrameShape, maxColNames?: number) {
		super({
			colnames: new SetBoundedSetDomain(value.colnames.value, maxColNames),
			cols:     new PosIntervalDomain(value.cols.value),
			rows:     new PosIntervalDomain(value.rows.value)
		});
	}

	public create(value: AbstractDataFrameShape, maxColNames?: number): DataFrameDomain {
		return new DataFrameDomain(value, maxColNames);
	}

	/**
	 * The current abstract value of the column names domain.
	 */
	public get colnames(): DataFrameShapeProperty<'colnames'> {
		return this.value.colnames.value;
	}

	/**
	 * The current abstract value of the column count domain.
	 */
	public get cols(): DataFrameShapeProperty<'cols'> {
		return this.value.cols.value;
	}

	/**
	 * The current abstract value of the row count domain.
	 */
	public get rows(): DataFrameShapeProperty<'rows'> {
		return this.value.rows.value;
	}

	public static bottom(maxColNames?: number): DataFrameDomain {
		return new DataFrameDomain({
			colnames: SetBoundedSetDomain.bottom(maxColNames),
			cols:     PosIntervalDomain.bottom(),
			rows:     PosIntervalDomain.bottom()
		});
	}

	public static top(maxColNames?: number): DataFrameDomain {
		return new DataFrameDomain({
			colnames: SetBoundedSetDomain.top(maxColNames),
			cols:     PosIntervalDomain.top(),
			rows:     PosIntervalDomain.top()
		});
	}
}

/**
 * The data frame state abstract domain as state abstract domain mapping AST node IDs to inferred abstract data frame shapes.
 */
export class DateFrameStateDomain extends StateAbstractDomain<DataFrameDomain> {}
