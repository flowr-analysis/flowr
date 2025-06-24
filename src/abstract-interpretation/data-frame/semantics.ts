import type { DataFrameDomain } from './domain';
import { addInterval, ColNamesTop, DataFrameTop, extendIntervalToInfinity, extendIntervalToZero, IntervalTop, joinColNames, maxInterval, meetColNames, minInterval, subtractColNames, subtractInterval } from './domain';

export enum ConstraintType {
	/** The inferred constraints must hold for the operand at the point of the operation */
	OperandPrecondition,
	/** The inferred constraints are applied to the operand during the operation */
	OperandModification,
	/** The inferred constraints must hold for the returned result of the operation */
	ResultPostcondition
}

const DataFrameSemanticsMapper = {
	'create':        { apply: applyCreateSemantics,      type: ConstraintType.ResultPostcondition },
	'read':          { apply: applyReadSemantics,        type: ConstraintType.ResultPostcondition },
	'accessCols':    { apply: applyAccessColsSemantics,  type: ConstraintType.OperandPrecondition },
	'accessRows':    { apply: applyAccessRowsSemantics,  type: ConstraintType.OperandPrecondition },
	'assignCols':    { apply: applyAssignColsSemantics,  type: ConstraintType.OperandModification },
	'assignRows':    { apply: applyAssignRowsSemantics,  type: ConstraintType.OperandModification },
	'setColNames':   { apply: applySetColNamesSemantics, type: ConstraintType.OperandModification },
	'unknownModify': { apply: applyUnknownSemantics,     type: ConstraintType.OperandModification },
	'addCols':       { apply: applyAddColsSemantics,     type: ConstraintType.ResultPostcondition },
	'addRows':       { apply: applyAddRowsSemantics,     type: ConstraintType.ResultPostcondition },
	'removeCols':    { apply: applyRemoveColsSemantics,  type: ConstraintType.ResultPostcondition },
	'removeRows':    { apply: applyRemoveRowsSemantics,  type: ConstraintType.ResultPostcondition },
	'concatCols':    { apply: applyConcatColsSemantics,  type: ConstraintType.ResultPostcondition },
	'concatRows':    { apply: applyConcatRowsSemantics,  type: ConstraintType.ResultPostcondition },
	'subsetCols':    { apply: applySubsetColsSemantics,  type: ConstraintType.ResultPostcondition },
	'subsetRows':    { apply: applySubsetRowsSemantics,  type: ConstraintType.ResultPostcondition },
	'filterRows':    { apply: applyFilterRowsSemantics,  type: ConstraintType.ResultPostcondition },
	'mutateCols':    { apply: applyMutateColsSemantics,  type: ConstraintType.ResultPostcondition },
	'groupBy':       { apply: applyGroupBySemantics,     type: ConstraintType.ResultPostcondition },
	'summarize':     { apply: applySummarizeSemantics,   type: ConstraintType.ResultPostcondition },
	'leftJoin':      { apply: applyLeftJoinSemantics,    type: ConstraintType.ResultPostcondition },
	'unknown':       { apply: applyUnknownSemantics,     type: ConstraintType.ResultPostcondition },
	'identity':      { apply: applyIdentitySemantics,    type: ConstraintType.ResultPostcondition }
} as const satisfies Record<string, DataFrameSemanticsMapperInfo<never>>;

type DataFrameSemanticsMapperInfo<Arguments extends object> = {
	readonly apply: DataFrameSemanticsApplier<Arguments>,
	readonly type:  ConstraintType
}

type DataFrameSemanticsApplier<Arguments extends object> = (
	value: DataFrameDomain,
	args: Arguments
) => DataFrameDomain;

export type DataFrameOperationName = keyof typeof DataFrameSemanticsMapper;
export const DataFrameOperationNames = Object.keys(DataFrameSemanticsMapper) as DataFrameOperationName[];
export type DataFrameOperationArgs<N extends DataFrameOperationName> = Parameters<typeof DataFrameSemanticsMapper[N]['apply']>[1];

export function applySemantics<Name extends DataFrameOperationName>(
	operation: Name,
	value: DataFrameDomain,
	args: DataFrameOperationArgs<Name>
): DataFrameDomain {
	const applier = DataFrameSemanticsMapper[operation] as DataFrameSemanticsMapperInfo<DataFrameOperationArgs<Name>>;

	return applier.apply(value, args);
}

export function getConstraintType(operation: DataFrameOperationName): ConstraintType {
	return DataFrameSemanticsMapper[operation].type;
}

function applyCreateSemantics(
	value: DataFrameDomain,
	{ colnames, rows }: { colnames: (string | undefined)[] | undefined, rows: number | undefined }
): DataFrameDomain {
	return {
		colnames: colnames?.every(name => name !== undefined) ? colnames : ColNamesTop,
		cols:     colnames ? [colnames.length, colnames.length] : IntervalTop,
		rows:     rows !== undefined ? [rows, rows] : IntervalTop
	};
}

function applyReadSemantics(
	value: DataFrameDomain,
	{ colnames, rows }: { file: string | undefined, colnames: (string | undefined)[] | undefined, rows: number | undefined }
): DataFrameDomain {
	return applyCreateSemantics(value, { colnames, rows });
}

function applyAccessColsSemantics(
	value: DataFrameDomain,
	{ columns }: { columns: string[] | number[] | undefined }
): DataFrameDomain {
	if(columns?.every(col => typeof col === 'string')) {
		return {
			...value,
			colnames: joinColNames(value.colnames, columns)
		};
	} else if(columns?.every(col => typeof col === 'number')) {
		return {
			...value,
			cols: columns.reduce((a, b) => maxInterval(a, [b, b]), value.cols)
		};
	}
	return value;
}

function applyAccessRowsSemantics(
	value: DataFrameDomain,
	{ rows }: { rows: number[] | undefined }
): DataFrameDomain {
	if(rows !== undefined) {
		return {
			...value,
			rows: rows.reduce((a, b) => maxInterval(a, [b, b]), value.rows)
		};
	}
	return value;
}

function applyAssignColsSemantics(
	value: DataFrameDomain,
	{ columns }: { columns: string[] | number[] | undefined }
): DataFrameDomain {
	if(columns?.every(col => typeof col === 'string')) {
		return {
			...value,
			colnames: joinColNames(value.colnames, columns),
			cols:     maxInterval(addInterval(value.cols, [0, columns.length]), [columns.length, columns.length])
		};
	} else if(columns?.every(col => typeof col === 'number')) {
		return {
			...value,
			colnames: ColNamesTop,
			cols:     columns.reduce((a, b) => maxInterval(a, [b, b]), value.cols)
		};
	}
	return {
		...value,
		colnames: ColNamesTop,
		cols:     extendIntervalToInfinity(value.cols)
	};
}

function applyAssignRowsSemantics(
	value: DataFrameDomain,
	{ rows }: { rows: number[] | undefined }
): DataFrameDomain {
	if(rows !== undefined) {
		return {
			...value,
			rows: rows.reduce((a, b) => maxInterval(a, [b, b]), value.rows)
		};
	}
	return {
		...value,
		rows: extendIntervalToInfinity(value.rows)
	};
}

function applySetColNamesSemantics(
	value: DataFrameDomain,
	{ colnames }: { colnames: (string | undefined)[] | undefined }
): DataFrameDomain {
	return {
		...value,
		colnames: colnames?.every(name => name !== undefined) ? colnames : ColNamesTop,
	};
}

function applyAddColsSemantics(
	value: DataFrameDomain,
	{ colnames }: { colnames: (string | undefined)[] | undefined }
): DataFrameDomain {
	return {
		...value,
		colnames: colnames?.every(col => col !== undefined) ? joinColNames(value.colnames, colnames) : ColNamesTop,
		cols:     colnames !== undefined ? addInterval(value.cols, [colnames.length, colnames.length]) : IntervalTop
	};
}

function applyAddRowsSemantics(
	value: DataFrameDomain,
	{ rows }: { rows: number | undefined }
): DataFrameDomain {
	return {
		...value,
		rows: rows !== undefined ? addInterval(value.rows, [rows, rows]) : IntervalTop
	};
}

function applyRemoveColsSemantics(
	value: DataFrameDomain,
	{ colnames }: { colnames: (string | undefined)[] | undefined }
): DataFrameDomain {
	return {
		...value,
		colnames: colnames !== undefined ? subtractColNames(value.colnames, colnames.filter(col => col !== undefined)) : value.colnames,
		cols:     colnames !== undefined ? subtractInterval(value.cols, [colnames.length, colnames.length]) : extendIntervalToZero(value.cols)
	};
}

function applyRemoveRowsSemantics(
	value: DataFrameDomain,
	{ rows }: { rows: number | undefined }
): DataFrameDomain {
	return {
		...value,
		rows: rows !== undefined ? subtractInterval(value.rows, [rows, rows]) : extendIntervalToZero(value.rows)
	};
}

function applyConcatColsSemantics(
	value: DataFrameDomain,
	{ other }: { other: DataFrameDomain }
): DataFrameDomain {
	return {
		...value,
		colnames: joinColNames(value.colnames, other.colnames),
		cols:     addInterval(value.cols, other.cols)
	};
}

function applyConcatRowsSemantics(
	value: DataFrameDomain,
	{ other }: { other: DataFrameDomain }
): DataFrameDomain {
	return {
		...value,
		rows: addInterval(value.rows, other.rows)
	};
}

function applySubsetColsSemantics(
	value: DataFrameDomain,
	{ colnames }: { colnames: (string | undefined)[] | undefined }
): DataFrameDomain {
	return {
		...value,
		colnames: colnames?.every(col => col !== undefined) ? meetColNames(value.colnames, colnames) : value.colnames,
		cols:     colnames !== undefined ? minInterval(value.cols, [colnames.length, colnames.length]) : extendIntervalToZero(value.cols)
	};
}

function applySubsetRowsSemantics(
	value: DataFrameDomain,
	{ rows }: { rows: number | undefined }
): DataFrameDomain {
	return {
		...value,
		rows: rows !== undefined ? minInterval(value.rows, [rows, rows]) : extendIntervalToZero(value.rows)
	};
}

function applyFilterRowsSemantics(
	value: DataFrameDomain,
	{ condition }: { condition: boolean | undefined }
): DataFrameDomain {
	return {
		...value,
		rows: condition ? value.rows : condition === false ? [0, 0] : extendIntervalToZero(value.rows)
	};
}

function applyMutateColsSemantics(
	value: DataFrameDomain,
	{ colnames }: { colnames: (string | undefined)[] | undefined }
): DataFrameDomain {
	return {
		...value,
		colnames: colnames?.every(col => col !== undefined) ? joinColNames(value.colnames, colnames) : ColNamesTop,
		cols:     colnames !== undefined ? maxInterval(addInterval(value.cols, [0, colnames.length]), [colnames.length, colnames.length]): extendIntervalToInfinity(value.rows)
	};
}

function applyGroupBySemantics(
	value: DataFrameDomain,
	_args: { by: string | undefined }
): DataFrameDomain {
	return {
		...value,
		rows: extendIntervalToZero(value.rows)
	};
}

function applySummarizeSemantics(
	value: DataFrameDomain,
	{ colnames }: { colnames: (string | undefined)[] | undefined }
): DataFrameDomain {
	return {
		...value,
		colnames: colnames?.every(col => col !== undefined) ? joinColNames(value.colnames, colnames) : ColNamesTop,
		cols:     colnames !== undefined ? minInterval(addInterval(value.cols, [0, colnames.length]), [colnames.length, Infinity]) : extendIntervalToInfinity(value.rows),
		rows:     maxInterval(minInterval(value.rows, [1, Infinity]), [1, 1])
	};
}

function applyLeftJoinSemantics(
	value: DataFrameDomain,
	{ other, minRows }: { other: DataFrameDomain, by: string | undefined, minRows?: boolean }
): DataFrameDomain {
	return {
		...value,
		colnames: joinColNames(value.colnames, other.colnames),
		cols:     subtractInterval(addInterval(value.cols, other.cols), [1, 1]),
		rows:     minRows ? minInterval(value.rows, other.rows) : value.rows
	};
}

function applyIdentitySemantics(
	value: DataFrameDomain,
	_args: Record<string, never>
): DataFrameDomain {
	return value;
}

function applyUnknownSemantics(
	_value: DataFrameDomain,
	_args: Record<string, never>
): DataFrameDomain {
	return DataFrameTop;
}
