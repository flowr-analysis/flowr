import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { setEquals } from '../../util/set';

type Interval = [number, number];

export const IntervalBottom = 'bottom';
export const IntervalTop: Interval = [0, Infinity];
export type IntervalDomain = Interval | typeof IntervalBottom;

export const ColNamesBottom: string[] = [];
export const ColNamesTop = 'top';
export type ColNamesDomain = string[] | typeof ColNamesTop;

export interface DataFrameDomain {
    colnames: ColNamesDomain,
    cols:     IntervalDomain,
    rows:     IntervalDomain
}

export const DataFrameBottom: DataFrameDomain = {
	colnames: ColNamesBottom,
	cols:     IntervalBottom,
	rows:     IntervalBottom
};

export const DataFrameTop: DataFrameDomain = {
	colnames: ColNamesTop,
	cols:     IntervalTop,
	rows:     IntervalTop
};

export type DataFrameStateDomain = Map<NodeId, DataFrameDomain>;

export function equalColNames(X1: ColNamesDomain, X2: ColNamesDomain): boolean {
	return X1 === X2 || (X1 !== ColNamesTop && setEquals(new Set(X1), new Set(X2)));
}

export function leqColNames(X1: ColNamesDomain, X2: ColNamesDomain): boolean {
	return X2 === ColNamesTop || (X1 !== ColNamesTop && new Set(X1).isSubsetOf(new Set(X2)));
}

export function joinColNames(X1: ColNamesDomain, X2: ColNamesDomain): ColNamesDomain {
	if(X1 === ColNamesTop || X2 === ColNamesTop) {
		return ColNamesTop;
	} else {
		return Array.from(new Set(X1).union(new Set(X2)));
	}
}

export function meetColNames(X1: ColNamesDomain, X2: ColNamesDomain): ColNamesDomain {
	if(X1 === ColNamesTop && X2 === ColNamesTop) {
		return ColNamesTop;
	} else if(X1 === ColNamesTop) {
		return X2;
	} else if(X2 === ColNamesTop) {
		return X1;
	} else {
		return Array.from(new Set(X1).intersection(new Set(X2)));
	}
}

export function subtractColNames(X1: ColNamesDomain, X2: ColNamesDomain): ColNamesDomain {
	if(X2 === ColNamesTop) {
		return ColNamesBottom;
	} else if(X1 === ColNamesTop) {
		return ColNamesTop;
	} else {
		return Array.from(new Set(X1).difference(new Set(X2)));
	}
}

export function equalInterval(X1: IntervalDomain, X2: IntervalDomain): boolean {
	return X1 === X2 || (X1 !== IntervalBottom && X1[0] === X2[0] && X1[1] === X2[1]);
}

export function leqInterval(X1: IntervalDomain, X2: IntervalDomain): boolean {
	return X1 === IntervalBottom || (X2 !== IntervalBottom && X2[0] <= X1[0] && X1[1] <= X2[1]);
}

export function joinInterval(X1: IntervalDomain, X2: IntervalDomain): IntervalDomain {
	if(X1 === IntervalBottom && X2 === IntervalBottom) {
		return IntervalBottom;
	} else if(X1 === IntervalBottom) {
		return X2;
	} else if(X2 === IntervalBottom) {
		return X1;
	} else {
		return [Math.min(X1[0], X2[0]), Math.max(X1[1], X2[1])];
	}
}

export function meetInterval(X1: IntervalDomain, X2: IntervalDomain): IntervalDomain {
	if(X1 === IntervalBottom || X2 === IntervalBottom) {
		return IntervalBottom;
	} else if(Math.max(X1[0], X2[0]) > Math.min(X1[1], X2[1])) {
		return IntervalBottom;
	} else {
		return [Math.max(X1[0], X2[0]), Math.min(X1[1], X2[1])];
	}
}

export function equalDataFrameDomain(X1: DataFrameDomain, X2: DataFrameDomain) {
	return equalColNames(X1.colnames, X2.colnames) && equalInterval(X1.cols, X2.cols) && equalInterval(X1.rows, X2.rows);
}

export function joinDataFrames(...values: DataFrameDomain[]) {
	let value = values[0] ?? DataFrameTop;

	for(let i = 1; i < values.length; i++) {
		value = {
			colnames: joinColNames(value.colnames, values[i].colnames),
			cols:     joinInterval(value.cols, values[i].cols),
			rows:     joinInterval(value.rows, values[i].rows)
		};
	}
	return value;
}

export function meetDataFrames(...values: DataFrameDomain[]) {
	let value = values[0] ?? DataFrameTop;

	for(let i = 1; i < values.length; i++) {
		value = {
			colnames: meetColNames(value.colnames, values[i].colnames),
			cols:     meetInterval(value.cols, values[i].cols),
			rows:     meetInterval(value.rows, values[i].rows)
		};
	}
	return value;
}

export function equalDataFrameState(R1: DataFrameStateDomain, R2: DataFrameStateDomain) {
	if(R1.size !== R2.size) {
		return false;
	}
	for(const [key, value] of R1) {
		const other = R2.get(key);
		if(other === undefined || !equalDataFrameDomain(value, other)) {
			return false;
		}
	}
	return true;
}
