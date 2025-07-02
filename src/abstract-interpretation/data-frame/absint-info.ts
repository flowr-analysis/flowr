import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { DataFrameStateDomain } from './domain';
import type { DataFrameOperationArgs, DataFrameOperationName } from './semantics';

export interface DataFrameOperation<Name extends DataFrameOperationName> {
	operation: Name,
	operand:   NodeId | undefined,
	args:      DataFrameOperationArgs<Name>
}

export type DataFrameOperations = {
    [Name in DataFrameOperationName]: DataFrameOperation<Name>;
}[DataFrameOperationName];

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
	operations: DataFrameOperations[]
}

export type DataFrameInfo = DataFrameAssignmentInfo | DataFrameExpressionInfo | DataFrameUnassignedInfo;

export interface AbstractInterpretationInfo {
	dataFrame?: (DataFrameInfo | { type?: never }) & DataFrameInfoBase
}
