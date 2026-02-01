import type { AbstractDomainValue } from '../domains/abstract-domain';
import { Top } from '../domains/lattice';
import { PosIntervalDomain } from '../domains/positive-interval-domain';
import { ProductDomain } from '../domains/product-domain';
import { SetRangeDomain } from '../domains/set-range-domain';

/** The type of the abstract product representing the shape of data frames */
export type AbstractDataFrameShape = {
	colnames: SetRangeDomain<string>;
	cols:     PosIntervalDomain;
	rows:     PosIntervalDomain;
};

/** The type of abstract values of a sub abstract domain (shape property) of the data frame shape product domain */
export type DataFrameShapeProperty<Property extends keyof AbstractDataFrameShape> = AbstractDomainValue<AbstractDataFrameShape[Property]>;

/**
 * The data frame abstract domain as product domain of a column names domain, column count domain, and row count domain.
 */
export class DataFrameDomain extends ProductDomain<AbstractDataFrameShape> {
	constructor(value: AbstractDataFrameShape) {
		super(DataFrameDomain.refine({
			colnames: value.colnames.create(value.colnames.value),
			cols:     value.cols.create(value.cols.value),
			rows:     value.rows.create(value.rows.value)
		}));
	}

	public create(value: AbstractDataFrameShape): this;
	public create(value: AbstractDataFrameShape): DataFrameDomain {
		return new DataFrameDomain(value);
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

	private static refine(value: AbstractDataFrameShape): AbstractDataFrameShape {
		if(value.colnames.isValue() && value.cols.isValue()) {
			if(value.colnames.value.range === Top && value.colnames.value.min.size >= value.cols.value[1]) {
				value.colnames = value.colnames.meet({ min: new Set(), range: value.colnames.value.min });
			}
			if(value.colnames.isValue()) {
				const minColNames = value.colnames.value.min.size;
				const maxColNames = value.colnames.isFinite() ? value.colnames.value.min.size + value.colnames.value.range.size : Infinity;

				if(minColNames > value.cols.value[0] || maxColNames < value.cols.value[1]) {
					value.cols = value.cols.meet([minColNames, maxColNames]);
				}
			}
		}
		return value;
	}
}
