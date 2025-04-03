import type { ResolveInfo } from '../../dataflow/environments/resolve-by-name';
import { guard } from '../../util/assert';
import type { DataFrameOperation } from './absint-info';
import type { DataFrameDomain } from './domain';
import { ColNamesTop, IntervalTop, joinColNames, DataFrameTop, IntervalBottom, joinInterval } from './domain';
import { resolveIdToArgName, resolveIdToArgVectorLength, resolveIdToArgValueSymbolName, resolveIdToArgStringVector, resolveIdToArgValue } from './resolve-args';

export const DataFrameSemanticsMapper = {
	'create':      applyCreateSemantics,
	'setColNames': applySetColNamesSemantics,
	'accessCol':   applyAccessColSemantics,
	'assignCol':   applyAssignColSemantics,
	'accessRow':   applyAccessRowSemantics,
	'assignRow':   applyAssignRowSemantics,
	'identity':    applyIdentitySemantics,
	'unknown':     applyUnknownSemantics
} as const satisfies Record<string, DataFrameSemanticsApplier>;

export type DataFrameOperationName = keyof typeof DataFrameSemanticsMapper;
type DataFrameSemanticsApplier = (value: DataFrameDomain, event: DataFrameOperation, info: ResolveInfo) => DataFrameDomain;

function applyCreateSemantics(value: DataFrameDomain, event: DataFrameOperation, info: ResolveInfo): DataFrameDomain {
	const argNames = event.arguments.map(arg => arg ? resolveIdToArgName(arg, info) : undefined);
	const argLengths = event.arguments.map(arg => arg ? resolveIdToArgVectorLength(arg, info) : undefined);
	const colnames = argNames.every(arg => arg !== undefined) ? argNames : ColNamesTop;
	const rowCount = argLengths.every(arg => arg !== undefined) ? Math.max(...argLengths, 0) : undefined;

	return {
		colnames: colnames,
		cols:     [event.arguments.length, event.arguments.length],
		rows:     rowCount !== undefined ? [rowCount, rowCount] : IntervalTop
	};
}

function applySetColNamesSemantics(value: DataFrameDomain, event: DataFrameOperation, info: ResolveInfo): DataFrameDomain {
	guard(event.arguments.length === 1, 'Column names assignment only accepts a single argument');

	const argNames = event.arguments[0] ? resolveIdToArgStringVector(event.arguments[0], info) : undefined;
	const colnames = argNames !== undefined ? argNames : ColNamesTop;
	const colCount = argNames !== undefined ? argNames.length : undefined;

	return {
		...value,
		colnames: colnames,
		cols:     colCount !== undefined ? [colCount, colCount] : IntervalTop
	};
}

function applyAccessColSemantics(value: DataFrameDomain, event: DataFrameOperation, info: ResolveInfo): DataFrameDomain {
	guard(event.arguments.length === 1, 'Column access only accepts a single argument');

	const argName = event.arguments[0] ? resolveIdToArgValueSymbolName(event.arguments[0], info) : undefined;

	if(argName) {
		return {
			...value,
			colnames: joinColNames(value.colnames, [argName])
		};
	}
	const argValue = event.arguments[0] ? resolveIdToArgValue(event.arguments[0], info) : undefined;

	if(typeof argValue === 'number') {
		return {
			...value,
			cols: joinInterval(value.cols, [argValue, argValue])
		};
	}
	return value;
}

function applyAssignColSemantics(value: DataFrameDomain, event: DataFrameOperation, info: ResolveInfo): DataFrameDomain {
	guard(event.arguments.length === 1, 'Column assignment only accepts a single argument');

	const argName = event.arguments[0] ? resolveIdToArgValueSymbolName(event.arguments[0], info) : undefined;

	if(argName) {
		return {
			...value,
			colnames: joinColNames(value.colnames, [argName]),
			cols:     value.cols !== IntervalBottom ? [value.cols[0], value.cols[1] + 1] : IntervalBottom
		};
	}
	const argValue = event.arguments[0] ? resolveIdToArgValue(event.arguments[0], info) : undefined;

	if(typeof argValue === 'number') {
		return {
			...value,
			colnames: ColNamesTop,
			cols:     joinInterval(value.cols, [argValue, argValue])
		};
	}
	return {
		...value,
		colnames: ColNamesTop,
		cols:     IntervalTop
	};
}

function applyAccessRowSemantics(value: DataFrameDomain): DataFrameDomain {
	return value;
}

function applyAssignRowSemantics(value: DataFrameDomain): DataFrameDomain {
	return value;
}

function applyIdentitySemantics(value: DataFrameDomain): DataFrameDomain {
	return value;
}

function applyUnknownSemantics(): DataFrameDomain {
	return DataFrameTop;
}
