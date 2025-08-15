import type { AbstractDomain } from '../domains/abstract-domain';
import { PosIntervalDomain } from '../domains/positive-interval-domain';
import { ProductDomain } from '../domains/product-domain';
import { SetRangeDomain } from '../domains/set-range-domain';
import { StateAbstractDomain } from '../domains/state-abstract-domain';

type AbstractDataFrameShape = {
	colnames: SetRangeDomain<string>;
	cols:     PosIntervalDomain;
	rows:     PosIntervalDomain;
}

type DataFrameShapeProperty<Property extends keyof AbstractDataFrameShape> = AbstractDataFrameShape[Property] extends AbstractDomain<unknown, unknown, unknown, unknown, infer Value> ? Value: never;

export class DataFrameDomain extends ProductDomain<AbstractDataFrameShape> {
	constructor(value: AbstractDataFrameShape, maxColNames?: number) {
		super({
			colnames: new SetRangeDomain(value.colnames.value, maxColNames ? { min: maxColNames, range: maxColNames } : undefined),
			cols:     new PosIntervalDomain(value.cols.value),
			rows:     new PosIntervalDomain(value.rows.value)
		});
	}

	public create(value: AbstractDataFrameShape, maxColNames?: number): DataFrameDomain {
		return new DataFrameDomain(value, maxColNames);
	}

	public get colnames(): DataFrameShapeProperty<'colnames'> {
		return this.value.colnames.value;
	}

	public get cols(): DataFrameShapeProperty<'cols'> {
		return this.value.cols.value;
	}

	public get rows(): DataFrameShapeProperty<'rows'> {
		return this.value.rows.value;
	}

	public static bottom(maxColNames?: number): DataFrameDomain {
		return new DataFrameDomain({
			colnames: SetRangeDomain.bottom(maxColNames ? { min: maxColNames, range: maxColNames } : undefined),
			cols:     PosIntervalDomain.bottom(),
			rows:     PosIntervalDomain.bottom()
		});
	}

	public static top(maxColNames?: number): DataFrameDomain {
		return new DataFrameDomain({
			colnames: SetRangeDomain.top(maxColNames ? { min: maxColNames, range: maxColNames } : undefined),
			cols:     PosIntervalDomain.top(),
			rows:     PosIntervalDomain.top()
		});
	}
}

export class DateFrameStateDomain extends StateAbstractDomain<DataFrameDomain> {}
