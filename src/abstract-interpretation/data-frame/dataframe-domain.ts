import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { AbstractDomainValue } from '../domains/abstract-domain';
import { PosIntervalDomain } from '../domains/positive-interval-domain';
import { ProductDomain } from '../domains/product-domain';
import { SetUpperBoundDomain } from '../domains/set-upper-bound-domain';
import { StateAbstractDomain } from '../domains/state-abstract-domain';

/** The type of the abstract product representing the shape of data frames */
export type AbstractDataFrameShape = {
	colnames: SetUpperBoundDomain<string>;
	cols:     PosIntervalDomain;
	rows:     PosIntervalDomain;
}

/** The type of abstract values of a sub abstract domain (shape property) of the data frame shape product domain */
export type DataFrameShapeProperty<Property extends keyof AbstractDataFrameShape> = AbstractDomainValue<AbstractDataFrameShape[Property]>;

/**
 * The data frame abstract domain as product domain of a column names domain, column count domain, and row count domain.
 */
export class DataFrameDomain extends ProductDomain<DataFrameDomain, AbstractDataFrameShape> {
	constructor(value: AbstractDataFrameShape, maxColNames?: number) {
		super({
			colnames: new SetUpperBoundDomain(value.colnames.value, maxColNames ?? value.colnames.limit),
			cols:     new PosIntervalDomain(value.cols.value),
			rows:     new PosIntervalDomain(value.rows.value)
		});
	}

	public create(value: AbstractDataFrameShape): DataFrameDomain {
		return new DataFrameDomain(value, this.maxColNames);
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

	/**
	 * The maximum number of inferred column names of the column names domain.
	 */
	public get maxColNames(): number {
		return this.value.colnames.limit;
	}

	public static bottom(maxColNames?: number): DataFrameDomain {
		return new DataFrameDomain({
			colnames: SetUpperBoundDomain.bottom(maxColNames),
			cols:     PosIntervalDomain.bottom(),
			rows:     PosIntervalDomain.bottom()
		});
	}

	public static top(maxColNames?: number): DataFrameDomain {
		return new DataFrameDomain({
			colnames: SetUpperBoundDomain.top(maxColNames),
			cols:     PosIntervalDomain.top(),
			rows:     PosIntervalDomain.top()
		});
	}

	public static join(values: DataFrameDomain[]): DataFrameDomain {
		return values[0]?.join(...values.slice(1)) ?? DataFrameDomain.bottom();
	}

	public static meet(values: DataFrameDomain[]): DataFrameDomain {
		return values[0]?.meet(...values.slice(1)) ?? DataFrameDomain.bottom();
	}
}

/**
 * The data frame state abstract domain as state domain mapping AST node IDs to inferred abstract data frame shapes.
 */
export class DataFrameStateDomain extends StateAbstractDomain<DataFrameStateDomain, DataFrameDomain> {
	public create(value: ReadonlyMap<NodeId, DataFrameDomain>): DataFrameStateDomain {
		return new DataFrameStateDomain(value);
	}

	public static bottom(): DataFrameStateDomain {
		return new DataFrameStateDomain(new Map<NodeId, DataFrameDomain>());
	}

	public static join(values: DataFrameStateDomain[]): DataFrameStateDomain {
		return values[0]?.join(...values.slice(1)) ?? DataFrameStateDomain.bottom();
	}

	public static meet(values: DataFrameStateDomain[]): DataFrameStateDomain {
		return values[0]?.meet(...values.slice(1)) ?? DataFrameStateDomain.bottom();
	}
}
