import type { DataFrameDomain } from './domain';
import { addInterval, ColNamesTop, DataFrameTop, includeZeroInterval, IntervalTop, joinColNames, maxInterval, meetColNames, minInterval, subtractColNames, subtractInterval } from './domain';

export enum ConstraintType {
	/** The inferred constraints must hold for the operand at the point of the operation */
	OperandPrecondition,
	/** The inferred constraints are applied to the operand during the operation */
	OperandModification,
	/** The inferred constraints must hold for the returned result of the operation */
	ResultPostcondition
}

type DataFrameSemanticsApplier<Arguments extends object> = (
	value: DataFrameDomain,
	args: Arguments
) => DataFrameDomain;

type DataFrameSemanticsMapperInfo<Arguments extends object> = {
	readonly apply: DataFrameSemanticsApplier<Arguments>,
	readonly types: ConstraintType[]
}

const DataFrameSemanticsMapper = {
	'create':      { apply: applyCreateSemantics,      types: [ConstraintType.ResultPostcondition] },
	'accessCols':  { apply: applyAccessColsSemantics,  types: [ConstraintType.OperandPrecondition] },
	'accessRows':  { apply: applyAccessRowsSemantics,  types: [ConstraintType.OperandPrecondition] },
	'assignCols':  { apply: applyAssignColsSemantics,  types: [ConstraintType.OperandModification] },
	'assignRows':  { apply: applyAssignRowsSemantics,  types: [ConstraintType.OperandModification] },
	'setColNames': { apply: applySetColNamesSemantics, types: [ConstraintType.OperandModification] },
	'addCols':     { apply: applyAddColsSemantics,     types: [ConstraintType.ResultPostcondition] },
	'addRows':     { apply: applyAddRowsSemantics,     types: [ConstraintType.ResultPostcondition] },
	'removeCols':  { apply: applyRemoveColsSemantics,  types: [ConstraintType.ResultPostcondition] },
	'removeRows':  { apply: applyRemoveRowsSemantics,  types: [ConstraintType.ResultPostcondition] },
	'concatCols':  { apply: applyConcatColsSemantics,  types: [ConstraintType.ResultPostcondition] },
	'concatRows':  { apply: applyConcatRowsSemantics,  types: [ConstraintType.ResultPostcondition] },
	'subsetCols':  { apply: applySubsetColsSemantics,  types: [ConstraintType.ResultPostcondition] },
	'subsetRows':  { apply: applySubsetRowsSemantics,  types: [ConstraintType.ResultPostcondition] },
	'filterRows':  { apply: applyFilterRowsSemantics,  types: [ConstraintType.ResultPostcondition] },
	'identity':    { apply: applyIdentitySemantics,    types: [ConstraintType.ResultPostcondition] },
	'unknown':     { apply: applyUnknownSemantics,     types: [ConstraintType.ResultPostcondition] }
} as const satisfies Record<string, DataFrameSemanticsMapperInfo<never>>;

export type DataFrameOperationName = keyof typeof DataFrameSemanticsMapper;
export type DataFrameOperationArgs<N extends DataFrameOperationName> = Parameters<typeof DataFrameSemanticsMapper[N]['apply']>[1];

export function applySemantics<Name extends DataFrameOperationName>(
	operation: Name,
	value: DataFrameDomain,
	args: DataFrameOperationArgs<Name>
): DataFrameDomain {
	const applier = DataFrameSemanticsMapper[operation] as DataFrameSemanticsMapperInfo<DataFrameOperationArgs<Name>>;

	return applier.apply(value, args);
}

export function getConstraintTypes(operation: DataFrameOperationName): ConstraintType[] {
	return DataFrameSemanticsMapper[operation].types;
}

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
			cols:     addInterval(value.cols, [0, columns.length])
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
		cols:     IntervalTop
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
		rows: IntervalTop
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
		cols:     colnames !== undefined ? subtractInterval(value.cols, [colnames.length, colnames.length]) : includeZeroInterval(value.cols)
	};
}

function applyRemoveRowsSemantics(
	value: DataFrameDomain,
	{ rows }: { rows: number | undefined }
): DataFrameDomain {
	return {
		...value,
		rows: rows !== undefined ? subtractInterval(value.rows, [rows, rows]) : includeZeroInterval(value.rows)
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
		cols:     colnames !== undefined ? minInterval(value.cols, [colnames.length, colnames.length]) : value.cols
	};
}

function applySubsetRowsSemantics(
	value: DataFrameDomain,
	{ rows }: { rows: number | undefined }
): DataFrameDomain {
	return {
		...value,
		rows: rows !== undefined ? minInterval(value.rows, [rows, rows]) : value.rows
	};
}

function applyFilterRowsSemantics(
	value: DataFrameDomain,
	{ condition }: { condition: boolean | undefined }
): DataFrameDomain {
	return {
		...value,
		rows: condition ? value.rows : condition === false ? [0, 0] : includeZeroInterval(value.rows)
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
	_args: { creation?: boolean, modifyInplace?: boolean }
): DataFrameDomain {
	return DataFrameTop;
}
