import type { ResolveInfo } from '../../../dataflow/environments/resolve-by-name';
import type { DataflowGraph } from '../../../dataflow/graph/graph';
import type { RNode } from '../../../r-bridge/lang-4.x/ast/model/model';
import type { RIndexAccess, RNamedAccess } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-access';
import { EmptyArgument } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { RString } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-string';
import type { RSymbol } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { ParentInformation } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { RType } from '../../../r-bridge/lang-4.x/ast/model/type';
import type { DataFrameInfo } from '../absint-info';
import { resolveIdToArgValue, resolveIdToArgValueSymbolName } from '../resolve-args';
import { isStringBasedAccess } from '../semantics-mapper';

export function mapDataFrameAssignment<OtherInfo>(
	node: RNode<OtherInfo & ParentInformation>,
	dfg: DataflowGraph
): DataFrameInfo | undefined {
	if(node.type === RType.BinaryOp && node.lhs !== undefined && node.rhs !== undefined) {
		if(node.lhs.type === RType.Symbol || node.lhs.type === RType.String) {
			return mapDataFrameVariableAssignment(node.lhs, node.rhs);
		} else if(node.lhs.type === RType.Access) {
			if(isStringBasedAccess(node.lhs)) {
				return mapDataFrameNamedColumnAssignment(node.lhs, node.rhs, { graph: dfg, idMap: dfg.idMap, full: true });
			} else {
				return mapDataFrameIndexColRowAssignment(node.lhs, node.rhs, { graph: dfg, idMap: dfg.idMap, full: true });
			}
		}
	}
}

function mapDataFrameVariableAssignment<OtherInfo>(
	identifier: RSymbol<OtherInfo & ParentInformation> | RString<OtherInfo & ParentInformation>,
	expression: RNode<OtherInfo & ParentInformation>
): DataFrameInfo {
	return {
		type:       'assignment',
		identifier: identifier.info.id,
		expression: expression.info.id
	};
}

function mapDataFrameNamedColumnAssignment<OtherInfo>(
	access: RNamedAccess<OtherInfo & ParentInformation>,
	expression: RNode<OtherInfo & ParentInformation>,
	info: ResolveInfo
): DataFrameInfo {
	const argName = resolveIdToArgValueSymbolName(access.access[0], info);

	return {
		type:       'expression',
		operations: [{
			operation: 'assignCol',
			operand:   access.accessed.info.id,
			args:      { columns: argName ? [argName] : undefined }
		}]
	};
}

function mapDataFrameIndexColRowAssignment<OtherInfo>(
	access: RIndexAccess<OtherInfo & ParentInformation>,
	expression: RNode<OtherInfo & ParentInformation>,
	info: ResolveInfo
): DataFrameInfo {
	const args = access.access;

	if(args.length === 0 || args.every(arg => arg === EmptyArgument)) {
		return {
			type:       'expression',
			operations: [{
				operation: 'identity',
				operand:   access.accessed.info.id,
				args:      {}
			}]
		};
	}
	const rowArg = args.length < 2 ? undefined : args[0];
	const colArg = args.length < 2 ? args[0] : args[1];

	const result: DataFrameInfo = { type: 'expression', operations: [] };

	if(rowArg !== undefined && rowArg !== EmptyArgument) {
		const rowValue = resolveIdToArgValue(rowArg, info);
		let rows: number[] | undefined = undefined;

		if(typeof rowValue === 'number') {
			rows = [rowValue];
		} else if(Array.isArray(rowValue) && rowValue.every(row => typeof row === 'number')) {
			rows = rowValue;
		}
		result.operations.push({
			operation: 'assignRow',
			operand:   access.accessed.info.id,
			args:      { rows }
		});
	}
	if(colArg !== undefined && colArg !== EmptyArgument) {
		const colValue = resolveIdToArgValue(colArg, info);
		let columns: string[] | number[] | undefined = undefined;

		if(typeof colValue === 'string') {
			columns = [colValue];
		} else if(typeof colValue === 'number') {
			columns = [colValue];
		} else if(Array.isArray(colValue) && (colValue.every(col => typeof col === 'string') || colValue.every(col => typeof col === 'number'))) {
			columns = colValue;
		}
		result.operations.push({
			operation: 'assignCol',
			operand:   access.accessed.info.id,
			args:      { columns }
		});
	}
	return result;
}
