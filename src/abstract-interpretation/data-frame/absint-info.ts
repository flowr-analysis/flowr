import type { RNode } from '../../r-bridge/lang-4.x/ast/model/model';
import type { ParentInformation } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { DataFrameStateDomain } from './domain';
import type { ConstraintType, DataFrameOperationArgs, DataFrameOperationName, DataFrameOperationOptions } from './semantics';

export type DataFrameOperationType<OperationName extends DataFrameOperationName = DataFrameOperationName> = {
	[Name in OperationName]: {
		operation: Name,
		operand:   NodeId | undefined
	} & DataFrameOperationArgs<Name>
}[OperationName];

export type DataFrameOperation<OperationName extends DataFrameOperationName = DataFrameOperationName> = {
    [Name in OperationName]: {
		operation: Name,
		operand:   NodeId | undefined,
		type?:     ConstraintType,
		options?:  DataFrameOperationOptions<Name>
	} & DataFrameOperationArgs<Name>;
}[OperationName];

interface DataFrameInfoBase {
	domain?: DataFrameStateDomain
}

/**
 * Marks the target symbol of assignments as "unassigned" until the assigned expression is evaluated
 */
export interface DataFrameUnassignedInfo {
	type: 'unassigned'
}

/**
 * Represents a symbol assignment with a target identifier (symbol) and assigned expression
 */
export interface DataFrameAssignmentInfo {
	type:       'assignment',
	identifier: NodeId,
	expression: NodeId
}

/**
 * Represents a data frame expression with mapped abstract operations
 */
export interface DataFrameExpressionInfo {
	type:       'expression',
	operations: DataFrameOperation[]
}

export type DataFrameInfo = DataFrameAssignmentInfo | DataFrameExpressionInfo | DataFrameUnassignedInfo;

export interface AbstractInterpretationInfo {
	dataFrame?: (DataFrameInfo | { type?: never }) & DataFrameInfoBase
}

export function hasDataFrameAssignmentInfo(
	node: RNode<ParentInformation & AbstractInterpretationInfo>
): node is RNode<ParentInformation & AbstractInterpretationInfo & { dataFrame: DataFrameAssignmentInfo }> {
	return node.info.dataFrame?.type === 'assignment';
}

export function hasDataFrameExpressionInfo(
	node: RNode<ParentInformation & AbstractInterpretationInfo>
): node is RNode<ParentInformation & AbstractInterpretationInfo & { dataFrame: DataFrameExpressionInfo }> {
	return node.info.dataFrame?.type === 'expression';
}
