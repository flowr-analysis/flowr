import { PosIntervalDomain } from '../domains/positive-interval-domain';
import { ProductDomain } from '../domains/product-domain';
import { SetRangeDomain } from '../domains/set-range-domain';

/** The type of the abstract product representing the shape of data frames */
export type AbstractDataFrameShape = {
	readonly colnames: SetRangeDomain<string>;
	readonly cols:     PosIntervalDomain;
	readonly rows:     PosIntervalDomain;
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
			const minColNames = value.colnames.must.size;
			const maxColNames = value.colnames.isFinite() ? value.colnames.must.size + value.colnames.may.size : Infinity;

			if(minColNames >= value.cols.upper) {
				value = {
					...value,
					colnames: value.colnames.create({ must: value.colnames.must, may: new Set() })
				};
			} else if(value.colnames.isFinite() && value.colnames.may.size > 0 && maxColNames <= value.cols.lower) {
				value = {
					...value,
					colnames: value.colnames.create({ must: value.colnames.upper(), may: new Set() })
				};
			}
		}
		if(value.colnames.isValue() && value.cols.isValue()) {
			const minColNames = value.colnames.must.size;
			const maxColNames = value.colnames.isFinite() ? value.colnames.must.size + value.colnames.may.size : Infinity;

			if((minColNames > value.cols.lower || maxColNames < value.cols.upper) && Math.max(minColNames, value.cols.lower) <= Math.min(maxColNames, value.cols.upper)) {
				value = {
					...value,
					cols: value.cols.create([Math.max(minColNames, value.cols.lower), Math.min(maxColNames, value.cols.upper)])
				};
			}
		}
		return value;
	}
}
