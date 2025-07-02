import { VariableResolve } from '../../../config';
import type { ResolveInfo } from '../../../dataflow/eval/resolve/alias-tracking';
import type { DataflowGraph } from '../../../dataflow/graph/graph';
import type { RNode } from '../../../r-bridge/lang-4.x/ast/model/model';
import type { RAccess, RIndexAccess, RNamedAccess } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-access';
import type { RFunctionArgument } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { EmptyArgument } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { ParentInformation } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { RType } from '../../../r-bridge/lang-4.x/ast/model/type';
import type { AbstractInterpretationInfo, DataFrameInfo, DataFrameOperation } from '../absint-info';
import { resolveIdToAbstractValue } from '../absint-visitor';
import { resolveIdToArgName, resolveIdToArgValue, resolveIdToArgValueSymbolName, unquoteArgument } from '../resolve-args';

const SpecialAccessArgumentsMapper: Record<RIndexAccess['operator'], string[]> = {
	'[':  ['drop'],
	'[[': ['exact']
};

export function mapDataFrameAccess(
	node: RNode<ParentInformation>,
	dfg: DataflowGraph
): DataFrameInfo | undefined {
	if(node.type === RType.Access) {
		let operations: DataFrameOperation[] | undefined;

		if(isStringBasedAccess(node)) {
			operations = mapDataFrameNamedColumnAccess(node, { graph: dfg, idMap: dfg.idMap, full: true, resolve: VariableResolve.Alias });
		} else {
			operations = mapDataFrameIndexColRowAccess(node, { graph: dfg, idMap: dfg.idMap, full: true, resolve: VariableResolve.Alias });
		}
		if(operations !== undefined) {
			return { type: 'expression', operations: operations };
		}
	}
}

function mapDataFrameNamedColumnAccess(
	access: RNamedAccess<ParentInformation & AbstractInterpretationInfo>,
	info: ResolveInfo
): DataFrameOperation[] | undefined {
	const dataFrame = access.accessed;

	if(resolveIdToAbstractValue(dataFrame, info.graph) === undefined) {
		return;
	}
	const argName = resolveIdToArgValueSymbolName(access.access[0], info);

	return [{
		operation: 'accessCols',
		operand:   dataFrame.info.id,
		columns:   argName ? [argName] : undefined
	}];
}

function mapDataFrameIndexColRowAccess(
	access: RIndexAccess<ParentInformation & AbstractInterpretationInfo>,
	info: ResolveInfo
): DataFrameOperation[] | undefined {
	const dataFrame = access.accessed;

	if(resolveIdToAbstractValue(dataFrame, info.graph) === undefined) {
		return;
	}
	const args = getEffectiveArgs(access.operator, access.access);

	if(args.every(arg => arg === EmptyArgument)) {
		return [{
			operation: 'identity',
			operand:   dataFrame.info.id
		}];
	}
	const result: DataFrameOperation[] = [];
	const dropArg = access.access.find(arg => resolveIdToArgName(arg, info) === 'drop');
	const dropValue = resolveIdToArgValue(dropArg, info);
	const exactArg = access.access.find(arg => resolveIdToArgName(arg, info) === 'exact');
	const exactValue = resolveIdToArgValue(exactArg, info);
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

		if(typeof colValue === 'string') {
			columns = [colValue];
		} else if(typeof colValue === 'number') {
			columns = [colValue];
		} else if(Array.isArray(colValue) && colValue.every(col => typeof col === 'number')) {
			columns = colValue;
		} else if(Array.isArray(colValue) && colValue.every(col => typeof col === 'string') && exactValue !== false) {
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
		args.length === 2 && typeof dropValue === 'boolean' ? dropValue :
			rowArg !== undefined && columns?.length === 1 && (typeof columns[0] === 'string' || columns[0] > 0);

	if(!dropExtent) {
		const rowSubset = rows === undefined || rows.every(row => row >= 0);
		const rowZero = rows?.length === 1 && rows[0] === 0;
		const colSubset = columns === undefined || columns.every(col => typeof col === 'string' || col >= 0);
		const colZero = columns?.length === 1 && columns[0] === 0;
		const colnamesChange = columns?.some((col, _, list) => list.filter(other => other === col).length > 1);

		let operand: RNode<ParentInformation> | undefined = dataFrame;

		if(rowArg !== undefined && rowArg !== EmptyArgument) {
			result.push({
				operation: rowSubset ? 'subsetRows' : 'removeRows',
				operand:   operand?.info.id,
				rows:      rowZero ? 0 : rows?.filter(index => index !== 0).length
			});
			operand = undefined;
		}
		if(colArg !== undefined && colArg !== EmptyArgument) {
			if(colSubset) {
				result.push({
					operation: 'subsetCols',
					operand:   operand?.info.id,
					colnames:  colZero ? [] : columns?.map(col => typeof col === 'string' ? col : undefined),
					...(colnamesChange ? { options: { colnamesChange } } : {})
				});
				console.log(result.at(-1));
			} else {
				result.push({
					operation: 'removeCols',
					operand:   operand?.info.id,
					colnames:  columns?.map(col => typeof col === 'string' ? col : undefined)
				});
			}
			operand = undefined;
		}
		return result;
	}
}

function getEffectiveArgs(
	operator: RIndexAccess['operator'],
	args: readonly RFunctionArgument<ParentInformation>[]
): readonly RFunctionArgument<ParentInformation>[] {
	const specialArgs = SpecialAccessArgumentsMapper[operator];

	return args.filter(arg => arg === EmptyArgument || arg.name === undefined || !specialArgs.includes(unquoteArgument(arg.name.content)));
}

export function isStringBasedAccess(
	access: RAccess<ParentInformation>
): access is RNamedAccess<ParentInformation> {
	return access.operator === '$' || access.operator === '@';
}
