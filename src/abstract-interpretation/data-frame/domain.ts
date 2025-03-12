type Interval = [number, number];
export type IntervalDomain = Interval | 'bottom';

export const IntervalBottom: IntervalDomain = 'bottom';
export const IntervalTop: IntervalDomain = [0, Infinity];

export type ColNamesDomain = string[] | 'top';

export const ColNamesBottom: ColNamesDomain = [];
export const ColNamesTop: ColNamesDomain = 'top';

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

export function joinInterval(X1: Interval, X2: Interval): IntervalDomain {
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

export function meetInterval(X1: Interval, X2: Interval): IntervalDomain {
	if(X1 === IntervalBottom || X2 === IntervalBottom) {
		return IntervalBottom;
	} else if(Math.max(X1[0], X2[0]) > Math.min(X1[1], X2[1])) {
		return IntervalBottom;
	} else {
		return [Math.max(X1[0], X2[0]), Math.min(X1[1], X2[1])];
	}
}
