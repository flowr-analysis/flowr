import { assertUnreachable, isNotUndefined } from '../../util/assert';
import type { DataFrameDomain, IntervalDomain } from './domain';
import { addInterval, ColNamesTop, DataFrameTop, extendIntervalToInfinity, extendIntervalToZero, IntervalBottom, IntervalTop, joinColNames, joinInterval, maxInterval, meetColNames, minInterval, subtractColNames, subtractInterval } from './domain';

/**
 * Represents the different types of resulting constraints that are inferred by abstract data frame operations.
 */
export enum ConstraintType {
	/** The inferred constraints must hold for the operand at the point of the operation */
	OperandPrecondition,
	/** The inferred constraints are applied to the operand during the operation */
	OperandModification,
	/** The inferred constraints must hold for the returned result of the operation */
	ResultPostcondition
}

/**
 * Mapper for defining the abstract data frame operations and mapping them to semantics applier functions,
 * including information about the type of the resulting constraints that are inferred by the operation.
 */
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
	'join':        { apply: applyJoinSemantics,        type: ConstraintType.ResultPostcondition },
	'unknown':     { apply: applyUnknownSemantics,     type: ConstraintType.ResultPostcondition },
	'identity':    { apply: applyIdentitySemantics,    type: ConstraintType.ResultPostcondition }
} as const satisfies Record<string, DataFrameSemanticsMapperInfo<never, never>>;

type DataFrameSemanticsMapperInfo<Arguments extends object, Options extends object | undefined> = {
	readonly apply: DataFrameSemanticsApplier<Arguments, Options>,
	readonly type:  ConstraintType
}

/**
 * Data frame semantics applier for applying the abstract semantics of an abstract data frame operation with respect to the data frame shape domain.
 * - `value` contains the abstract data frame shape of operand of the abstract operation
 * - `args` contains the arguments required for the abstract operation
 * - `options` optionally contains additional options to change the behavior or the abstract operation
 */
type DataFrameSemanticsApplier<Arguments extends object, Options extends object | undefined> = (
	value: DataFrameDomain,
	args: Arguments,
	options?: Options
) => DataFrameDomain;

/** All available abstract data frame operations */
export type DataFrameOperationName = keyof typeof DataFrameSemanticsMapper;

/** The names of all abstract data frame operations */
export const DataFrameOperationNames = Object.keys(DataFrameSemanticsMapper) as DataFrameOperationName[];

/** The required arguments for an abstract data frame operation */
export type DataFrameOperationArgs<N extends DataFrameOperationName> = Parameters<typeof DataFrameSemanticsMapper[N]['apply']>[1];

/** The optional addition options for an abstract data frame operation */
export type DataFrameOperationOptions<N extends DataFrameOperationName> = Parameters<typeof DataFrameSemanticsMapper[N]['apply']>[2];

/**
 * Applies the abstract semantics of an abstract data frame operation with respect to the data frame shape domain.
 * This expects that all arguments have already been sanitized according to the original concrete data frame function (e.g. by replacing duplicate/invalid column names).
 *
 * @param operation - The name of the abstract operation to apply the semantics of
 * @param value     - The abstract data frame shape of the operand of the abstract operation
 * @param args      - The arguments for applying the abstract semantics of the abstract operation
 * @param options   - The optional additional options of the abstract operation
 * @returns The resulting new data frame shape constraints.
 * The semantic type of the resulting constraints depends on the {@link ConstraintType} of the abstract operation.
 */
export function applySemantics<Name extends DataFrameOperationName>(
	operation: Name,
	value: DataFrameDomain,
	args: DataFrameOperationArgs<Name>,
	options?: DataFrameOperationOptions<Name>
): DataFrameDomain {
	const applier = DataFrameSemanticsMapper[operation] as DataFrameSemanticsMapperInfo<DataFrameOperationArgs<Name>, DataFrameOperationOptions<Name>>;

	return applier.apply(value, args, options);
}

/**
 * Gets the default resulting constraint type for an abstract data frame operation.
 */
export function getConstraintType(operation: DataFrameOperationName): ConstraintType {
	return DataFrameSemanticsMapper[operation].type;
}

function applyCreateSemantics(
	value: DataFrameDomain,
	{ colnames, rows }: { colnames: (string | undefined)[] | undefined, rows: number | [number, number] | undefined }
): DataFrameDomain {
	const cols = colnames?.length;

	return {
		colnames: colnames?.every(isNotUndefined) ? colnames : ColNamesTop,
		cols:     cols !== undefined ? [cols, cols] : IntervalTop,
		rows:     Array.isArray(rows) ? rows : typeof rows === 'number' ? [rows, rows] : IntervalTop
	};
}

function applyReadSemantics(
	value: DataFrameDomain,
	{ colnames, rows }: { source: string | undefined, colnames: (string | undefined)[] | undefined, rows: number | [number, number] | undefined }
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
	const allColNames = value.cols !== IntervalBottom && cols !== undefined && cols >= value.cols[1];

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
			colnames: colnames !== undefined ? subtractColNames(value.colnames, colnames.filter(isNotUndefined)) : value.colnames,
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
	if(value.cols !== IntervalBottom && value.cols[0] === 0) {
		return {
			...value,
			colnames: joinColNames(value.colnames, other.colnames),
			cols:     joinInterval(value.cols, other.cols),
			rows:     addInterval(value.rows, other.rows)
		};
	}
	return {
		...value,
		rows: addInterval(value.rows, other.rows)
	};
}

function applySubsetColsSemantics(
	value: DataFrameDomain,
	{ colnames }: { colnames: (string | undefined)[] | undefined },
	options?: { duplicateCols?: boolean, renamedCols?: boolean }
): DataFrameDomain {
	const cols = colnames?.length;

	if(options?.duplicateCols) {
		return {
			...value,
			colnames: ColNamesTop,
			cols:     cols !== undefined ? [cols, cols] : IntervalTop
		};
	} else if(options?.renamedCols) {
		return {
			...value,
			colnames: ColNamesTop,
			cols:     cols !== undefined ? minInterval(value.cols, [cols, cols]) : extendIntervalToZero(value.cols)
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
	options?: { duplicateRows?: boolean }
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
	{ by }: { by: (string | undefined)[] },
	options?: { mutatedCols?: boolean }
): DataFrameDomain {
	if(options?.mutatedCols) {
		return {
			...value,
			colnames: by.every(isNotUndefined) ? joinColNames(value.colnames, by) : ColNamesTop,
			cols:     addInterval(value.cols, [0, by.length]),
			rows:     extendIntervalToZero(value.rows)
		};
	}
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

function applyJoinSemantics(
	value: DataFrameDomain,
	{ other, by }: { other: DataFrameDomain, by: (string | undefined)[] | undefined },
	options?: { join?: 'inner' | 'left' | 'right' | 'full', natural?: boolean }
): DataFrameDomain {
	// Merge two intervals by creating the maximum of the lower bounds and adding the upper bounds
	const mergeInterval = (interval1: IntervalDomain, interval2: IntervalDomain): IntervalDomain => {
		if(interval1 === IntervalBottom || interval2 === IntervalBottom) {
			return IntervalBottom;
		} else {
			return [Math.max(interval1[0], interval2[0]), interval1[1] + interval2[1]];
		}
	};
	// Creating the Cartesian product of two intervals by keeping the lower bound and multiplying the upper bounds
	const productInterval = (lower: IntervalDomain, interval1: IntervalDomain, interval2: IntervalDomain): IntervalDomain => {
		if(lower === IntervalBottom || interval1 === IntervalBottom || interval2 === IntervalBottom) {
			return IntervalBottom;
		} else {
			return [lower[0], interval1[1] * interval2[1]];
		}
	};
	const commonCols = meetColNames(value.colnames, other.colnames);
	let duplicateCols: boolean;  // whether columns may be renamed due to occurance in both data frames
	let productRows: boolean;  // whether the resulting rows may be a Cartesian product of the rows of the data frames

	if(options?.natural) {
		duplicateCols = false;
		productRows = commonCols !== ColNamesTop && commonCols.length === 0;
	} else if(by === undefined) {
		duplicateCols = true;
		productRows = true;
	} else if(by.length === 0) {
		duplicateCols = commonCols === ColNamesTop || commonCols.length > 0;
		productRows = true;
	} else if(by.every(isNotUndefined)) {
		const remainingCols = subtractColNames(commonCols, by);
		duplicateCols = remainingCols === ColNamesTop || remainingCols.length > 0;
		productRows = false;
	} else {
		duplicateCols = true;
		productRows = false;
	}
	const joinType = options?.join ?? 'inner';
	let rows: IntervalDomain;

	switch(joinType) {
		case 'inner':
			rows = extendIntervalToZero(minInterval(value.rows, other.rows));
			break;
		case 'left':
			rows = value.rows;
			break;
		case 'right':
			rows = other.rows;
			break;
		case 'full':
			rows = mergeInterval(value.rows, other.rows);
			break;
		default:
			assertUnreachable(joinType);
	}
	const byCols = by?.length;

	return {
		...value,
		colnames: duplicateCols ? ColNamesTop : joinColNames(value.colnames, other.colnames),
		cols:     byCols !== undefined ? subtractInterval(addInterval(value.cols, other.cols), [byCols, byCols]) : mergeInterval(value.cols, other.cols),
		rows:     productRows ? productInterval(rows, value.rows, other.rows) : rows
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
