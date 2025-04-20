import type { ResolveInfo } from '../../../dataflow/environments/resolve-by-name';
import type { DataflowGraph } from '../../../dataflow/graph/graph';
import type { RNode } from '../../../r-bridge/lang-4.x/ast/model/model';
import type { RIndexAccess, RNamedAccess } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-access';
import type { RFunctionArgument } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { EmptyArgument } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { ParentInformation } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { RType } from '../../../r-bridge/lang-4.x/ast/model/type';
import type { DataFrameInfo } from '../absint-info';
import { resolveIdToArgValue, resolveIdToArgValueSymbolName } from '../resolve-args';
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
		if(isStringBasedAccess(node)) {
			return mapDataFrameNamedColumnAccess(node, { graph: dfg, idMap: dfg.idMap, full: true });
		} else {
			return mapDataFrameIndexColRowAccess(node, { graph: dfg, idMap: dfg.idMap, full: true });
		}
	}
}

function mapDataFrameNamedColumnAccess<OtherInfo>(
	access: RNamedAccess<OtherInfo & ParentInformation>,
	info: ResolveInfo
): DataFrameInfo {
	const argName = resolveIdToArgValueSymbolName(access.access[0], info);

	return {
		type:       'expression',
		operations: [{
			operation: 'accessCol',
			operand:   access.accessed.info.id,
			args:      { columns: argName ? [argName] : undefined }
		}]
	};
}

function mapDataFrameIndexColRowAccess<OtherInfo>(
	access: RIndexAccess<OtherInfo & ParentInformation>,
	info: ResolveInfo
): DataFrameInfo {
	const args = getEffectiveArgs(access.operator, access.access);

	if(args.every(arg => arg === EmptyArgument)) {
		return {
			type:       'expression',
			operations: [{
				operation: 'identity',
				operand:   access.accessed.info.id,
				args:      {}
			}]
		};
	} else if(args.length > 0 && args.length <= 2) {
		const rowArg = args.length < 2 ? undefined : args[0];
		const colArg = args.length < 2 ? args[0] : args[1];

		const result: DataFrameInfo = { type: 'expression', operations: [] };

		if(rowArg !== undefined && rowArg !== EmptyArgument) {
			const rowValue: unknown = resolveIdToArgValue(rowArg, info);
			let rows: number[] | undefined = undefined;

			if(typeof rowValue === 'number') {
				rows = [rowValue];
			} else if(Array.isArray(rowValue) && rowValue.every(row => typeof row === 'number')) {
				rows = rowValue;
			}
			result.operations.push({
				operation: 'accessRow',
				operand:   access.accessed.info.id,
				args:      { rows }
			});
		}
		if(colArg !== undefined && colArg !== EmptyArgument) {
			const colValue: unknown = resolveIdToArgValue(colArg, info);
			let columns: string[] | number[] | undefined = undefined;

			if(typeof colValue === 'string') {
				columns = [colValue];
			} else if(typeof colValue === 'number') {
				columns = [colValue];
			} else if(Array.isArray(colValue) && (colValue.every(col => typeof col === 'string') || colValue.every(col => typeof col === 'number'))) {
				columns = colValue;
			}
			result.operations.push({
				operation: 'accessCol',
				operand:   access.accessed.info.id,
				args:      { columns }
			});
		}
		return result;
	}
	return {
		type:       'expression',
		operations: [{
			operation: 'unknown',
			operand:   access.accessed.info.id,
			args:      { modifyInplace: true }
		}]
	};
}

function getEffectiveArgs<OtherInfo>(
	funct: keyof typeof SpecialAccessArgumentsMapper,
	args: readonly RFunctionArgument<OtherInfo & ParentInformation>[]
): readonly RFunctionArgument<OtherInfo & ParentInformation>[] {
	const ignoredArgs = SpecialAccessArgumentsMapper[funct] ?? [];

	return args.filter(arg => arg === EmptyArgument || arg.name === undefined || !ignoredArgs.includes(arg.name.content));
}
