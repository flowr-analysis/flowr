import { VariableResolve } from '../../../config';
import type { BuiltInMappingName } from '../../../dataflow/environments/built-in';
import type { ResolveInfo } from '../../../dataflow/eval/resolve/alias-tracking';
import type { DataflowGraph } from '../../../dataflow/graph/graph';
import { isFunctionCallVertex } from '../../../dataflow/graph/vertex';
import { toUnnamedArgument } from '../../../dataflow/internal/process/functions/call/argument/make-argument';
import type { ReadOnlyFlowrAnalyzerContext } from '../../../project/context/flowr-analyzer-context';
import type { RNode } from '../../../r-bridge/lang-4.x/ast/model/model';
import type { RAccess, RIndexAccess, RNamedAccess } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-access';
import type { RArgument } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import { EmptyArgument } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { ParentInformation } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { RType } from '../../../r-bridge/lang-4.x/ast/model/type';
import { resolveIdToArgStringVector, resolveIdToArgValue, resolveIdToArgValueSymbolName } from '../resolve-args';
import { ConstraintType } from '../semantics';
import type { DataFrameOperations, DataFrameShapeInferenceVisitor } from '../shape-inference';
import { isStringBasedAccess } from './access-mapper';
import { isDataFrameArgument, isRNull } from './arguments';

/** Mapper for mapping the supported data frame replacement functions to mapper functions */
const DataFrameReplacementFunctionMapper = {
	'colnames': mapDataFrameColNamesAssignment,
	'names':    mapDataFrameColNamesAssignment,
	'rownames': mapDataFrameRowNamesAssignment,
	'dimnames': mapDataFrameDimNamesAssignment
} as const satisfies Record<string, DataFrameReplacementFunctionMapping>;

/**
 * Data frame function mapper for mapping a concrete data frame function function to abstract data frame operations.
 * - `operand` contains the data frame operand of the replacement function
 * - `expression` contains the assigned expression of the replacement function
 * - `info` contains the resolve information
 * - `parent` optionally contains a parent replacement function, such as the access `[` in `colnames(df)[1:2] <- ...`
 */
type DataFrameReplacementFunctionMapping = (
    operand: RArgument<ParentInformation>,
    expression: RNode<ParentInformation>,
	inference: DataFrameShapeInferenceVisitor,
    info: ResolveInfo,
	parent?: RNode<ParentInformation>
) => DataFrameOperations;

/** All currently supported data frame replacement functions */
type DataFrameReplacementFunction = keyof typeof DataFrameReplacementFunctionMapper;

/**
 * Maps a concrete data frame replacement function call to abstract data frame operations.
 * @param node - The R node of the replacement function call
 * @param dfg  - The data flow graph for resolving the arguments
 * @param ctx - The current flowR analysis context
 * @returns The mapped abstract data frame operations for the replacement function call, or `undefined` if the node does not represent a data frame replacement function call
 */
export function mapDataFrameReplacementFunction(
	node: RNode<ParentInformation>,
	expression: RNode<ParentInformation>,
	inference: DataFrameShapeInferenceVisitor,
	dfg: DataflowGraph,
	ctx: ReadOnlyFlowrAnalyzerContext
): DataFrameOperations {
	const parent = hasParentReplacement(node, dfg) ? dfg.idMap?.get(node.info.parent) : undefined;
	const resolveInfo = { graph: dfg, idMap: dfg.idMap, full: true, resolve: VariableResolve.Alias, ctx };

	if(node.type === RType.Access) {
		if(node.access.every(arg => arg === EmptyArgument)) {
			return mapDataFrameContentAssignment(node, expression, inference);
		} else if(isStringBasedAccess(node)) {
			return mapDataFrameNamedColumnAssignment(node, expression, inference, resolveInfo);
		} else {
			return mapDataFrameIndexColRowAssignment(node, expression, inference, resolveInfo);
		}
	} else if(node.type === RType.FunctionCall && node.named && node.arguments.length === 1 && node.arguments[0] !== EmptyArgument) {
		if(isDataFrameReplacement(node.functionName.content)) {
			const functionName = node.functionName.content;
			const mapper = DataFrameReplacementFunctionMapper[functionName];

			return mapper(node.arguments[0], expression, inference, resolveInfo, parent);
		} else {
			return mapDataFrameUnknownAssignment(node.arguments[0], expression, inference);
		}
	}
}

function isDataFrameReplacement(functionName: string): functionName is DataFrameReplacementFunction {
	// a check with `functionName in DataFrameReplacementFunctionMapper` would return true for "toString"
	return Object.prototype.hasOwnProperty.call(DataFrameReplacementFunctionMapper, functionName);
}

function hasParentReplacement(node: RNode<ParentInformation>, dfg: DataflowGraph): node is RNode<ParentInformation & { parent: NodeId }> {
	const parentVertex = node.info.parent ? dfg.getVertex(node.info.parent) : undefined;

	return isFunctionCallVertex(parentVertex) && parentVertex.origin.includes('builtin:replacement' satisfies BuiltInMappingName);
}

function mapDataFrameContentAssignment(
	access: RAccess<ParentInformation>,
	expression: RNode<ParentInformation>,
	inference: DataFrameShapeInferenceVisitor
): DataFrameOperations {
	const dataFrame = access.accessed;

	if(!isDataFrameArgument(dataFrame, inference)) {
		return;
	}
	if(isRNull(expression)) {
		return [{
			operation: 'subsetCols',
			operand:   dataFrame.info.id,
			colnames:  [],
			type:      ConstraintType.OperandModification
		}];
	} else {
		return [{
			operation: 'identity',
			operand:   dataFrame.info.id,
			type:      ConstraintType.OperandModification
		}];
	}
}

function mapDataFrameNamedColumnAssignment(
	access: RNamedAccess<ParentInformation>,
	expression: RNode<ParentInformation>,
	inference: DataFrameShapeInferenceVisitor,
	info: ResolveInfo
): DataFrameOperations {
	const dataFrame = access.accessed;

	if(!isDataFrameArgument(dataFrame, inference)) {
		return;
	}
	const colname = resolveIdToArgValueSymbolName(access.access[0], info);

	if(isRNull(expression)) {
		return [{
			operation: 'removeCols',
			operand:   dataFrame.info.id,
			colnames:  colname ? [colname] : undefined,
			type:      ConstraintType.OperandModification,
			options:   { maybe: true }
		}];
	} else {
		return [{
			operation: 'assignCols',
			operand:   dataFrame.info.id,
			columns:   colname ? [colname] : undefined
		}];
	}
}

function mapDataFrameIndexColRowAssignment(
	access: RIndexAccess<ParentInformation>,
	expression: RNode<ParentInformation>,
	inference: DataFrameShapeInferenceVisitor,
	info: ResolveInfo
): DataFrameOperations {
	const dataFrame = access.accessed;
	const args = access.access;

	if(!isDataFrameArgument(dataFrame, inference) || args.every(arg => arg === EmptyArgument)) {
		return;
	}
	const result: DataFrameOperations = [];
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
		if(isRNull(expression)) {
			result.push({
				operation: 'removeCols',
				operand:   dataFrame.info.id,
				colnames:  columns?.map(col => typeof col === 'string' ? col : undefined),
				type:      ConstraintType.OperandModification,
				options:   { maybe: true }
			});
		} else {
			result.push({
				operation: 'assignCols',
				operand:   dataFrame.info.id,
				columns
			});
		}
	}
	return result;
}

function mapDataFrameColNamesAssignment(
	operand: RArgument<ParentInformation>,
	expression: RNode<ParentInformation>,
	inference: DataFrameShapeInferenceVisitor,
	info: ResolveInfo,
	parent?: RNode<ParentInformation>
): DataFrameOperations {
	if(!isDataFrameArgument(operand, inference)) {
		return;
	}
	const argument = info.idMap !== undefined ? toUnnamedArgument(expression, info.idMap) : EmptyArgument;
	const assignedNames = resolveIdToArgStringVector(argument, info);

	return [{
		operation: 'setColNames',
		operand:   operand.value?.info.id,
		colnames:  assignedNames,
		...(parent !== undefined ? { options: { partial: true } } : {})
	}];
}

function mapDataFrameRowNamesAssignment(
	operand: RArgument<ParentInformation>,
	expression: RNode<ParentInformation>,
	inference: DataFrameShapeInferenceVisitor
): DataFrameOperations {
	if(!isDataFrameArgument(operand, inference)) {
		return;
	}
	return [{
		operation: 'identity',
		operand:   operand.value?.info.id,
		type:      ConstraintType.OperandModification
	}];
}

function mapDataFrameDimNamesAssignment(
	operand: RArgument<ParentInformation>,
	expression: RNode<ParentInformation>,
	inference: DataFrameShapeInferenceVisitor
): DataFrameOperations {
	if(!isDataFrameArgument(operand, inference)) {
		return;
	}
	return [{
		operation: 'setColNames',
		operand:   operand.value?.info.id,
		colnames:  undefined
	}];
}

function mapDataFrameUnknownAssignment(
	operand: RArgument<ParentInformation>,
	expression: RNode<ParentInformation>,
	inference: DataFrameShapeInferenceVisitor
): DataFrameOperations {
	if(!isDataFrameArgument(operand, inference)) {
		return;
	}
	return [{
		operation: 'unknown',
		operand:   operand.value?.info.id,
		type:      ConstraintType.OperandModification
	}];
}
