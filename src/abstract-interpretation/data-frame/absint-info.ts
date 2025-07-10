import type { RNode } from '../../r-bridge/lang-4.x/ast/model/model';
import type { ParentInformation } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { DataFrameStateDomain } from './domain';
import type { ConstraintType, DataFrameOperationArgs, DataFrameOperationName, DataFrameOperationOptions } from './semantics';

/**
 * An abstract data frame operation.
 * - `operation` contains the type of the abstract operations (see {@link DataFrameOperationName})
 * - `operand` contains the ID of the data frame operand of the operations (may be `undefined`)
 * - `type` optionally contains the constraint type to overwrite the default type of the operations (see {@link ConstraintType})
 * - `options` optionally contains additional options for the abstract operation (see {@link DataFrameOperationOptions})
 * - `...args` contains the arguments of the abstract operation (see {@link DataFrameOperationArgs})
 */
export type DataFrameOperation = {
    [Name in DataFrameOperationName]: {
		operation: Name,
		operand:   NodeId | undefined,
		type?:     ConstraintType,
		options?:  DataFrameOperationOptions<Name>
	} & DataFrameOperationArgs<Name>;
}[DataFrameOperationName];

interface DataFrameInfoBase {
	type?:   string,
	domain?: DataFrameStateDomain
}

/** Enum to mark nodes during the data frame shape inference */
export enum DataFrameInfoMarker {
	/** Marks the target symbol of assignments as "unassigned" until the assigned expression is evaluated */
	Unassigned = 'unassigned'
}

/**
 * Represents a node without extra data frame information.
 * The `marker` can be used to mark nodes during the data frame shape inference
 */
interface DataFrameEmptyInfo extends DataFrameInfoBase {
	type?:   never,
	marker?: DataFrameInfoMarker
}

/**
 * Represents a symbol assignment with a target identifier (symbol) and assigned expression.
 */
export interface DataFrameAssignmentInfo extends DataFrameInfoBase {
	type:       'assignment',
	identifier: NodeId,
	expression: NodeId
}

/**
 * Represents a data frame expression with mapped abstract operations.
 */
export interface DataFrameExpressionInfo extends DataFrameInfoBase {
	type:       'expression',
	operations: DataFrameOperation[]
}

/**
 * Represents the data frame shape inference information attached to AST nodes
 */
export type DataFrameInfo = DataFrameEmptyInfo | DataFrameAssignmentInfo | DataFrameExpressionInfo;

/**
 * Represents the abstract interpretation information attached to AST nodes
 */
export interface AbstractInterpretationInfo {
	dataFrame?: DataFrameInfo
}

/**
 * Checks whether an AST node has attached data frame assignment information.
 */
export function hasDataFrameAssignmentInfo(
	node: RNode<ParentInformation & AbstractInterpretationInfo>
): node is RNode<ParentInformation & AbstractInterpretationInfo & { dataFrame: DataFrameAssignmentInfo }> {
	return node.info.dataFrame?.type === 'assignment';
}

/**
 * Checks whether an AST node has attached data frame expression information.
 */
export function hasDataFrameExpressionInfo(
	node: RNode<ParentInformation & AbstractInterpretationInfo>
): node is RNode<ParentInformation & AbstractInterpretationInfo & { dataFrame: DataFrameExpressionInfo }> {
	return node.info.dataFrame?.type === 'expression';
}

/**
 * Checks whether an AST node has an attached data frame info marker.
 */
export function hasDataFrameInfoMarker(
	node: RNode<ParentInformation & AbstractInterpretationInfo>,
	marker: DataFrameInfoMarker
): boolean {
	return node.info.dataFrame?.type === undefined && node.info.dataFrame?.marker === marker;
}
