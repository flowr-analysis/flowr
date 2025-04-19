import type { ResolveInfo } from '../../../dataflow/environments/resolve-by-name';
import type { DataflowGraph } from '../../../dataflow/graph/graph';
import { toUnnamedArgument } from '../../../dataflow/internal/process/functions/call/argument/make-argument';
import type { RNode } from '../../../r-bridge/lang-4.x/ast/model/model';
import type { RIndexAccess, RNamedAccess } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-access';
import type { RFunctionArgument } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { EmptyArgument } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { RString } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-string';
import type { RSymbol } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { ParentInformation } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { RType } from '../../../r-bridge/lang-4.x/ast/model/type';
import type { DataFrameAssignmentInfo, DataFrameInfo, DataFrameOperations } from '../absint-info';
import { resolveIdToArgStringVector, resolveIdToArgValue, resolveIdToArgValueSymbolName } from '../resolve-args';
import { isStringBasedAccess } from '../semantics-mapper';

const DataFrameAssignmentFunctionMapper = {
	'colnames': mapDataFrameColNamesAssignment,
	'names':    mapDataFrameColNamesAssignment,
	'rownames': mapDataFrameRowNamesAssignment,
	'dimnames': mapDataFrameDimNamesAssignment
} as const satisfies Record<string, DataFrameAssignmentFunctionMapping>;

type DataFrameAssignmentFunctionMapping = <OtherInfo>(
	operand: RFunctionArgument<OtherInfo & ParentInformation>,
	expression: RNode<OtherInfo & ParentInformation>,
	info: ResolveInfo
) => DataFrameOperations[] | undefined;

type DataFrameAssignmentFunction = keyof typeof DataFrameAssignmentFunctionMapper;

export function mapDataFrameAssignment<OtherInfo>(
	node: RNode<OtherInfo & ParentInformation>,
	dfg: DataflowGraph
): DataFrameInfo | undefined {
	if(node.type === RType.BinaryOp && node.lhs !== undefined && node.rhs !== undefined) {
		let operations: DataFrameOperations[] | undefined;

		if(node.lhs.type === RType.Symbol || node.lhs.type === RType.String) {
			return mapDataFrameVariableAssignment(node.lhs, node.rhs);
		} else if(node.lhs.type === RType.Access) {
			if(isStringBasedAccess(node.lhs)) {
				operations = mapDataFrameNamedColumnAssignment(node.lhs, node.rhs, { graph: dfg, idMap: dfg.idMap, full: true });
			} else {
				operations = mapDataFrameIndexColRowAssignment(node.lhs, node.rhs, { graph: dfg, idMap: dfg.idMap, full: true });
			}
		} else if(node.lhs.type === RType.FunctionCall && node.lhs.named) {
			if(node.lhs.functionName.content in DataFrameAssignmentFunctionMapper && node.lhs.arguments.length > 0) {
				const functionName = node.lhs.functionName.content as DataFrameAssignmentFunction;
				const functionProcessor = DataFrameAssignmentFunctionMapper[functionName];

				operations = functionProcessor(node.lhs.arguments[0], node.rhs, { graph: dfg, idMap: dfg.idMap, full: true });
			}
		}
		if(operations !== undefined) {
			return { type: 'expression', operations: operations };
		}
	}
}

function mapDataFrameVariableAssignment<OtherInfo>(
	identifier: RSymbol<OtherInfo & ParentInformation> | RString<OtherInfo & ParentInformation>,
	expression: RNode<OtherInfo & ParentInformation>
): DataFrameAssignmentInfo {
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
): DataFrameOperations[] {
	const argName = resolveIdToArgValueSymbolName(access.access[0], info);

	return [{
		operation: 'assignCols',
		operand:   access.accessed.info.id,
		args:      { columns: argName ? [argName] : undefined }
	}];
}

function mapDataFrameIndexColRowAssignment<OtherInfo>(
	access: RIndexAccess<OtherInfo & ParentInformation>,
	expression: RNode<OtherInfo & ParentInformation>,
	info: ResolveInfo
): DataFrameOperations[] {
	const args = access.access;

	if(args.length === 0 || args.every(arg => arg === EmptyArgument)) {
		return [{
			operation: 'identity',
			operand:   access.accessed.info.id,
			args:      {}
		}];
	}
	const rowArg = args.length < 2 ? undefined : args[0];
	const colArg = args.length < 2 ? args[0] : args[1];

	const result: DataFrameOperations[] = [];

	if(rowArg !== undefined && rowArg !== EmptyArgument) {
		const rowValue: unknown = resolveIdToArgValue(rowArg, info);
		let rows: number[] | undefined = undefined;

		if(typeof rowValue === 'number') {
			rows = [rowValue];
		} else if(Array.isArray(rowValue) && rowValue.every(row => typeof row === 'number')) {
			rows = rowValue;
		}
		result.push({
			operation: 'assignRows',
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
		result.push({
			operation: 'assignCols',
			operand:   access.accessed.info.id,
			args:      { columns }
		});
	}
	return result;
}

function mapDataFrameColNamesAssignment(
	operand: RFunctionArgument<ParentInformation>,
	expression: RNode<ParentInformation>,
	info: ResolveInfo
): DataFrameOperations[] | undefined {
	if(operand !== EmptyArgument && operand.value !== undefined && info.idMap) {
		const argument = toUnnamedArgument(expression, info.idMap);
		const assignedNames = resolveIdToArgStringVector(argument, info);

		return [{
			operation: 'setColNames',
			operand:   operand.value.info.id,
			args:      { colnames: assignedNames }
		}];
	}
}

function mapDataFrameRowNamesAssignment(
	operand: RFunctionArgument<ParentInformation>
): DataFrameOperations[] | undefined {
	if(operand !== EmptyArgument && operand?.value !== undefined) {
		return [{
			operation: 'identity',
			operand:   operand.value.info.id,
			args:      {}
		}];
	}
}

function mapDataFrameDimNamesAssignment(
	operand: RFunctionArgument<ParentInformation>
): DataFrameOperations[] | undefined {
	if(operand !== EmptyArgument && operand.value !== undefined) {
		return [{
			operation: 'setColNames',
			operand:   operand.value.info.id,
			args:      { colnames: undefined }
		}];
	}
}
