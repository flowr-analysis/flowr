import type { ResolveInfo } from '../../dataflow/environments/resolve-by-name';
import type { DataFrameOperation } from './absint-info';
import { ColNamesBottom, ColNamesTop, DataFrameTop, IntervalTop, joinColNames, type ColNamesDomain, type DataFrameDomain } from './domain';
import { resolveIdToArgName, resolveIdToArgVectorLength, resolveIdToArgValueSymbolName } from './resolve-args';

export const DataFrameSemanticsMapper = {
	'create':    applyCreateSemantics,
	'accessCol': applyAccessColSemantics,
	'unknown':   applyUnknownSemantics
} as const satisfies Record<string, DataFrameSemanticsApplier>;

export type DataFrameOperationName = keyof typeof DataFrameSemanticsMapper;
type DataFrameSemanticsApplier = (value: DataFrameDomain, event: DataFrameOperation, info: ResolveInfo) => DataFrameDomain;

function applyCreateSemantics(value: DataFrameDomain, event: DataFrameOperation, info: ResolveInfo): DataFrameDomain {
	const argNames = event.arguments.map(arg => arg ? resolveIdToArgName(arg, info) : undefined);
	const argLengths = event.arguments.map(arg => arg ? resolveIdToArgVectorLength(arg, info) : undefined);
	const colnames = argNames.some(arg => arg === undefined) ? ColNamesTop : argNames as ColNamesDomain;
	const rowCount = argLengths.some(arg => arg === undefined) ? undefined : Math.max(...argLengths as number[], 0);

	return {
		colnames: colnames,
		cols:     [event.arguments.length, event.arguments.length],
		rows:     rowCount !== undefined ? [rowCount, rowCount] : IntervalTop
	};
}

function applyAccessColSemantics(value: DataFrameDomain, event: DataFrameOperation, info: ResolveInfo): DataFrameDomain {
	const argNames = event.arguments.map(arg => arg ? resolveIdToArgValueSymbolName(arg, info) : undefined);
	const colnames = argNames.some(arg => arg === undefined) ? ColNamesBottom : argNames as ColNamesDomain;

	return {
		...value,
		colnames: joinColNames(value.colnames, colnames)
	};
}

function applyUnknownSemantics(): DataFrameDomain {
	return DataFrameTop;
}
