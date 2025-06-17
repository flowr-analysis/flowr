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
	public create(value: DataFrameShape): DataFrameDomain {
		return new DataFrameDomain({
			colnames: new BoundedSetDomain(value.colnames.value),
			cols:     new PosIntervalDomain(value.cols.value),
			rows:     new PosIntervalDomain(value.rows.value)
		});
	}

	public static bottom(): DataFrameDomain {
		return new DataFrameDomain({
			colnames: BoundedSetDomain.bottom(),
			cols:     PosIntervalDomain.bottom(),
			rows:     PosIntervalDomain.bottom()
		});
	}

	public static top(): DataFrameDomain {
		return new DataFrameDomain({
			colnames: BoundedSetDomain.top(),
			cols:     PosIntervalDomain.top(),
			rows:     PosIntervalDomain.top()
		});
	}
}

export class DateFrameStateDomain extends StateAbstractDomain<DataFrameDomain> {}
