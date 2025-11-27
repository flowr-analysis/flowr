import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { AbstractDomainValue } from '../domains/abstract-domain';
import { PosIntervalDomain } from '../domains/positive-interval-domain';
import { ProductDomain } from '../domains/product-domain';
import type { SetRangeLimit } from '../domains/set-range-domain';
import { SetRangeDomain } from '../domains/set-range-domain';
import { StateAbstractDomain } from '../domains/state-abstract-domain';

/** The type of the abstract product representing the shape of data frames */
export type AbstractDataFrameShape = {
	colnames: SetRangeDomain<string>;
	cols:     PosIntervalDomain;
	rows:     PosIntervalDomain;
}

/** The type of abstract values of a sub abstract domain (shape property) of the data frame shape product domain */
export type DataFrameShapeProperty<Property extends keyof AbstractDataFrameShape> = AbstractDomainValue<AbstractDataFrameShape[Property]>;

/**
 * The data frame abstract domain as product domain of a column names domain, column count domain, and row count domain.
 */
export class DataFrameDomain extends ProductDomain<AbstractDataFrameShape> {
	constructor(value: AbstractDataFrameShape, maxColNames?: SetRangeLimit | number) {
		super({
			colnames: new SetRangeDomain(value.colnames.value, maxColNames ?? value.colnames.limit),
			cols:     new PosIntervalDomain(value.cols.value),
			rows:     new PosIntervalDomain(value.rows.value)
		});
	}

	public create(value: AbstractDataFrameShape): this;
	public create(value: AbstractDataFrameShape): DataFrameDomain {
		return new DataFrameDomain(value, this.colnames.limit);
	}

	/**
	 * The current abstract value of the column names domain.
	 */
	public get colnames(): AbstractDataFrameShape['colnames'] {
		return this.value.colnames;
	}

	/**
	 * The current abstract value of the column count domain.
	 */
	public get cols(): AbstractDataFrameShape['cols'] {
		return this.value.cols;
	}

	/**
	 * The current abstract value of the row count domain.
	 */
	public get rows(): AbstractDataFrameShape['rows'] {
		return this.value.rows;
	}

	public static bottom(maxColNames?: number): DataFrameDomain {
		return new DataFrameDomain({
			colnames: SetRangeDomain.bottom(maxColNames),
			cols:     PosIntervalDomain.bottom(),
			rows:     PosIntervalDomain.bottom()
		});
	}

	public static top(maxColNames?: number): DataFrameDomain {
		return new DataFrameDomain({
			colnames: SetRangeDomain.top(maxColNames),
			cols:     PosIntervalDomain.top(),
			rows:     PosIntervalDomain.top()
		});
	}
}

/**
 * The data frame state abstract domain as state domain mapping AST node IDs to inferred abstract data frame shapes.
 */
export class DataFrameStateDomain extends StateAbstractDomain<DataFrameDomain> {
	public create(value: ReadonlyMap<NodeId, DataFrameDomain>): this;
	public create(value: ReadonlyMap<NodeId, DataFrameDomain>): DataFrameStateDomain {
		return new DataFrameStateDomain(value);
	}

	public static bottom(): DataFrameStateDomain {
		return new DataFrameStateDomain(new Map<NodeId, DataFrameDomain>());
	}
}
