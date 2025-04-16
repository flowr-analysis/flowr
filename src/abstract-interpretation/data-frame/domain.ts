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
	if(X1 === ColNamesTop) {
		return ColNamesTop;
	} else if(X2 === ColNamesTop) {
		return X1;
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

export function addInterval(X1: IntervalDomain, X2: IntervalDomain): IntervalDomain {
	if(X1 === IntervalBottom || X2 === IntervalBottom) {
		return IntervalBottom;
	} else {
		return [X1[0] + X2[0], X1[1] + X2[1]];
	}
}

export function subtractInterval(X1: IntervalDomain, X2: IntervalDomain): IntervalDomain {
	if(X1 === IntervalBottom || X2 === IntervalBottom) {
		return IntervalBottom;
	} else {
		return [X1[0] - X2[0], X1[1] - X2[1]];
	}
}

export function minInterval(X1: IntervalDomain, X2: IntervalDomain): IntervalDomain {
	if(X1 === IntervalBottom || X2 === IntervalBottom) {
		return IntervalBottom;
	} else {
		return [Math.min(X1[0], X2[0]), Math.min(X1[1], X2[1])];
	}
}

export function includeZeroInterval(X: IntervalDomain): IntervalDomain {
	if(X === IntervalBottom) {
		return IntervalBottom;
	} else {
		return [0, X[1]];
	}
}

export function equalDataFrameDomain(X1: DataFrameDomain, X2: DataFrameDomain): boolean {
	return equalColNames(X1.colnames, X2.colnames) && equalInterval(X1.cols, X2.cols) && equalInterval(X1.rows, X2.rows);
}

export function joinDataFrames(...values: DataFrameDomain[]): DataFrameDomain {
	return values.slice(1).reduce((a, b) => ({
		colnames: joinColNames(a.colnames, b.colnames),
		cols:     joinInterval(a.cols, b.cols),
		rows:     joinInterval(a.rows, b.rows)
	}), values[0] ?? DataFrameTop);
}

export function meetDataFrames(...values: DataFrameDomain[]): DataFrameDomain {
	return values.slice(1).reduce((a, b) => ({
		colnames: meetColNames(a.colnames, b.colnames),
		cols:     meetInterval(a.cols, b.cols),
		rows:     meetInterval(a.rows, b.rows)
	}), values[0] ?? DataFrameTop);
}

export function equalDataFrameState(R1: DataFrameStateDomain, R2: DataFrameStateDomain): boolean {
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

export function joinDataFrameStates(...values: DataFrameStateDomain[]): DataFrameStateDomain {
	const result = new Map(values[0]);

	for(const domain of values.slice(1)) {
		for(const [nodeId, value] of domain) {
			if(result.has(nodeId)) {
				result.set(nodeId, joinDataFrames(result.get(nodeId) ?? DataFrameTop, value));
			} else {
				result.set(nodeId, value);
			}
		}
	}
	return result;
}

export function meetDataFrameStates(...values: DataFrameStateDomain[]): DataFrameStateDomain {
	const result = new Map(values[0]);

	for(const domain of values.slice(1)) {
		for(const [nodeId, value] of domain) {
			if(result.has(nodeId)) {
				result.set(nodeId, meetDataFrames(result.get(nodeId) ?? DataFrameTop, value));
			} else {
				result.set(nodeId, value);
			}
		}
	}
	return result;
}
