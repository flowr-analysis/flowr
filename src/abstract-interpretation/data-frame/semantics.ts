import type { DataFrameDomain } from './domain';
import { ColNamesTop, DataFrameTop, IntervalTop, joinColNames, joinInterval } from './domain';

export enum ConstraintType {
	/** The inferred constraints must hold for the operand at the point of the operation */
	OperandPrecondition,
	/** The inferred constraints are applied to the operand during the operation */
	OperandModification,
	/** The inferred constraints must hold for the returned result of the operation */
	ResultPostcondition
}

const DataFrameSemanticsMapper = {
	'create':      applyCreateSemantics,
	'setColNames': applySetColNamesSemantics,
	'accessCol':   applyAccessColSemantics,
	'assignCol':   applyAssignColSemantics,
	'accessRow':   applyAccessRowSemantics,
	'assignRow':   applyAssignRowSemantics,
	'identity':    applyIdentitySemantics,
	'unknown':     applyUnknownSemantics
} as const satisfies Record<string, DataFrameSemanticsApplier<never>>;

const DataFrameConstraintTypeMapper: Record<DataFrameOperationName, ConstraintType[]> = {
	'create':      [ConstraintType.ResultPostcondition],
	'setColNames': [ConstraintType.OperandModification],
	'accessCol':   [ConstraintType.OperandPrecondition],
	'assignCol':   [ConstraintType.ResultPostcondition],
	'accessRow':   [ConstraintType.OperandPrecondition],
	'assignRow':   [ConstraintType.ResultPostcondition],
	'identity':    [ConstraintType.ResultPostcondition],
	'unknown':     [ConstraintType.ResultPostcondition]
};

export type DataFrameOperationName = keyof typeof DataFrameSemanticsMapper;
export type DataFrameOperationArgs<N extends DataFrameOperationName> = Parameters<typeof DataFrameSemanticsMapper[N]>[1];

type DataFrameSemanticsApplier<Arguments extends object> = (
	value: DataFrameDomain,
	args: Arguments
) => DataFrameDomain;

export function applySemantics<Name extends DataFrameOperationName>(
	operation: Name,
	value: DataFrameDomain,
	args: DataFrameOperationArgs<Name>
): DataFrameDomain {
	const applier = DataFrameSemanticsMapper[operation] as DataFrameSemanticsApplier<DataFrameOperationArgs<Name>>;

	return applier(value, args);
}

export function getConstraintTypes(operation: DataFrameOperationName): ConstraintType[] {
	return DataFrameConstraintTypeMapper[operation];
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
			cols: columns.reduce((a, b) => joinInterval(a, [b, b]), value.cols)
		};
	}
	return value;
}

function applyAssignColSemantics(
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
			cols: columns.reduce((a, b) => joinInterval(a, [b, b]), value.cols)
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
	{ rows }: { rows: number[] | undefined }
): DataFrameDomain {
	if(rows !== undefined) {
		return {
			...value,
			rows: rows.reduce((a, b) => joinInterval(a, [b, b]), value.rows)
		};
	}
	return value;
}

function applyAssignRowSemantics(
	value: DataFrameDomain,
	{ rows }: { rows: number[] | undefined }
): DataFrameDomain {
	if(rows !== undefined) {
		return {
			...value,
			rows: rows.reduce((a, b) => joinInterval(a, [b, b]), value.rows)
		};
	}
	return {
		...value,
		rows: IntervalTop
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
