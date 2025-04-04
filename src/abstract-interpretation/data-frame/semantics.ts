import type { DataFrameDomain } from './domain';
import { ColNamesTop, IntervalTop, joinColNames, DataFrameTop, joinInterval } from './domain';

export const DataFrameSemanticsMapper = {
	'create':      applyCreateSemantics,
	'setColNames': applySetColNamesSemantics,
	'accessCol':   applyAccessColSemantics,
	'assignCol':   applyAssignColSemantics,
	'accessRow':   applyAccessRowSemantics,
	'assignRow':   applyAssignRowSemantics,
	'identity':    applyIdentitySemantics,
	'unknown':     applyUnknownSemantics
} as const satisfies Record<string, DataFrameSemanticsApplier<never>>;

export type DataFrameOperationName = keyof typeof DataFrameSemanticsMapper;
export type DataFrameOperationArgs<N extends DataFrameOperationName> = Parameters<typeof DataFrameSemanticsMapper[N]>[1];

type DataFrameSemanticsApplier<Arguments extends object> = (
	value: DataFrameDomain,
	args: Arguments
) => DataFrameDomain;

function applyCreateSemantics(
	value: DataFrameDomain,
	{ colnames, rows }: { colnames: (string | undefined)[], rows: number | undefined }
): DataFrameDomain {
	return {
		colnames: colnames.every(name => name !== undefined) ? colnames : ColNamesTop,
		cols:     [colnames.length, colnames.length],
		rows:     rows !== undefined ? [rows, rows] : IntervalTop
	};
}

function applySetColNamesSemantics(
	value: DataFrameDomain,
	{ colnames }: { colnames: (string | undefined)[] | undefined }
): DataFrameDomain {
	return {
		...value,
		colnames: colnames?.every(name => name !== undefined) ? colnames : ColNamesTop,
		cols:     colnames !== undefined ? [colnames.length, colnames.length] : IntervalTop
	};
}

function applyAccessColSemantics(
	value: DataFrameDomain,
	{ column }: { column: string | number | undefined }
): DataFrameDomain {
	if(typeof column === 'string') {
		return {
			...value,
			colnames: joinColNames(value.colnames, [column])
		};
	} else if(typeof column === 'number') {
		return {
			...value,
			cols: joinInterval(value.cols, [column, column])
		};
	}
	return value;
}

function applyAssignColSemantics(
	value: DataFrameDomain,
	{ column }: { column: string | number | undefined }
): DataFrameDomain {
	if(typeof column === 'string') {
		return {
			...value,
			colnames: joinColNames(value.colnames, [column])
		};
	} else if(typeof column === 'number') {
		return {
			...value,
			cols: joinInterval(value.cols, [column, column])
		};
	}
	return {
		...value,
		colnames: ColNamesTop,
		cols:     IntervalTop
	};
}

function applyAccessRowSemantics(
	value: DataFrameDomain,
	{ row }: { row: number | undefined }
): DataFrameDomain {
	if(typeof row === 'number') {
		return {
			...value,
			rows: joinInterval(value.rows, [row, row])
		};
	}
	return value;
}

function applyAssignRowSemantics(
	value: DataFrameDomain,
	{ row }: { row: number | undefined }
): DataFrameDomain {
	if(typeof row === 'number') {
		return {
			...value,
			rows: joinInterval(value.rows, [row, row])
		};
	}
	return {
		...value,
		rows: IntervalTop
	};
}

function applyIdentitySemantics(value: DataFrameDomain): DataFrameDomain {
	return value;
}

function applyUnknownSemantics(): DataFrameDomain {
	return DataFrameTop;
}
