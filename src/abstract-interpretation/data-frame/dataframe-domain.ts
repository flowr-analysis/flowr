import { PosIntervalDomain } from '../domains/positive-interval-domain';
import { ProductDomain } from '../domains/product-domain';
import { SetRangeDomain } from '../domains/set-range-domain';

/** The type of the abstract product representing the shape of data frames */
export type AbstractDataFrameShape = {
	colnames: SetRangeDomain<string>;
	cols:     PosIntervalDomain;
	rows:     PosIntervalDomain;
};

/**
 * The data frame abstract domain as product domain of a column names domain, column count domain, and row count domain.
 */
export class DataFrameDomain extends ProductDomain<AbstractDataFrameShape> {
	public create(value: AbstractDataFrameShape): this {
		return new DataFrameDomain(value) as this;
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

	protected reduce(value: AbstractDataFrameShape): AbstractDataFrameShape {
		if(value.colnames.isValue() && value.cols.isValue()) {
			const minColNames = value.colnames.value.min.size;
			const maxColNames = value.colnames.isFinite() ? value.colnames.value.min.size + value.colnames.value.range.size : Infinity;

			if(minColNames >= value.cols.value[1]) {
				value = {
					...value,
					colnames: value.colnames.create({ min: value.colnames.value.min, range: new Set() })
				};
			} else if(value.colnames.isFinite() && value.colnames.value.range.size !== 0 && maxColNames <= value.cols.value[0]) {
				value = {
					...value,
					colnames: value.colnames.create({ min: value.colnames.upper(), range: new Set() })
				};
			}
		}
		if(value.colnames.isValue() && value.cols.isValue()) {
			const minColNames = value.colnames.value.min.size;
			const maxColNames = value.colnames.isFinite() ? value.colnames.value.min.size + value.colnames.value.range.size : Infinity;

			if((minColNames > value.cols.value[0] || maxColNames < value.cols.value[1]) && Math.max(minColNames, value.cols.value[0]) <= Math.min(maxColNames, value.cols.value[1])) {
				value = {
					...value,
					cols: value.cols.create([Math.max(minColNames, value.cols.value[0]), Math.min(maxColNames, value.cols.value[1])])
				};
			}
		}
		return value;
	}
}
