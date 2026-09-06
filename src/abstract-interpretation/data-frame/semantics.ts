import { assertUnreachable, isNotUndefined } from '../../util/assert';
import { Bottom, Top } from '../domains/lattice';
import { PosIntervalDomain, PosIntervalTop } from '../domains/positive-interval-domain';
import type { SetRangeValue } from '../domains/set-range-domain';
import type { DataFrameDomain } from './dataframe-domain';

/** Represents the different types of resulting constraints that are inferred by abstract data frame operations. */
export enum ConstraintType {
	/** The inferred constraints must hold for the operand at the point of the operation */
	OperandPrecondition,
	/** The inferred constraints are applied to the operand during the operation */
	OperandModification,
	/** The inferred constraints must hold for the returned result of the operation */
	ResultPostcondition
}

/** Maps abstract data frame operations to their semantics applier function and inferred constraint type. */
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
};

/** Applies the abstract semantics of an abstract data frame operation to the operand `value`'s shape, given `args` and optional `options`. */
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
 * Applies the abstract semantics of `operation` to `value`, assuming `args`/`options` were already sanitized per the
 * original concrete function (e.g. duplicate/invalid column names replaced). Result's constraint type: {@link ConstraintType}.
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

/** Gets the default resulting constraint type for an abstract data frame operation. */
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

	return value.create({
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
		return value.create({
			colnames: value.colnames.union(setRange(columns)),
			cols:     value.cols,
			rows:     value.rows
		});
	} else if(columns?.every(col => typeof col === 'number')) {
		return value.create({
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
		return value.create({
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
		return value.create({
			colnames: value.colnames.union(setRange(columns)),
			cols:     value.cols.add([0, columns.length]).max([columns.length, columns.length]),
			rows:     value.rows
		});
	} else if(columns?.every(col => typeof col === 'number')) {
		return value.create({
			colnames: value.colnames.widenUp(),
			cols:     columns.reduce((current, col) => current.max([col, col]), value.cols),
			rows:     value.rows
		});
	}
	return value.create({
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
		return value.create({
			colnames: value.colnames,
			cols:     value.cols,
			rows:     rows.reduce((current, row) => current.max([row, row]), value.rows)
		});
	}
	return value.create({
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
		return value.create({
			colnames: value.colnames.widenDown().union(setRange(colnames)),
			cols:     value.cols,
			rows:     value.rows
		});
	}
	const allColNames = colnames?.every(isNotUndefined) && value.cols.isValue() && colnames.length >= value.cols.upper;

	return value.create({
		colnames: allColNames ? value.colnames.create(setRange(colnames)) : value.colnames.create(setRange(colnames)).widenUp(),
		cols:     value.cols,
		rows:     value.rows
	});
}

function applyAddColsSemantics(
	value: DataFrameDomain,
	{ colnames }: { colnames: (string | undefined)[] | undefined }
): DataFrameDomain {
	return value.create({
		colnames: colnames !== undefined ? value.colnames.union(setRange(colnames)) : value.colnames.widenUp(),
		cols:     colnames !== undefined ? value.cols.add([colnames.length, colnames.length]) : value.cols.widenUp(),
		rows:     value.rows
	});
}

function applyAddRowsSemantics(
	value: DataFrameDomain,
	{ rows }: { rows: number | undefined }
): DataFrameDomain {
	if(value.cols.isValue() && value.cols.lower === 0) {
		return value.create({
			colnames: value.colnames.top(),
			cols:     rows !== undefined ? value.cols.add([1, 1]) : value.cols.top(),
			rows:     rows !== undefined ? value.rows.add([rows, rows]) : value.rows.widenUp()
		});
	}
	return value.create({
		colnames: value.colnames,
		cols:     value.cols,
		rows:     rows !== undefined ? value.rows.add([rows, rows]) : value.rows.widenUp()
	});
}

/**
 * How many of `count` indices reaching up to `maxIndex` a removal actually drops: all of them while every index
 * names something, and anywhere between none and all once one reaches past the extent, as R drops nothing for it.
 */
function removedRange(count: number, maxIndex: number | undefined, extent: PosIntervalDomain): [number, number] {
	const lower = extent.isValue() ? extent.lower : undefined;
	/* `subtract` takes what comes off each bound, so an uncertain removal takes `count` off the lower and none off the upper */
	return maxIndex !== undefined && typeof lower === 'number' && maxIndex > lower ? [count, 0] : [count, count];
}

function applyRemoveColsSemantics(
	value: DataFrameDomain,
	{ colnames, maxIndex }: { colnames: (string | undefined)[] | undefined, maxIndex?: number },
	options?: { maybe?: boolean }
): DataFrameDomain {
	if(options?.maybe) {
		return value.create({
			colnames: colnames !== undefined ? value.colnames.subtract(setRange(colnames)) : value.colnames.widenDown(),
			cols:     colnames !== undefined ? value.cols.subtract([colnames.length, 0]) : value.cols.widenDown(),
			rows:     value.rows
		});
	}
	return value.create({
		colnames: colnames !== undefined ? value.colnames.subtract(setRange(colnames)) : value.colnames.widenDown(),
		cols:     colnames !== undefined ? value.cols.subtract(removedRange(colnames.length, maxIndex, value.cols)) : value.cols.widenDown(),
		rows:     value.rows
	});
}

function applyRemoveRowsSemantics(
	value: DataFrameDomain,
	{ rows, maxIndex }: { rows: number | undefined, maxIndex?: number },
	options?: { maybe?: boolean }
): DataFrameDomain {
	if(options?.maybe) {
		return value.create({
			colnames: value.colnames,
			cols:     value.cols,
			rows:     rows !== undefined ? value.rows.subtract([rows, 0]) : value.rows.widenDown()
		});
	}
	return value.create({
		colnames: value.colnames,
		cols:     value.cols,
		rows:     rows !== undefined ? value.rows.subtract(removedRange(rows, maxIndex, value.rows)) : value.rows.widenDown()
	});
}

function applyConcatColsSemantics(
	value: DataFrameDomain,
	{ other }: { other: DataFrameDomain }
): DataFrameDomain {
	return value.create({
		colnames: value.colnames.union(other.colnames),
		cols:     value.cols.add(other.cols),
		rows:     value.rows
	});
}

function applyConcatRowsSemantics(
	value: DataFrameDomain,
	{ other }: { other: DataFrameDomain }
): DataFrameDomain {
	if(value.cols.value !== Bottom && value.cols.lower === 0) {
		return value.create({
			colnames: value.colnames.join(other.colnames),
			cols:     value.cols.join(other.cols),
			rows:     value.rows.add(other.rows)
		});
	}
	return value.create({
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
		return value.create({
			colnames: value.colnames.top(),
			cols:     colnames !== undefined ? value.cols.create([colnames.length, colnames.length]) : value.cols.top(),
			rows:     value.rows
		});
	} else if(options?.renamedCols) {
		return value.create({
			colnames: value.colnames.top(),
			cols:     colnames !== undefined ? value.cols.min([colnames.length, colnames.length]) : value.cols.widenDown(),
			rows:     value.rows
		});
	}
	return value.create({
		colnames: colnames !== undefined ? value.colnames.intersect(setRange(colnames)) : value.colnames.widenDown(),
		cols:     colnames !== undefined ? value.cols.min([colnames.length, colnames.length]) : value.cols.widenDown(),
		rows:     value.rows
	});
}

/**
 * Selecting rows by index yields exactly as many rows as the selection names, whatever the frame holds: R pads an
 * index past the end with an `NA` row rather than dropping it, and repeats one that appears twice. That holds for
 * a logical selection too. `head` and `tail` instead take what is there, which `atMost` states.
 */
function applySubsetRowsSemantics(
	value: DataFrameDomain,
	{ rows }: { rows: number | undefined },
	options?: { atMost?: boolean }
): DataFrameDomain {
	if(rows === undefined) {
		return value.create({ colnames: value.colnames, cols: value.cols, rows: value.rows.widenDown() });
	}
	return value.create({
		colnames: value.colnames,
		cols:     value.cols,
		/* `head` and `tail` take what is there, an index selects what it names even where nothing is */
		rows:     options?.atMost ? value.rows.min([rows, rows]) : value.rows.create([rows, rows])
	});
}

function applyFilterRowsSemantics(
	value: DataFrameDomain,
	{ condition }: { condition: boolean | undefined }
): DataFrameDomain {
	return value.create({
		colnames: value.colnames,
		cols:     value.cols,
		rows:     condition ? value.rows : condition === false ? value.rows.create([0, 0]) : value.rows.widenDown()
	});
}

function applyMutateColsSemantics(
	value: DataFrameDomain,
	{ colnames }: { colnames: (string | undefined)[] | undefined }
): DataFrameDomain {
	return value.create({
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
		return value.create({
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
	return value.create({
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
		if(interval1.isValue() && interval2.isValue()) {
			return new PosIntervalDomain([Math.max(interval1.lower, interval2.lower), interval1.upper + interval2.upper]);
		}
		return interval1.bottom();
	};
	// Creating the Cartesian product of two intervals by keeping the lower bound and multiplying the upper bounds
	const productInterval = (lower: PosIntervalDomain, interval1: PosIntervalDomain, interval2: PosIntervalDomain): PosIntervalDomain => {
		if(lower.isValue() && interval1.isValue() && interval2.isValue()) {
			return new PosIntervalDomain([lower.lower, interval1.upper * interval2.upper]);
		}
		return lower.bottom();
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
			rows = value.rows.max(other.rows).widenDown();
			break;
		case 'left':
			rows = value.rows.max(other.rows.isValue() ? [0, other.rows.upper] : Bottom);
			break;
		case 'right':
			rows = other.rows.max(value.rows.isValue() ? [0, value.rows.upper] : Bottom);
			break;
		case 'full':
			rows = mergeInterval(value.rows, other.rows);
			break;
		default:
			assertUnreachable(joinType);
	}
	return value.create({
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

function setRange(colnames: (string | undefined)[] | undefined): SetRangeValue<string> {
	const names = colnames?.filter(isNotUndefined) ?? [];

	return { must: new Set(names), may: names.length === colnames?.length ? new Set() : Top };
}
