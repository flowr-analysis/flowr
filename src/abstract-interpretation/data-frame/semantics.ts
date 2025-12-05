import { assertUnreachable, isNotUndefined } from '../../util/assert';
import { Bottom, Top } from '../domains/lattice';
import { PosIntervalDomain, PosIntervalTop } from '../domains/positive-interval-domain';
import type { ArrayRangeValue } from '../domains/set-range-domain';
import { DataFrameDomain } from './dataframe-domain';

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
export const DataFrameOperationNames = Object.keys(DataFrameSemanticsMapper) as readonly DataFrameOperationName[];

/** The required arguments for an abstract data frame operation */
export type DataFrameOperationArgs<N extends DataFrameOperationName> = Parameters<typeof DataFrameSemanticsMapper[N]['apply']>[1];

/** The optional addition options for an abstract data frame operation */
export type DataFrameOperationOptions<N extends DataFrameOperationName> = Parameters<typeof DataFrameSemanticsMapper[N]['apply']>[2];

/**
 * Applies the abstract semantics of an abstract data frame operation with respect to the data frame shape domain.
 * This expects that all arguments have already been sanitized according to the original concrete data frame function (e.g. by replacing duplicate/invalid column names).
 * @param operation - The name of the abstract operation to apply the semantics of
 * @param value     - The abstract data frame shape of the operand of the abstract operation
 * @param args      - The arguments for applying the abstract semantics of the abstract operation
 * @param options   - The optional additional options of the abstract operation
 * @returns The resulting new data frame shape constraints.
 * The semantic type of the resulting constraints depends on the {@link ConstraintType} of the abstract operation.
 */
export function applyDataFrameSemantics<Name extends DataFrameOperationName>(
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
	const colnamesValue = setRange(colnames);
	const colsValue = colnames !== undefined ? [colnames.length, colnames.length] as const : PosIntervalTop;
	const rowsValue = Array.isArray(rows) ? rows : typeof rows === 'number' ? [rows, rows] as const : PosIntervalTop;

	return new DataFrameDomain({
		colnames: value.colnames.create(colnamesValue),
		cols:     value.cols.create(colsValue),
		rows:     value.rows.create(rowsValue)
	});
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
		return new DataFrameDomain({
			colnames: value.colnames.union(setRange(columns)),
			cols:     value.cols,
			rows:     value.rows
		});
	} else if(columns?.every(col => typeof col === 'number')) {
		return new DataFrameDomain({
			colnames: value.colnames,
			cols:     columns.reduce((current, col) => current.max([col, col]), value.cols),
			rows:     value.rows
		});
	}
	return value;
}

function applyAccessRowsSemantics(
	value: DataFrameDomain,
	{ rows }: { rows: number[] | undefined }
): DataFrameDomain {
	if(rows !== undefined) {
		return new DataFrameDomain({
			colnames: value.colnames,
			cols:     value.cols,
			rows:     rows.reduce((current, row) => current.max([row, row]), value.rows)
		});
	}
	return value;
}

function applyAssignColsSemantics(
	value: DataFrameDomain,
	{ columns }: { columns: string[] | number[] | undefined }
): DataFrameDomain {
	if(columns?.every(col => typeof col === 'string')) {
		const cols = columns.length;

		return new DataFrameDomain({
			colnames: value.colnames.union(setRange(columns)),
			cols:     value.cols.add([0, cols]).max([cols, cols]),
			rows:     value.rows
		});
	} else if(columns?.every(col => typeof col === 'number')) {
		return new DataFrameDomain({
			colnames: value.colnames.widenUp(),
			cols:     columns.reduce((current, col) => current.max([col, col]), value.cols),
			rows:     value.rows
		});
	}
	return new DataFrameDomain({
		colnames: value.colnames.widenUp(),
		cols:     value.cols.widenUp(),
		rows:     value.rows
	});
}

function applyAssignRowsSemantics(
	value: DataFrameDomain,
	{ rows }: { rows: number[] | undefined }
): DataFrameDomain {
	if(rows !== undefined) {
		return new DataFrameDomain({
			colnames: value.colnames,
			cols:     value.cols,
			rows:     rows.reduce((current, row) => current.max([row, row]), value.rows)
		});
	}
	return new DataFrameDomain({
		colnames: value.colnames,
		cols:     value.cols,
		rows:     value.rows.widenUp()
	});
}

function applySetColNamesSemantics(
	value: DataFrameDomain,
	{ colnames }: { colnames: (string | undefined)[] | undefined },
	options?: { partial?: boolean }
): DataFrameDomain {
	if(options?.partial) {
		return new DataFrameDomain({
			colnames: value.colnames.widenDown().union(setRange(colnames)),
			cols:     value.cols,
			rows:     value.rows
		});
	}
	const allColNames = colnames?.every(isNotUndefined) && value.cols.value !== Bottom && colnames.length >= value.cols.value[1];

	return new DataFrameDomain({
		colnames: allColNames ? value.colnames.create(setRange(colnames)) : value.colnames.widenDown().union(setRange(colnames)).widenUp(),
		cols:     value.cols,
		rows:     value.rows
	});
}

function applyAddColsSemantics(
	value: DataFrameDomain,
	{ colnames }: { colnames: (string | undefined)[] | undefined }
): DataFrameDomain {
	return new DataFrameDomain({
		colnames: colnames !== undefined ? value.colnames.union(setRange(colnames)) : value.colnames.widenUp(),
		cols:     colnames !== undefined ? value.cols.add([colnames.length, colnames.length]) : value.cols.widenUp(),
		rows:     value.rows
	});
}

function applyAddRowsSemantics(
	value: DataFrameDomain,
	{ rows }: { rows: number | undefined }
): DataFrameDomain {
	if(value.cols.value !== Bottom && value.cols.value[0] === 0) {
		return new DataFrameDomain({
			...value,
			colnames: value.colnames.top(),
			cols:     rows !== undefined ? value.cols.add([1, 1]) : value.cols.top(),
			rows:     rows !== undefined ? value.rows.add([rows, rows]) : value.rows.widenUp()
		});
	}
	return new DataFrameDomain({
		colnames: value.colnames,
		cols:     value.cols,
		rows:     rows !== undefined ? value.rows.add([rows, rows]) : value.rows.widenUp()
	});
}

function applyRemoveColsSemantics(
	value: DataFrameDomain,
	{ colnames }: { colnames: (string | undefined)[] | undefined },
	options?: { maybe?: boolean }
): DataFrameDomain {
	if(options?.maybe) {
		return new DataFrameDomain({
			colnames: colnames !== undefined ? value.colnames.subtract(setRange(colnames)) : value.colnames.widenDown(),
			cols:     colnames !== undefined ? value.cols.subtract([colnames.length, 0]) : value.cols.widenDown(),
			rows:     value.rows
		});
	}
	return new DataFrameDomain({
		colnames: colnames !== undefined ? value.colnames.subtract(setRange(colnames)) : value.colnames.widenDown(),
		cols:     colnames !== undefined ? value.cols.subtract([colnames.length, colnames.length]) : value.cols.widenDown(),
		rows:     value.rows
	});
}

function applyRemoveRowsSemantics(
	value: DataFrameDomain,
	{ rows }: { rows: number | undefined },
	options?: { maybe?: boolean }
): DataFrameDomain {
	if(options?.maybe) {
		return new DataFrameDomain({
			colnames: value.colnames,
			cols:     value.cols,
			rows:     rows !== undefined ? value.rows.subtract([rows, 0]) : value.rows.widenDown()
		});
	}
	return new DataFrameDomain({
		colnames: value.colnames,
		cols:     value.cols,
		rows:     rows !== undefined ? value.rows.subtract([rows, rows]) : value.rows.widenDown()
	});
}

function applyConcatColsSemantics(
	value: DataFrameDomain,
	{ other }: { other: DataFrameDomain }
): DataFrameDomain {
	return new DataFrameDomain({
		colnames: value.colnames.union(other.colnames),
		cols:     value.cols.add(other.cols),
		rows:     value.rows
	});
}

function applyConcatRowsSemantics(
	value: DataFrameDomain,
	{ other }: { other: DataFrameDomain }
): DataFrameDomain {
	if(value.cols.value !== Bottom && value.cols.value[0] === 0) {
		return new DataFrameDomain({
			...value,
			colnames: value.colnames.join(other.colnames),
			cols:     value.cols.join(other.cols),
			rows:     value.rows.add(other.rows)
		});
	}
	return new DataFrameDomain({
		colnames: value.colnames,
		cols:     value.cols,
		rows:     value.rows.add(other.rows)
	});
}

function applySubsetColsSemantics(
	value: DataFrameDomain,
	{ colnames }: { colnames: (string | undefined)[] | undefined },
	options?: { duplicateCols?: boolean, renamedCols?: boolean }
): DataFrameDomain {
	if(options?.duplicateCols) {
		return new DataFrameDomain({
			colnames: value.colnames.top(),
			cols:     colnames !== undefined ? value.cols.create([colnames.length, colnames.length]) : value.cols.top(),
			rows:     value.rows
		});
	} else if(options?.renamedCols) {
		return new DataFrameDomain({
			colnames: value.colnames.top(),
			cols:     colnames !== undefined ? value.cols.min([colnames.length, colnames.length]) : value.cols.widenDown(),
			rows:     value.rows
		});
	}
	return new DataFrameDomain({
		colnames: colnames !== undefined ? value.colnames.intersect(setRange(colnames)) : value.colnames.widenDown(),
		cols:     colnames !== undefined ? value.cols.min([colnames.length, colnames.length]) : value.cols.widenDown(),
		rows:     value.rows
	});
}

function applySubsetRowsSemantics(
	value: DataFrameDomain,
	{ rows }: { rows: number | undefined },
	options?: { duplicateRows?: boolean }
): DataFrameDomain {
	if(options?.duplicateRows) {
		return new DataFrameDomain({
			colnames: value.colnames,
			cols:     value.cols,
			rows:     rows !== undefined ? value.rows.create([rows, rows]) : value.rows.top()
		});
	}
	return new DataFrameDomain({
		colnames: value.colnames,
		cols:     value.cols,
		rows:     rows !== undefined ? value.rows.min([rows, rows]) : value.rows.widenDown()
	});
}

function applyFilterRowsSemantics(
	value: DataFrameDomain,
	{ condition }: { condition: boolean | undefined }
): DataFrameDomain {
	return new DataFrameDomain({
		colnames: value.colnames,
		cols:     value.cols,
		rows:     condition ? value.rows : condition === false ? value.rows.create([0, 0]) : value.rows.widenDown()
	});
}

function applyMutateColsSemantics(
	value: DataFrameDomain,
	{ colnames }: { colnames: (string | undefined)[] | undefined }
): DataFrameDomain {
	return new DataFrameDomain({
		colnames: colnames !== undefined ? value.colnames.union(setRange(colnames)) : value.colnames.widenUp(),
		cols:     colnames !== undefined ? value.cols.add([0, colnames.length]).max([colnames.length, colnames.length]) : value.cols.widenUp(),
		rows:     value.rows
	});
}

function applyGroupBySemantics(
	value: DataFrameDomain,
	{ by }: { by: (string | undefined)[] },
	options?: { mutatedCols?: boolean }
): DataFrameDomain {
	if(options?.mutatedCols) {
		return new DataFrameDomain({
			colnames: value.colnames.union(setRange(by)),
			cols:     value.cols.add([0, by.length]),
			rows:     value.rows
		});
	}
	// Group by only marks columns as groups but does not change the shape itself
	return value;
}

function applySummarizeSemantics(
	value: DataFrameDomain,
	{ colnames }: { colnames: (string | undefined)[] | undefined }
): DataFrameDomain {
	return new DataFrameDomain({
		colnames: colnames !== undefined ? value.colnames.join(setRange([])).union(setRange(colnames)) : value.colnames.widenUp(),
		cols:     colnames !== undefined ? value.cols.add([0, colnames.length]).min([colnames.length, +Infinity]) : value.cols.widenUp(),
		rows:     value.rows.min([1, +Infinity]).max([0, 1])
	});
}

function applyJoinSemantics(
	value: DataFrameDomain,
	{ other, by }: { other: DataFrameDomain, by: (string | undefined)[] | undefined },
	options?: { join?: 'inner' | 'left' | 'right' | 'full', natural?: boolean }
): DataFrameDomain {
	// Merge two intervals by creating the maximum of the lower bounds and adding the upper bounds
	const mergeInterval = (interval1: PosIntervalDomain, interval2: PosIntervalDomain): PosIntervalDomain => {
		if(interval1.value === Bottom || interval2.value === Bottom) {
			return interval1.bottom();
		} else {
			return new PosIntervalDomain([Math.max(interval1.value[0], interval2.value[0]), interval1.value[1] + interval2.value[1]]);
		}
	};
	// Creating the Cartesian product of two intervals by keeping the lower bound and multiplying the upper bounds
	const productInterval = (lower: PosIntervalDomain, interval1: PosIntervalDomain, interval2: PosIntervalDomain): PosIntervalDomain => {
		if(lower.value === Bottom || interval1.value === Bottom || interval2.value === Bottom) {
			return lower.bottom();
		} else {
			return new PosIntervalDomain([lower.value[0], interval1.value[1] * interval2.value[1]]);
		}
	};
	let duplicateCols: string[] | undefined;  // columns that may be renamed due to occurring in both data frames
	let productRows: boolean;  // whether the resulting rows may be a Cartesian product of the rows of the data frames

	if(options?.natural) {
		const commonCols = value.colnames.intersect(other.colnames).upper();
		duplicateCols = [];
		productRows = commonCols !== Bottom && commonCols !== Top && commonCols.size === 0;
	} else if(by === undefined) {
		duplicateCols = undefined;
		productRows = true;
	} else if(by.length === 0) {
		const commonCols = value.colnames.intersect(other.colnames).upper();
		duplicateCols = commonCols !== Bottom ? commonCols !== Top ? [...commonCols] : undefined : [];
		productRows = true;
	} else if(by.every(isNotUndefined)) {
		const remainingCols = value.colnames.intersect(other.colnames).subtract(setRange(by)).upper();
		duplicateCols = remainingCols !== Bottom ? remainingCols !== Top ? [...remainingCols] : undefined : [];
		productRows = false;
	} else {
		duplicateCols = undefined;
		productRows = false;
	}
	const joinType = options?.join ?? 'inner';
	let rows: PosIntervalDomain;

	switch(joinType) {
		case 'inner':
			rows = value.rows.min(other.rows).widenDown();
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
	return new DataFrameDomain({
		...value,
		colnames: duplicateCols === undefined ? value.colnames.top() : duplicateCols.length > 0 ? value.colnames.union(other.colnames).subtract(setRange(duplicateCols)).widenUp() : value.colnames.union(other.colnames),
		cols:     by !== undefined ? value.cols.add(other.cols).subtract([by.length, by.length]) : mergeInterval(value.cols, other.cols),
		rows:     productRows ? productInterval(rows, value.rows, other.rows) : rows
	});
}

function applyIdentitySemantics(
	value: DataFrameDomain,
	// eslint-disable-next-line @typescript-eslint/no-empty-object-type
	_args: {}
): DataFrameDomain {
	return value;
}

function applyUnknownSemantics(
	value: DataFrameDomain,
	// eslint-disable-next-line @typescript-eslint/no-empty-object-type
	_args: {}
): DataFrameDomain {
	return value.top();
}

function setRange(colnames: (string | undefined)[] | undefined): ArrayRangeValue<string> {
	const names = colnames?.filter(isNotUndefined) ?? [];

	return { min: names, range: names.length === colnames?.length ? [] : Top };
}
