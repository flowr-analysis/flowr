import { isNotUndefined } from '../../util/assert';
import type { DataFrameDomain } from './domain';
import { addInterval, ColNamesTop, DataFrameTop, extendIntervalToInfinity, extendIntervalToZero, IntervalBottom, IntervalTop, joinColNames, maxInterval, meetColNames, minInterval, subtractColNames, subtractInterval } from './domain';

export enum ConstraintType {
	/** The inferred constraints must hold for the operand at the point of the operation */
	OperandPrecondition,
	/** The inferred constraints are applied to the operand during the operation */
	OperandModification,
	/** The inferred constraints must hold for the returned result of the operation */
	ResultPostcondition
}

const DataFrameSemanticsMapper = {
	'create':      { apply: applyCreateSemantics,      type: ConstraintType.ResultPostcondition },
	'read':        { apply: applyReadSemantics,        type: ConstraintType.ResultPostcondition },
	'accessCols':  { apply: applyAccessColsSemantics,  type: ConstraintType.OperandPrecondition },
	'accessRows':  { apply: applyAccessRowsSemantics,  type: ConstraintType.OperandPrecondition },
	'assignCols':  { apply: applyAssignColsSemantics,  type: ConstraintType.OperandModification },
	'assignRows':  { apply: applyAssignRowsSemantics,  type: ConstraintType.OperandModification },
	'setColNames': { apply: applySetColNamesSemantics, type: ConstraintType.OperandModification },
	'addCols':     { apply: applyAddColsSemantics,     type: ConstraintType.ResultPostcondition },
	'addRows':     { apply: applyAddRowsSemantics,     type: ConstraintType.ResultPostcondition },
	'removeCols':  { apply: applyRemoveColsSemantics,  type: ConstraintType.ResultPostcondition },
	'removeRows':  { apply: applyRemoveRowsSemantics,  type: ConstraintType.ResultPostcondition },
	'concatCols':  { apply: applyConcatColsSemantics,  type: ConstraintType.ResultPostcondition },
	'concatRows':  { apply: applyConcatRowsSemantics,  type: ConstraintType.ResultPostcondition },
	'subsetCols':  { apply: applySubsetColsSemantics,  type: ConstraintType.ResultPostcondition },
	'subsetRows':  { apply: applySubsetRowsSemantics,  type: ConstraintType.ResultPostcondition },
	'filterRows':  { apply: applyFilterRowsSemantics,  type: ConstraintType.ResultPostcondition },
	'mutateCols':  { apply: applyMutateColsSemantics,  type: ConstraintType.ResultPostcondition },
	'groupBy':     { apply: applyGroupBySemantics,     type: ConstraintType.ResultPostcondition },
	'summarize':   { apply: applySummarizeSemantics,   type: ConstraintType.ResultPostcondition },
	'leftJoin':    { apply: applyLeftJoinSemantics,    type: ConstraintType.ResultPostcondition },
	'unknown':     { apply: applyUnknownSemantics,     type: ConstraintType.ResultPostcondition },
	'identity':    { apply: applyIdentitySemantics,    type: ConstraintType.ResultPostcondition }
} as const satisfies Record<string, DataFrameSemanticsMapperInfo<never, never>>;

type DataFrameSemanticsMapperInfo<Arguments extends object, Options extends object | undefined> = {
	readonly apply: DataFrameSemanticsApplier<Arguments, Options>,
	readonly type:  ConstraintType
}

type DataFrameSemanticsApplier<Arguments extends object, Options extends object | undefined> = (
	value: DataFrameDomain,
	args: Arguments,
	options?: Options
) => DataFrameDomain;

export type DataFrameOperationName = keyof typeof DataFrameSemanticsMapper;
export const DataFrameOperationNames = Object.keys(DataFrameSemanticsMapper) as DataFrameOperationName[];
export type DataFrameOperationArgs<N extends DataFrameOperationName> = Parameters<typeof DataFrameSemanticsMapper[N]['apply']>[1];
export type DataFrameOperationOptions<N extends DataFrameOperationName> = Parameters<typeof DataFrameSemanticsMapper[N]['apply']>[2];

export function applySemantics<Name extends DataFrameOperationName>(
	operation: Name,
	value: DataFrameDomain,
	args: DataFrameOperationArgs<Name>,
	options?: DataFrameOperationOptions<Name>
): DataFrameDomain {
	const applier = DataFrameSemanticsMapper[operation] as DataFrameSemanticsMapperInfo<DataFrameOperationArgs<Name>, DataFrameOperationOptions<Name>>;

	return applier.apply(value, args, options);
}

export function getConstraintType(operation: DataFrameOperationName): ConstraintType {
	return DataFrameSemanticsMapper[operation].type;
}

function applyCreateSemantics(
	value: DataFrameDomain,
	{ colnames, rows }: { colnames: (string | undefined)[] | undefined, rows: number | undefined }
): DataFrameDomain {
	const cols = colnames?.length;

	return {
		colnames: colnames?.every(isNotUndefined) ? colnames : ColNamesTop,
		cols:     cols !== undefined ? [cols, cols] : IntervalTop,
		rows:     rows !== undefined ? [rows, rows] : IntervalTop
	};
}

function applyReadSemantics(
	value: DataFrameDomain,
	{ colnames, rows }: { source: string | undefined, colnames: (string | undefined)[] | undefined, rows: number | undefined }
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
		const cols = columns.length;

		return {
			...value,
			colnames: joinColNames(value.colnames, columns),
			cols:     maxInterval(addInterval(value.cols, [0, cols]), [cols, cols])
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
	{ colnames }: { colnames: (string | undefined)[] | undefined },
	options?: { partial?: boolean }
): DataFrameDomain {
	if(options?.partial) {
		return {
			...value,
			colnames: colnames?.every(isNotUndefined) ? joinColNames(value.colnames, colnames) : ColNamesTop,
		};
	}
	const cols = colnames?.length;
	const allColNames = value.cols != IntervalBottom && cols !== undefined && cols >= value.cols[1];

	return {
		...value,
		colnames: allColNames && colnames?.every(isNotUndefined) ? colnames : ColNamesTop,
	};
}

function applyAddColsSemantics(
	value: DataFrameDomain,
	{ colnames }: { colnames: (string | undefined)[] | undefined }
): DataFrameDomain {
	const cols = colnames?.length;

	return {
		...value,
		colnames: colnames?.every(isNotUndefined) ? joinColNames(value.colnames, colnames) : ColNamesTop,
		cols:     cols !== undefined ? addInterval(value.cols, [cols, cols]) : extendIntervalToInfinity(value.cols)
	};
}

function applyAddRowsSemantics(
	value: DataFrameDomain,
	{ rows }: { rows: number | undefined }
): DataFrameDomain {
	return {
		...value,
		rows: rows !== undefined ? addInterval(value.rows, [rows, rows]) : extendIntervalToInfinity(value.rows)
	};
}

function applyRemoveColsSemantics(
	value: DataFrameDomain,
	{ colnames }: { colnames: (string | undefined)[] | undefined },
	options?: { maybe?: boolean }
): DataFrameDomain {
	const cols = colnames?.length;

	if(options?.maybe) {
		return {
			...value,
			colnames: colnames !== undefined ? subtractColNames(value.colnames, colnames.filter(col => col !== undefined)) : value.colnames,
			cols:     cols !== undefined ? subtractInterval(value.cols, [cols, 0]) : extendIntervalToZero(value.cols)
		};
	}
	return {
		...value,
		colnames: colnames !== undefined ? subtractColNames(value.colnames, colnames.filter(isNotUndefined)) : value.colnames,
		cols:     cols !== undefined ? subtractInterval(value.cols, [cols, cols]) : extendIntervalToZero(value.cols)
	};
}

function applyRemoveRowsSemantics(
	value: DataFrameDomain,
	{ rows }: { rows: number | undefined },
	options?: { maybe?: boolean }
): DataFrameDomain {
	if(options?.maybe) {
		return {
			...value,
			cols: rows !== undefined ? subtractInterval(value.cols, [rows, 0]) : extendIntervalToZero(value.cols)
		};
	}
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
	{ colnames }: { colnames: (string | undefined)[] | undefined },
	options?: { duplicateCols: boolean }
): DataFrameDomain {
	const cols = colnames?.length;

	if(options?.duplicateCols) {
		return {
			...value,
			colnames: ColNamesTop,
			cols:     cols !== undefined ? [cols, cols] : IntervalTop
		};
	}
	return {
		...value,
		colnames: colnames?.every(isNotUndefined) ? meetColNames(value.colnames, colnames) : value.colnames,
		cols:     cols !== undefined ? minInterval(value.cols, [cols, cols]) : extendIntervalToZero(value.cols)
	};
}

function applySubsetRowsSemantics(
	value: DataFrameDomain,
	{ rows }: { rows: number | undefined },
	options?: { duplicateRows: boolean }
): DataFrameDomain {
	if(options?.duplicateRows) {
		return {
			...value,
			rows: rows !== undefined ? [rows, rows] : IntervalTop
		};
	}
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
	const cols = colnames?.length;

	return {
		...value,
		colnames: colnames?.every(isNotUndefined) ? joinColNames(value.colnames, colnames) : ColNamesTop,
		cols:     cols !== undefined ? maxInterval(addInterval(value.cols, [0, cols]), [cols, cols]): extendIntervalToInfinity(value.cols)
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
	const cols = colnames?.length;

	return {
		...value,
		colnames: colnames?.every(isNotUndefined) ? joinColNames(value.colnames, colnames) : ColNamesTop,
		cols:     cols !== undefined ? minInterval(addInterval(value.cols, [0, cols]), [cols, Infinity]) : extendIntervalToInfinity(value.rows),
		rows:     maxInterval(minInterval(value.rows, [1, Infinity]), [1, 1])
	};
}

function applyLeftJoinSemantics(
	value: DataFrameDomain,
	{ other }: { other: DataFrameDomain, by: string | undefined },
	options?: { minRows?: boolean }
): DataFrameDomain {
	return {
		...value,
		colnames: joinColNames(value.colnames, other.colnames),
		cols:     subtractInterval(addInterval(value.cols, other.cols), [1, 1]),
		rows:     options?.minRows ? minInterval(value.rows, other.rows) : value.rows
	};
}

function applyIdentitySemantics(
	value: DataFrameDomain,
	// eslint-disable-next-line @typescript-eslint/no-empty-object-type
	_args: {}
): DataFrameDomain {
	return value;
}

function applyUnknownSemantics(
	_value: DataFrameDomain,
	// eslint-disable-next-line @typescript-eslint/no-empty-object-type
	_args: {}
): DataFrameDomain {
	return DataFrameTop;
}
