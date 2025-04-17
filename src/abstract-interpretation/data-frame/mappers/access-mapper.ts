import type { ResolveInfo } from '../../../dataflow/environments/resolve-by-name';
import type { DataflowGraph } from '../../../dataflow/graph/graph';
import type { RNode } from '../../../r-bridge/lang-4.x/ast/model/model';
import type { RIndexAccess, RNamedAccess } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-access';
import type { RFunctionArgument } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { EmptyArgument } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { ParentInformation } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { RType } from '../../../r-bridge/lang-4.x/ast/model/type';
import type { DataFrameInfo, DataFrameOperations } from '../absint-info';
import { resolveIdToArgName, resolveIdToArgValue, resolveIdToArgValueSymbolName } from '../resolve-args';
import { isStringBasedAccess } from '../semantics-mapper';

const SpecialAccessArgumentsMapper: Partial<Record<RIndexAccess['operator'], string[]>> = {
	'[':  ['drop'],
	'[[': ['exact']
};

export function mapDataFrameAccess<OtherInfo>(
	node: RNode<OtherInfo & ParentInformation>,
	dfg: DataflowGraph
): DataFrameInfo | undefined {
	if(node.type === RType.Access) {
		let operations: DataFrameOperations[] | undefined;

		if(isStringBasedAccess(node)) {
			operations = mapDataFrameNamedColumnAccess(node, { graph: dfg, idMap: dfg.idMap, full: true });
		} else {
			operations = mapDataFrameIndexColRowAccess(node, { graph: dfg, idMap: dfg.idMap, full: true });
		}
		if(operations !== undefined) {
			return { type: 'expression', operations: operations };
		}
	}
}

function mapDataFrameNamedColumnAccess<OtherInfo>(
	access: RNamedAccess<OtherInfo & ParentInformation>,
	info: ResolveInfo
): DataFrameOperations[] {
	const argName = resolveIdToArgValueSymbolName(access.access[0], info);

	return [{
		operation: 'accessCol',
		operand:   access.accessed.info.id,
		args:      { columns: argName ? [argName] : undefined }
	}];
}

function mapDataFrameIndexColRowAccess<OtherInfo>(
	access: RIndexAccess<OtherInfo & ParentInformation>,
	info: ResolveInfo
): DataFrameOperations[] | undefined {
	const effectiveArgs = getEffectiveArgs(access.operator, access.access);
	const dropArg = access.access.find(arg => resolveIdToArgName(arg, info) === 'drop');
	const dropValue = dropArg !== undefined ? resolveIdToArgValue(dropArg, info) : undefined;

	if(effectiveArgs.every(arg => arg === EmptyArgument)) {
		return [{
			operation: 'identity',
			operand:   access.accessed.info.id,
			args:      {}
		}];
	} else if(effectiveArgs.length > 0 && effectiveArgs.length <= 2) {
		const rowArg = effectiveArgs.length < 2 ? undefined : effectiveArgs[0];
		const colArg = effectiveArgs.length < 2 ? effectiveArgs[0] : effectiveArgs[1];
		let rows: number[] | undefined = undefined;
		let columns: string[] | number[] | undefined = undefined;

		const result: DataFrameOperations[] = [];

		if(rowArg !== undefined && rowArg !== EmptyArgument) {
			const rowValue: unknown = resolveIdToArgValue(rowArg, info);

			if(typeof rowValue === 'number') {
				rows = [rowValue];
			} else if(Array.isArray(rowValue) && rowValue.every(row => typeof row === 'number')) {
				rows = rowValue;
			}
			result.push({
				operation: 'accessRow',
				operand:   access.accessed.info.id,
				args:      { rows: rows?.map(Math.abs) }
			});
		}
		if(colArg !== undefined && colArg !== EmptyArgument) {
			const colValue: unknown = resolveIdToArgValue(colArg, info);

			if(typeof colValue === 'string') {
				columns = [colValue];
			} else if(typeof colValue === 'number') {
				columns = [colValue];
			} else if(Array.isArray(colValue) && (colValue.every(col => typeof col === 'string') || colValue.every(col => typeof col === 'number'))) {
				columns = colValue;
			}
			result.push({
				operation: 'accessCol',
				operand:   access.accessed.info.id,
				args:      { columns: columns?.every(col => typeof col === 'number') ? columns.map(Math.abs) : columns }
			});
		}
		// The data frame extent is dropped if the operator `[[` is used, the argument `drop` is true, or only one column is accessed
		const dropExtent = access.operator === '[[' ? true :
			effectiveArgs.length === 2 && typeof dropValue === 'boolean' ? dropValue :
				rowArg !== undefined && columns?.length === 1 && (typeof columns[0] === 'string' || columns[0] > 0);

		if(!dropExtent) {
			let operand: RNode<OtherInfo & ParentInformation> | undefined = access.accessed;

			if(rowArg !== undefined && rowArg !== EmptyArgument) {
				result.push({
					operation: rows === undefined || rows?.every(row => row >= 0) ? 'subsetRows' : 'removeRows',
					operand:   operand?.info.id,
					args:      { rows: rows?.length }
				});
				operand = undefined;
			}
			if(colArg !== undefined && colArg !== EmptyArgument) {
				result.push({
					operation: columns === undefined || columns?.every(col => typeof col === 'string' || col >= 0) ? 'subsetCols' : 'removeCols',
					operand:   operand?.info.id,
					args:      { colnames: columns?.map(col => typeof col === 'string' ? col : undefined) }
				});
				operand = undefined;
			}
		}
		return result;
	}
}

function getEffectiveArgs<OtherInfo>(
	funct: keyof typeof SpecialAccessArgumentsMapper,
	args: readonly RFunctionArgument<OtherInfo & ParentInformation>[]
): readonly RFunctionArgument<OtherInfo & ParentInformation>[] {
	const ignoredArgs = SpecialAccessArgumentsMapper[funct] ?? [];

	return args.filter(arg => arg === EmptyArgument || arg.name === undefined || !ignoredArgs.includes(arg.name.content));
}
