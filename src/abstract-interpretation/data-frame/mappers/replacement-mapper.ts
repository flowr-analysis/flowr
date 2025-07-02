import { VariableResolve } from '../../../config';
import type { ResolveInfo } from '../../../dataflow/eval/resolve/alias-tracking';
import type { DataflowGraph } from '../../../dataflow/graph/graph';
import { toUnnamedArgument } from '../../../dataflow/internal/process/functions/call/argument/make-argument';
import type { RNode } from '../../../r-bridge/lang-4.x/ast/model/model';
import type { RIndexAccess, RNamedAccess } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-access';
import type { RArgument } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import { EmptyArgument } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { ParentInformation } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { RType } from '../../../r-bridge/lang-4.x/ast/model/type';
import type { AbstractInterpretationInfo, DataFrameInfo, DataFrameOperation } from '../absint-info';
import { resolveIdToAbstractValue } from '../absint-visitor';
import { resolveIdToArgStringVector, resolveIdToArgValue, resolveIdToArgValueSymbolName } from '../resolve-args';
import { ConstraintType } from '../semantics';
import { isStringBasedAccess } from './access-mapper';
import { mapDataFrameVariableAssignment } from './assignment-mapper';

const DataFrameReplacementFunctionMapper = {
	'colnames': mapDataFrameColNamesAssignment,
	'names':    mapDataFrameColNamesAssignment,
	'rownames': mapDataFrameRowNamesAssignment,
	'dimnames': mapDataFrameDimNamesAssignment
} as const satisfies Record<string, DataFrameReplacementFunctionMapping>;

type DataFrameReplacementFunctionMapping = (
    operand: RArgument<ParentInformation>,
    expression: RNode<ParentInformation>,
    info: ResolveInfo
) => DataFrameOperation[] | undefined;

type DataFrameReplacementFunction = keyof typeof DataFrameReplacementFunctionMapper;

export function mapDataFrameReplacement(
	node: RNode<ParentInformation>,
	dfg: DataflowGraph
): DataFrameInfo | undefined {
	if(node.type === RType.BinaryOp && node.lhs !== undefined && node.rhs !== undefined) {
		return mapDataFrameReplacementFunction(node.lhs, node.rhs, dfg);
	}
}

export function mapDataFrameReplacementFunction(
	node: RNode<ParentInformation>,
	expression: RNode<ParentInformation>,
	dfg: DataflowGraph
): DataFrameInfo | undefined {
	const resolveInfo = { graph: dfg, idMap: dfg.idMap, full: true, resolve: VariableResolve.Alias };
	let operations: DataFrameOperation[] | undefined;

	if(node.type === RType.Access) {
		if(node.accessed.type === RType.Symbol && node.access.every(access => access === EmptyArgument)) {
			return mapDataFrameVariableAssignment(node.accessed, expression, dfg);
		} else if(isStringBasedAccess(node)) {
			operations = mapDataFrameNamedColumnAssignment(node, expression, resolveInfo);
		} else {
			operations = mapDataFrameIndexColRowAssignment(node, expression, resolveInfo);
		}
	} else if(node.type === RType.FunctionCall && node.named && node.arguments.length === 1 && node.arguments[0] !== EmptyArgument) {
		if(Object.prototype.hasOwnProperty.call(DataFrameReplacementFunctionMapper, node.functionName.content)) {
			const functionName = node.functionName.content as DataFrameReplacementFunction;
			const functionMapping = DataFrameReplacementFunctionMapper[functionName];

			operations = functionMapping(node.arguments[0], expression, resolveInfo);
		} else {
			operations = mapDataFrameUnknownAssignment(node.arguments[0], expression, resolveInfo);
		}
	}
	if(operations !== undefined) {
		return { type: 'expression', operations: operations };
	}
}

function mapDataFrameNamedColumnAssignment(
	access: RNamedAccess<ParentInformation & AbstractInterpretationInfo>,
	expression: RNode<ParentInformation>,
	info: ResolveInfo
): DataFrameOperation[] | undefined {
	const dataFrame = access.accessed;

	if(resolveIdToAbstractValue(dataFrame, info.graph) === undefined) {
		return;
	}
	const argName = resolveIdToArgValueSymbolName(access.access[0], info);

	return [{
		operation: 'assignCols',
		operand:   dataFrame.info.id,
		columns:   argName ? [argName] : undefined
	}];
}

function mapDataFrameIndexColRowAssignment(
	access: RIndexAccess<ParentInformation & AbstractInterpretationInfo>,
	expression: RNode<ParentInformation>,
	info: ResolveInfo
): DataFrameOperation[] | undefined {
	const dataFrame = access.accessed;
	const args = access.access;

	if(resolveIdToAbstractValue(dataFrame, info.graph) === undefined || args.every(arg => arg === EmptyArgument)) {
		return;
	}
	const result: DataFrameOperation[] = [];
	const rowArg = args.length < 2 ? undefined : args[0];
	const colArg = args.length < 2 ? args[0] : args[1];

	if(rowArg !== undefined && rowArg !== EmptyArgument) {
		const rowValue = resolveIdToArgValue(rowArg, info);
		let rows: number[] | undefined = undefined;

		if(typeof rowValue === 'number') {
			rows = [rowValue];
		} else if(Array.isArray(rowValue) && rowValue.every(row => typeof row === 'number')) {
			rows = rowValue;
		}
		result.push({
			operation: 'assignRows',
			operand:   dataFrame.info.id,
			rows
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
		result.push({
			operation: 'assignCols',
			operand:   dataFrame.info.id,
			columns
		});
	}
	return result;
}

function mapDataFrameColNamesAssignment(
	operand: RArgument<ParentInformation & AbstractInterpretationInfo>,
	expression: RNode<ParentInformation>,
	info: ResolveInfo
): DataFrameOperation[] | undefined {
	if(resolveIdToAbstractValue(operand, info.graph) === undefined) {
		return;
	}
	const argument = info.idMap !== undefined ? toUnnamedArgument(expression, info.idMap) : EmptyArgument;
	const assignedNames = resolveIdToArgStringVector(argument, info);

	return [{
		operation: 'setColNames',
		operand:   operand.value?.info.id,
		colnames:  assignedNames
	}];
}

function mapDataFrameRowNamesAssignment(): DataFrameOperation[] | undefined {
	return;
}

function mapDataFrameDimNamesAssignment(
	operand: RArgument<ParentInformation & AbstractInterpretationInfo>,
	expression: RNode<ParentInformation>,
	info: ResolveInfo
): DataFrameOperation[] | undefined {
	if(resolveIdToAbstractValue(operand, info.graph) === undefined) {
		return;
	}
	return [{
		operation: 'setColNames',
		operand:   operand.value?.info.id,
		colnames:  undefined
	}];
}

function mapDataFrameUnknownAssignment(
	operand: RArgument<ParentInformation & AbstractInterpretationInfo>,
	expression: RNode<ParentInformation>,
	info: ResolveInfo
): DataFrameOperation[] | undefined {
	if(resolveIdToAbstractValue(operand, info.graph) === undefined) {
		return;
	}
	return [{
		operation: 'unknown',
		operand:   operand.value?.info.id,
		type:      ConstraintType.OperandModification
	}];
}
