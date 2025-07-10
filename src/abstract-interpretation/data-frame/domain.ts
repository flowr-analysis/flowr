import { defaultConfigOptions } from '../../config';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { setEquals } from '../../util/collections/set';

const MaxColNames = defaultConfigOptions.abstractInterpretation.dataFrame.maxColNames;

type Interval = [number, number];

/** The bottom element (least element) of the positive interval domain representing no possible values, explicitly given as "bottom". */
export const IntervalBottom = Symbol('bottom');
/** The top element (greatest element) of the positive interval domain representing all possible values, defined as the interval from 0 to infinity. */
export const IntervalTop: Interval = [0, Infinity];
/** The positive interval domain representing possible integer values. */
export type IntervalDomain = Interval | typeof IntervalBottom;

/** The bottom element (least element) of the column names domain representing no possible column name, defined as the empty list []. */
export const ColNamesBottom: string[] = [];
/** The top element (greatest element) of the column names domain representing all possible values, explicitly given as "top". */
export const ColNamesTop = Symbol('top');
/** The column names domain defined as bounded string set domain representing possible column names. */
export type ColNamesDomain = string[] | typeof ColNamesTop;

/**
 * The data frame shape domain representing possible data frame shapes, defined as product domain of
 * the {@link ColNamesDomain} for the columns names and {@link IntervalDomain} for the number of columns and rows.
 * */
export interface DataFrameDomain {
    colnames: ColNamesDomain,
    cols:     IntervalDomain,
    rows:     IntervalDomain
}

/**
 * The bottom element (least element) of the data frame shape domain representing no possible value, mapping the columns names to {@link ColNamesBottom}
 * and the number of columns and rows to {@link IntervalBottom}.
 */
export const DataFrameBottom: DataFrameDomain = {
	colnames: ColNamesBottom,
	cols:     IntervalBottom,
	rows:     IntervalBottom
};

/**
 * The top element (greatest element) of the data frame shape domain representing all possible value, mapping the columns names to {@link ColNamesTop}
 * and the number of columns and rows to {@link IntervalTop}.
 */
export const DataFrameTop: DataFrameDomain = {
	colnames: ColNamesTop,
	cols:     IntervalTop,
	rows:     IntervalTop
};

/**
 * The data frame shape state domain representing possible memory states, mapping AST node IDs to data frame shape values of the {@link DataFrameDomain}.
 */
export type DataFrameStateDomain = Map<NodeId, DataFrameDomain>;

/** Checks if two abstract values of the column names domain are equal. */
export function equalColNames(set1: ColNamesDomain, set2: ColNamesDomain): boolean {
	return set1 === set2 || (set1 !== ColNamesTop && set2 !== ColNamesTop && setEquals(new Set(set1), new Set(set2)));
}

/** Checks if two abstract values of the column names domain are ordered according to the partial ordering of the column names lattice. */
export function leqColNames(set1: ColNamesDomain, set2: ColNamesDomain): boolean {
	return set2 === ColNamesTop || (set1 !== ColNamesTop && new Set(set1).isSubsetOf(new Set(set2)));
}

/** Joins two abstract values of the columns names domain according to the column names lattice by creating the least upper bound (LUB). */
export function joinColNames(set1: ColNamesDomain, set2: ColNamesDomain, maxColNames: number = MaxColNames): ColNamesDomain {
	if(set1 === ColNamesTop || set2 === ColNamesTop) {
		return ColNamesTop;
	}
	const join = Array.from(new Set(set1).union(new Set(set2)));

	return join.length > maxColNames ? ColNamesTop : join;
}

/** Meets two abstract values of the columns names domain according to the column names lattice by creating the greatest lower bound (GLB). */
export function meetColNames(set1: ColNamesDomain, set2: ColNamesDomain): ColNamesDomain {
	if(set1 === ColNamesTop) {
		return set2;
	} else if(set2 === ColNamesTop) {
		return set1;
	} else {
		return Array.from(new Set(set1).intersection(new Set(set2)));
	}
}

/** Subtracts an abstract value from another abstract value of the column names domain by performing a set minus. */
export function subtractColNames(set1: ColNamesDomain, set2: ColNamesDomain): ColNamesDomain {
	if(set1 === ColNamesTop) {
		return ColNamesTop;
	} else if(set2 === ColNamesTop) {
		return set1;
	} else {
		return Array.from(new Set(set1).difference(new Set(set2)));
	}
}

/**
 * Widens two abstract values of the column names domain via naive widening to soundly over-approximate the join in (possibly infinite) fixpoint iterations.
 *
 * This is technically not necessary, as the join is limited by the maximum number of inferred column names.
 * However, this speeds up the iteration in larger loops significantly, as we are over-approximating the column names much earlier.
 */
export function wideningColNames(set1: ColNamesDomain, set2: ColNamesDomain): ColNamesDomain {
	return leqColNames(set1, set2) ? set2 : ColNamesTop;
}

/** Checks if two abstract values of the positive interval domain are equal. */
export function equalInterval(interval1: IntervalDomain, interval2: IntervalDomain): boolean {
	return interval1 === interval2 || (interval1 !== IntervalBottom && interval2 !== IntervalBottom && interval1[0] === interval2[0] && interval1[1] === interval2[1]);
}

/** Checks if two abstract values of the positive interval domain are ordered according to the partial ordering of the positive interval lattice. */
export function leqInterval(interval1: IntervalDomain, interval2: IntervalDomain): boolean {
	return interval1 === IntervalBottom || (interval2 !== IntervalBottom && interval2[0] <= interval1[0] && interval1[1] <= interval2[1]);
}

/** Joins two abstract values of the positive interval domain according to the positive interval lattice by creating the least upper bound (LUB). */
export function joinInterval(interval1: IntervalDomain, interval2: IntervalDomain): IntervalDomain {
	if(interval1 === IntervalBottom) {
		return interval2;
	} else if(interval2 === IntervalBottom) {
		return interval1;
	} else {
		return [Math.min(interval1[0], interval2[0]), Math.max(interval1[1], interval2[1])];
	}
}

/** Meets two abstract values of the positive interval domain according to the positive interval lattice by creating the greatest lower bound (GLB). */
export function meetInterval(interval1: IntervalDomain, interval2: IntervalDomain): IntervalDomain {
	if(interval1 === IntervalBottom || interval2 === IntervalBottom) {
		return IntervalBottom;
	} else if(Math.max(interval1[0], interval2[0]) > Math.min(interval1[1], interval2[1])) {
		return IntervalBottom;
	} else {
		return [Math.max(interval1[0], interval2[0]), Math.min(interval1[1], interval2[1])];
	}
}

/** Adds two abstract values of the positive interval domain, by adding the lower bounds and upper bounds. */
export function addInterval(interval1: IntervalDomain, interval2: IntervalDomain): IntervalDomain {
	if(interval1 === IntervalBottom || interval2 === IntervalBottom) {
		return IntervalBottom;
	} else {
		return [interval1[0] + interval2[0], interval1[1] + interval2[1]];
	}
}

/** Subtracts an abstract value from another abstract values of the positive interval domain, by subtracting the lower bounds and upper bounds. */
export function subtractInterval(interval1: IntervalDomain, interval2: IntervalDomain): IntervalDomain {
	if(interval1 === IntervalBottom || interval2 === IntervalBottom) {
		return IntervalBottom;
	} else {
		return [Math.max(interval1[0] - interval2[0], 0), Math.max(interval1[1] - interval2[1], 0)];
	}
}

/** Creates the minium of two abstract values of the positive interval domain, by creating the minimum of the lower bounds and upper bounds. */
export function minInterval(interval1: IntervalDomain, interval2: IntervalDomain): IntervalDomain {
	if(interval1 === IntervalBottom || interval2 === IntervalBottom) {
		return IntervalBottom;
	} else {
		return [Math.min(interval1[0], interval2[0]), Math.min(interval1[1], interval2[1])];
	}
}

/** Creates the maximum of two abstract values of the positive interval domain, by creating the maximum of the lower bounds and upper bounds. */
export function maxInterval(interval1: IntervalDomain, interval2: IntervalDomain): IntervalDomain {
	if(interval1 === IntervalBottom || interval2 === IntervalBottom) {
		return IntervalBottom;
	} else {
		return [Math.max(interval1[0], interval2[0]), Math.max(interval1[1], interval2[1])];
	}
}

/** Extrends the lower bound of an abstract value of the positive interval domain to 0. */
export function extendIntervalToZero(interval: IntervalDomain): IntervalDomain {
	if(interval === IntervalBottom) {
		return IntervalBottom;
	} else {
		return [0, interval[1]];
	}
}

/** Extrends the upper bound of an abstract value of the positive interval domain to infinity. */
export function extendIntervalToInfinity(interval: IntervalDomain): IntervalDomain {
	if(interval === IntervalBottom) {
		return IntervalBottom;
	} else {
		return [interval[0], Infinity];
	}
}

/** Widens two abstract values of the positive interval domain via naive widening to soundly over-approximate the join in (possibly infinite) fixpoint iterations. */
export function wideningInterval(interval1: IntervalDomain, interval2: IntervalDomain): IntervalDomain {
	if(interval1 === IntervalBottom) {
		return interval2;
	} else if(interval2 === IntervalBottom) {
		return interval1;
	} else {
		return [interval1[0] <= interval2[0] ? interval1[0] : 0, interval1[1] >= interval2[1] ? interval1[1] : Infinity];
	}
}

/** Checks if two abstract values of the data frame shape domain are equal. */
export function equalDataFrameDomain(value1: DataFrameDomain, value2: DataFrameDomain): boolean {
	return value1 === value2 || (equalColNames(value1.colnames, value2.colnames) && equalInterval(value1.cols, value2.cols) && equalInterval(value1.rows, value2.rows));
}

/** Joins multiple abstract values of the data frame shape domain by creating the least upper bound (LUB). */
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

/** Meets multiple abstract values of the data frame shape domain by creating the greatest lower bound (GLB). */
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

/** Widens two abstract values of the data frame shape domain by widening the column names and number of columns and rows. */
export function wideningDataFrames(value1: DataFrameDomain, value2: DataFrameDomain): DataFrameDomain {
	return {
		colnames: wideningColNames(value1.colnames, value2.colnames),
		cols:     wideningInterval(value1.cols, value2.cols),
		rows:     wideningInterval(value1.rows, value2.rows)
	};
}

/** Checks if two abstract states of the data frame shape state domain are equal. */
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

/** Joins multiple abstract states of the data frame shape state domain by joining each data frame shape of the states. */
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

/** Meets multiple abstract states of the data frame shape state domain by meeting each data frame shape of the states. */
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

/** Widens two abstract states of the data frame shape state domain by widening each data frame shape of the states. */
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
