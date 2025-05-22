import type { ResolveInfo } from '../../../dataflow/environments/resolve-by-name';
import type { DataflowGraph } from '../../../dataflow/graph/graph';
import { toUnnamedArgument } from '../../../dataflow/internal/process/functions/call/argument/make-argument';
import type { RNode } from '../../../r-bridge/lang-4.x/ast/model/model';
import type { RIndexAccess, RNamedAccess } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-access';
import type { RArgument } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import { EmptyArgument } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { ParentInformation } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { RType } from '../../../r-bridge/lang-4.x/ast/model/type';
import type { AbstractInterpretationInfo, DataFrameInfo, DataFrameOperations } from '../absint-info';
import { resolveIdToArgStringVector, resolveIdToArgValue, resolveIdToArgValueSymbolName } from '../resolve-args';
import { isStringBasedAccess } from '../semantics-mapper';
import { mapDataFrameVariableAssignment } from './assignment-mapper';

const DataFrameAssignmentFunctionMapper = {
	'colnames': mapDataFrameColNamesAssignment,
	'names':    mapDataFrameColNamesAssignment,
	'rownames': mapDataFrameRowNamesAssignment,
	'dimnames': mapDataFrameDimNamesAssignment
} as const satisfies Record<string, DataFrameAssignmentFunctionMapping>;

type DataFrameAssignmentFunctionMapping = (
    operand: RArgument<ParentInformation>,
    expression: RNode<ParentInformation>,
    info: ResolveInfo
) => DataFrameOperations[] | undefined;

type DataFrameAssignmentFunction = keyof typeof DataFrameAssignmentFunctionMapper;

export function mapDataFrameReplacement(
	node: RNode<ParentInformation>,
	dfg: DataflowGraph
): DataFrameInfo | undefined {
	if(node.type === RType.BinaryOp && node.lhs !== undefined && node.rhs !== undefined) {
		let operations: DataFrameOperations[] | undefined;

		if(node.lhs.type === RType.Access) {
			if(node.lhs.accessed.type === RType.Symbol && node.lhs.access.every(access => access === EmptyArgument)) {
				return mapDataFrameVariableAssignment(node.lhs.accessed, node.rhs);
			} else if(isStringBasedAccess(node.lhs)) {
				operations = mapDataFrameNamedColumnAssignment(node.lhs, node.rhs, { graph: dfg, idMap: dfg.idMap, full: true });
			} else {
				operations = mapDataFrameIndexColRowAssignment(node.lhs, node.rhs, { graph: dfg, idMap: dfg.idMap, full: true });
			}
		} else if(node.lhs.type === RType.FunctionCall && node.lhs.named && node.lhs.arguments.length === 1 && node.lhs.arguments[0] !== EmptyArgument) {
			if(node.lhs.functionName.content in DataFrameAssignmentFunctionMapper && node.lhs.arguments.length > 0) {
				const functionName = node.lhs.functionName.content as DataFrameAssignmentFunction;
				const functionMapping = DataFrameAssignmentFunctionMapper[functionName];

				operations = functionMapping(node.lhs.arguments[0], node.rhs, { graph: dfg, idMap: dfg.idMap, full: true });
			} else {
				operations = mapDataFrameUnknownAssignment(node.lhs.arguments[0]);
			}
		}
		if(operations !== undefined) {
			return { type: 'expression', operations: operations };
		}
	}
}

function mapDataFrameNamedColumnAssignment(
	access: RNamedAccess<ParentInformation & AbstractInterpretationInfo>,
	expression: RNode<ParentInformation>,
	info: ResolveInfo
): DataFrameOperations[] | undefined {
	const dataFrame = access.accessed;

	if(dataFrame.info.dataFrame?.domain?.get(dataFrame.info.id) === undefined) {
		return;
	}
	const argName = resolveIdToArgValueSymbolName(access.access[0], info);

	return [{
		operation: 'assignCols',
		operand:   dataFrame.info.id,
		args:      { columns: argName ? [argName] : undefined }
	}];
}

function mapDataFrameIndexColRowAssignment(
	access: RIndexAccess<ParentInformation & AbstractInterpretationInfo>,
	expression: RNode<ParentInformation>,
	info: ResolveInfo
): DataFrameOperations[] | undefined {
	const dataFrame = access.accessed;
	const args = access.access;

	if(dataFrame.info.dataFrame?.domain?.get(dataFrame.info.id) === undefined || args.every(arg => arg === EmptyArgument)) {
		return;
	}
	const result: DataFrameOperations[] = [];
	const rowArg = args.length < 2 ? undefined : args[0];
	const colArg = args.length < 2 ? args[0] : args[1];

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
			operand:   dataFrame.info.id,
			args:      { rows: rows }
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
			operand:   dataFrame.info.id,
			args:      { columns: columns }
		});
	}
	return result;
}

function mapDataFrameColNamesAssignment(
	operand: RArgument<AbstractInterpretationInfo & ParentInformation>,
	expression: RNode<ParentInformation>,
	info: ResolveInfo
): DataFrameOperations[] | undefined {
	if(operand.info.dataFrame?.domain?.get(operand.info.id) === undefined) {
		return;
	}
	const argument = info.idMap !== undefined ? toUnnamedArgument(expression, info.idMap) : EmptyArgument;
	const assignedNames = resolveIdToArgStringVector(argument, info);

	return [{
		operation: 'setColNames',
		operand:   operand.value?.info.id,
		args:      { colnames: assignedNames }
	}];
}

function mapDataFrameRowNamesAssignment(): DataFrameOperations[] | undefined {
	return;
}

function mapDataFrameDimNamesAssignment(
	operand: RArgument<AbstractInterpretationInfo & ParentInformation>
): DataFrameOperations[] | undefined {
	if(operand.info.dataFrame?.domain?.get(operand.info.id) === undefined) {
		return;
	}
	return [{
		operation: 'setColNames',
		operand:   operand.value?.info.id,
		args:      { colnames: undefined }
	}];
}

function mapDataFrameUnknownAssignment(
	operand: RArgument<AbstractInterpretationInfo & ParentInformation>
): DataFrameOperations[] | undefined {
	if(operand.info.dataFrame?.domain?.get(operand.info.id) === undefined) {
		return;
	}
	return [{
		operation: 'unknownModify',
		operand:   operand.value?.info.id,
		args:      {}
	}];
}
