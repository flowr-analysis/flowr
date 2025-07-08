import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { setEquals } from '../../util/collections/set';

const MaxColNames = 50;

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

export function equalColNames(set1: ColNamesDomain, set2: ColNamesDomain): boolean {
	return set1 === set2 || (set1 !== ColNamesTop && setEquals(new Set(set1), new Set(set2)));
}

export function leqColNames(set1: ColNamesDomain, set2: ColNamesDomain): boolean {
	return set2 === ColNamesTop || (set1 !== ColNamesTop && new Set(set1).isSubsetOf(new Set(set2)));
}

export function joinColNames(set1: ColNamesDomain, set2: ColNamesDomain): ColNamesDomain {
	if(set1 === ColNamesTop || set2 === ColNamesTop) {
		return ColNamesTop;
	}
	const join = Array.from(new Set(set1).union(new Set(set2)));

	return join.length > MaxColNames ? ColNamesTop : join;
}

export function meetColNames(set1: ColNamesDomain, set2: ColNamesDomain): ColNamesDomain {
	if(set1 === ColNamesTop) {
		return set2;
	} else if(set2 === ColNamesTop) {
		return set1;
	} else {
		return Array.from(new Set(set1).intersection(new Set(set2)));
	}
}

export function subtractColNames(set1: ColNamesDomain, set2: ColNamesDomain): ColNamesDomain {
	if(set1 === ColNamesTop) {
		return ColNamesTop;
	} else if(set2 === ColNamesTop) {
		return set1;
	} else {
		return Array.from(new Set(set1).difference(new Set(set2)));
	}
}

export function wideningColNames(set1: ColNamesDomain, set2: ColNamesDomain): ColNamesDomain {
	return leqColNames(set1, set2) ? set2 : ColNamesTop;
}

export function satisfiesColsNames(set: ColNamesDomain, value: string) {
	return set === ColNamesTop || set.includes(value);
}

export function equalInterval(interval1: IntervalDomain, interval2: IntervalDomain): boolean {
	return interval1 === interval2 || (interval1 !== IntervalBottom && interval1[0] === interval2[0] && interval1[1] === interval2[1]);
}

export function leqInterval(interval1: IntervalDomain, interval2: IntervalDomain): boolean {
	return interval1 === IntervalBottom || (interval2 !== IntervalBottom && interval2[0] <= interval1[0] && interval1[1] <= interval2[1]);
}

export function joinInterval(interval1: IntervalDomain, interval2: IntervalDomain): IntervalDomain {
	if(interval1 === IntervalBottom) {
		return interval2;
	} else if(interval2 === IntervalBottom) {
		return interval1;
	} else {
		return [Math.min(interval1[0], interval2[0]), Math.max(interval1[1], interval2[1])];
	}
}

export function meetInterval(interval1: IntervalDomain, interval2: IntervalDomain): IntervalDomain {
	if(interval1 === IntervalBottom || interval2 === IntervalBottom) {
		return IntervalBottom;
	} else if(Math.max(interval1[0], interval2[0]) > Math.min(interval1[1], interval2[1])) {
		return IntervalBottom;
	} else {
		return [Math.max(interval1[0], interval2[0]), Math.min(interval1[1], interval2[1])];
	}
}

export function addInterval(interval1: IntervalDomain, interval2: IntervalDomain): IntervalDomain {
	if(interval1 === IntervalBottom || interval2 === IntervalBottom) {
		return IntervalBottom;
	} else {
		return [interval1[0] + interval2[0], interval1[1] + interval2[1]];
	}
}

export function subtractInterval(interval1: IntervalDomain, interval2: IntervalDomain): IntervalDomain {
	if(interval1 === IntervalBottom || interval2 === IntervalBottom) {
		return IntervalBottom;
	} else {
		return [Math.max(interval1[0] - interval2[0], 0), Math.max(interval1[1] - interval2[1], 0)];
	}
}

export function minInterval(interval1: IntervalDomain, interval2: IntervalDomain): IntervalDomain {
	if(interval1 === IntervalBottom || interval2 === IntervalBottom) {
		return IntervalBottom;
	} else {
		return [Math.min(interval1[0], interval2[0]), Math.min(interval1[1], interval2[1])];
	}
}

export function maxInterval(interval1: IntervalDomain, interval2: IntervalDomain): IntervalDomain {
	if(interval1 === IntervalBottom || interval2 === IntervalBottom) {
		return IntervalBottom;
	} else {
		return [Math.max(interval1[0], interval2[0]), Math.max(interval1[1], interval2[1])];
	}
}

export function extendIntervalToZero(interval: IntervalDomain): IntervalDomain {
	if(interval === IntervalBottom) {
		return IntervalBottom;
	} else {
		return [0, interval[1]];
	}
}

export function extendIntervalToInfinity(interval: IntervalDomain): IntervalDomain {
	if(interval === IntervalBottom) {
		return IntervalBottom;
	} else {
		return [interval[0], Infinity];
	}
}

export function wideningInterval(interval1: IntervalDomain, interval2: IntervalDomain): IntervalDomain {
	if(interval1 === IntervalBottom) {
		return interval2;
	} else if(interval2 === IntervalBottom) {
		return interval1;
	} else {
		return [interval1[0] <= interval2[0] ? interval1[0] : 0, interval1[1] >= interval2[1] ? interval1[1] : Infinity];
	}
}

export function satisfiesInterval(interval: IntervalDomain, value: number) {
	return interval !== IntervalBottom && interval[0] <= value && value <= interval[1];
}

export function satisfiesLeqInterval(interval: IntervalDomain, value: number) {
	return interval !== IntervalBottom && value <= interval[1];
}

export function equalDataFrameDomain(value1: DataFrameDomain, value2: DataFrameDomain): boolean {
	return value1 === value2 || (equalColNames(value1.colnames, value2.colnames) && equalInterval(value1.cols, value2.cols) && equalInterval(value1.rows, value2.rows));
}

export function joinDataFrames(...values: DataFrameDomain[]): DataFrameDomain {
	let result = values[0] ?? DataFrameTop;

	for(let i = 1; i < values.length; i++) {
		result = {
			colnames: joinColNames(result.colnames, values[i].colnames),
			cols:     joinInterval(result.cols, values[i].cols),
			rows:     joinInterval(result.rows, values[i].rows)
		};
	}
	return result;
}

export function meetDataFrames(...values: DataFrameDomain[]): DataFrameDomain {
	let result = values[0] ?? DataFrameTop;

	for(let i = 1; i < values.length; i++) {
		result = {
			colnames: meetColNames(result.colnames, values[i].colnames),
			cols:     meetInterval(result.cols, values[i].cols),
			rows:     meetInterval(result.rows, values[i].rows)
		};
	}
	return result;
}

export function wideningDataFrames(value1: DataFrameDomain, value2: DataFrameDomain): DataFrameDomain {
	return {
		colnames: wideningColNames(value1.colnames, value2.colnames),
		cols:     wideningInterval(value1.cols, value2.cols),
		rows:     wideningInterval(value1.rows, value2.rows)
	};
}

export function equalDataFrameState(state1: DataFrameStateDomain, state2: DataFrameStateDomain): boolean {
	if(state1 === state2) {
		return true;
	} else if(state1.size !== state2.size) {
		return false;
	}
	for(const [nodeId, value] of state1) {
		const other = state2.get(nodeId);
		if(other === undefined || !equalDataFrameDomain(value, other)) {
			return false;
		}
	}
	return true;
}

export function joinDataFrameStates(...states: DataFrameStateDomain[]): DataFrameStateDomain {
	const result = new Map(states[0]);

	for(let i = 1; i < states.length; i++) {
		for(const [nodeId, value] of states[i]) {
			if(result.has(nodeId)) {
				result.set(nodeId, joinDataFrames(result.get(nodeId) ?? DataFrameTop, value));
			} else {
				result.set(nodeId, value);
			}
		}
	}
	return result;
}

export function meetDataFrameStates(...states: DataFrameStateDomain[]): DataFrameStateDomain {
	const result = new Map(states[0]);

	for(let i = 1; i < states.length; i++) {
		for(const [nodeId, value] of states[i]) {
			if(result.has(nodeId)) {
				result.set(nodeId, meetDataFrames(result.get(nodeId) ?? DataFrameTop, value));
			} else {
				result.set(nodeId, value);
			}
		}
	}
	return result;
}

export function wideningDataFrameStates(state1: DataFrameStateDomain, state2: DataFrameStateDomain): DataFrameStateDomain {
	const result = new Map(state1);

	for(const [nodeId, value] of state2) {
		if(result.has(nodeId)) {
			result.set(nodeId, wideningDataFrames(result.get(nodeId) ?? DataFrameTop, value));
		} else {
			result.set(nodeId, value);
		}
	}
	return result;
}
