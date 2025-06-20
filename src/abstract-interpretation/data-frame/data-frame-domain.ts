import { BoundedSetDomain } from '../domains/bounded-set-domain';
import { PosIntervalDomain } from '../domains/positive-interval-domain';
import { ProductDomain } from '../domains/product-domain';
import { StateAbstractDomain } from '../domains/state-abstract-domain';

type DataFrameShape = {
	colnames: BoundedSetDomain<string>;
	cols:     PosIntervalDomain;
	rows:     PosIntervalDomain;
}

export class DataFrameDomain extends ProductDomain<DataFrameShape> {
	public create(value: DataFrameShape, maxColNames?: number): DataFrameDomain {
		return new DataFrameDomain({
			colnames: new BoundedSetDomain(value.colnames.value, maxColNames),
			cols:     new PosIntervalDomain(value.cols.value),
			rows:     new PosIntervalDomain(value.rows.value)
		});
	}

	public static bottom(maxColNames?: number): DataFrameDomain {
		return new DataFrameDomain({
			colnames: BoundedSetDomain.bottom(maxColNames),
			cols:     PosIntervalDomain.bottom(),
			rows:     PosIntervalDomain.bottom()
		});
	}

	public static top(maxColNames?: number): DataFrameDomain {
		return new DataFrameDomain({
			colnames: BoundedSetDomain.top(maxColNames),
			cols:     PosIntervalDomain.top(),
			rows:     PosIntervalDomain.top()
		});
	}
}

export class DateFrameStateDomain extends StateAbstractDomain<DataFrameDomain> {}
