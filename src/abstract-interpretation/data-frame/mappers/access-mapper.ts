import { VariableResolve } from '../../../config';
import type { ResolveInfo } from '../../../dataflow/eval/resolve/alias-tracking';
import type { DataflowGraph } from '../../../dataflow/graph/graph';
import type { RNode } from '../../../r-bridge/lang-4.x/ast/model/model';
import type { RAccess, RIndexAccess, RNamedAccess } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-access';
import { type RFunctionArgument, EmptyArgument } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { ParentInformation } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { RType } from '../../../r-bridge/lang-4.x/ast/model/type';
import type { DataFrameExpressionInfo, DataFrameOperation } from '../absint-info';
import { resolveIdToArgValue, resolveIdToArgValueSymbolName, unquoteArgument } from '../resolve-args';
import { getArgumentValue, isDataFrameArgument } from './arguments';

/**
 * Special named arguments of index-based access operators
 */
const SpecialAccessArgumentsMapper: Record<RIndexAccess['operator'], string[]> = {
	'[':  ['drop'],
	'[[': ['exact']
};

/**
 * Maps a concrete data frame access to abstract data frame operations.
 * @param node - The R node of the access
 * @param dfg  - The data flow graph for resolving the arguments
 * @returns Data frame expression info containing the mapped abstract data frame operations, or `undefined` if the node does not represent a data frame access
 */
export function mapDataFrameAccess(
	node: RNode<ParentInformation>,
	dfg: DataflowGraph
): DataFrameExpressionInfo | undefined {
	if(node.type !== RType.Access) {
		return;
	}
	const resolveInfo = { graph: dfg, idMap: dfg.idMap, full: true, resolve: VariableResolve.Alias };
	let operations: DataFrameOperation[] | undefined;

	if(isStringBasedAccess(node)) {
		operations = mapDataFrameNamedColumnAccess(node, resolveInfo);
	} else {
		operations = mapDataFrameIndexColRowAccess(node, resolveInfo);
	}
	if(operations !== undefined) {
		return { type: 'expression', operations: operations };
	}
}

function mapDataFrameNamedColumnAccess(
	access: RNamedAccess<ParentInformation>,
	info: ResolveInfo
): DataFrameOperation[] | undefined {
	const dataFrame = access.accessed;

	if(!isDataFrameArgument(dataFrame, info)) {
		return;
	}
	const colname = resolveIdToArgValueSymbolName(access.access[0], info);

	return [{
		operation: 'accessCols',
		operand:   dataFrame.info.id,
		columns:   colname ? [colname] : undefined
	}];
}

function mapDataFrameIndexColRowAccess(
	access: RIndexAccess<ParentInformation>,
	info: ResolveInfo
): DataFrameOperation[] | undefined {
	const dataFrame = access.accessed;
	const drop = getArgumentValue(access.access, 'drop', info);
	const exact = getArgumentValue(access.access, 'exact', info);
	const args = getAccessArgs(access.operator, access.access);

	if(!isDataFrameArgument(dataFrame, info)) {
		return;
	} else if(args.every(arg => arg === EmptyArgument)) {
		return [{ operation: 'identity', operand: dataFrame.info.id }];
	}
	const result: DataFrameOperation[] = [];

	const rowArg = args.length < 2 ? undefined : args[0];
	const colArg = args.length < 2 ? args[0] : args[1];
	let rows: number[] | undefined = undefined;
	let columns: string[] | number[] | undefined = undefined;

	if(rowArg !== undefined && rowArg !== EmptyArgument) {
		const rowValue = resolveIdToArgValue(rowArg, info);

		if(typeof rowValue === 'number') {
			rows = [rowValue];
		} else if(Array.isArray(rowValue) && rowValue.every(row => typeof row === 'number')) {
			rows = rowValue;
		}
		result.push({
			operation: 'accessRows',
			operand:   dataFrame.info.id,
			rows:      rows?.map(Math.abs)
		});
	}
	if(colArg !== undefined && colArg !== EmptyArgument) {
		const colValue = resolveIdToArgValue(colArg, info);

		if(typeof colValue === 'number') {
			columns = [colValue];
		} else if(typeof colValue === 'string' && exact !== false) {
			columns = [colValue];
		} else if(Array.isArray(colValue) && colValue.every(col => typeof col === 'number')) {
			columns = colValue;
		} else if(Array.isArray(colValue) && colValue.every(col => typeof col === 'string') && exact !== false) {
			columns = colValue;
		}
		result.push({
			operation: 'accessCols',
			operand:   dataFrame.info.id,
			columns:   columns?.every(col => typeof col === 'number') ? columns.map(Math.abs) : columns
		});
	}
	// The data frame extent is dropped if the operator `[[` is used, the argument `drop` is true, or only one column is accessed
	const dropExtent = access.operator === '[[' ? true :
		args.length === 2 && typeof drop === 'boolean' ? drop :
			rowArg !== undefined && columns?.length === 1 && (typeof columns[0] === 'string' || columns[0] > 0);

	if(!dropExtent) {
		const rowSubset = rows === undefined || rows.every(row => row >= 0);
		const colSubset = columns === undefined || columns.every(col => typeof col === 'string' || col >= 0);
		const rowZero = rows?.length === 1 && rows[0] === 0;
		const colZero = columns?.length === 1 && columns[0] === 0;
		const duplicateRows = rows?.some((row, index, list) => list.indexOf(row as never) !== index);
		const duplicateCols = columns?.some((col, index, list) => list.indexOf(col as never) !== index);

		let operand: RNode<ParentInformation> | undefined = dataFrame;

		if(rowArg !== undefined && rowArg !== EmptyArgument) {
			if(rowSubset) {
				result.push({
					operation: 'subsetRows',
					operand:   operand?.info.id,
					rows:      rowZero ? 0 : rows?.filter(index => index !== 0).length,
					...(duplicateRows ? { options: { duplicateRows: true } } : {})
				});
			} else {
				result.push({
					operation: 'removeRows',
					operand:   operand?.info.id,
					rows:      rowZero ? 0 : rows?.filter(index => index !== 0).length
				});
			}
			operand = undefined;
		}
		if(colArg !== undefined && colArg !== EmptyArgument) {
			if(colSubset) {
				result.push({
					operation: 'subsetCols',
					operand:   operand?.info.id,
					colnames:  colZero ? [] : columns?.map(col => typeof col === 'string' ? col : undefined),
					...(duplicateCols ? { options: { duplicateCols: true } } : {})
				});
			} else {
				result.push({
					operation: 'removeCols',
					operand:   operand?.info.id,
					colnames:  columns?.map(col => typeof col === 'string' ? col : undefined)
				});
			}
			operand = undefined;
		}
	}
	return result;
}

/**
 * Removes all special named arguments from the arguments of an access operator (i.e. arguments like "drop" and "exact").
 */
function getAccessArgs(
	operator: RIndexAccess['operator'],
	args: readonly RFunctionArgument<ParentInformation>[]
): readonly RFunctionArgument<ParentInformation>[] {
	const specialArgs = SpecialAccessArgumentsMapper[operator];

	return args.filter(arg => arg === EmptyArgument || arg.name === undefined || !specialArgs.includes(unquoteArgument(arg.name.content)));
}

/**
 * Checks whether an access node represents a string-based access (`$` or `@`), and no index-based access (`[` or `[[`).
 */
export function isStringBasedAccess(
	access: RAccess<ParentInformation>
): access is RNamedAccess<ParentInformation> {
	return access.operator === '$' || access.operator === '@';
}
