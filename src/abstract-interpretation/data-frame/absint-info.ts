import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { DataFrameStateDomain } from './domain';
import type { DataFrameOperationArgs, DataFrameOperationName } from './semantics';

export type DataFrameOperation = {
    [Name in DataFrameOperationName]: {
		operation: Name,
		operand:   NodeId | undefined
	} & DataFrameOperationArgs<Name>;
}[DataFrameOperationName];

interface DataFrameInfoBase {
	domain?: DataFrameStateDomain
}

export interface DataFrameAssignmentInfo {
	type:       'assignment',
	identifier: NodeId,
	expression: NodeId
}

export interface DataFrameExpressionInfo {
	type:       'expression',
	operations: DataFrameOperation[]
}

export type DataFrameInfo = DataFrameAssignmentInfo | DataFrameExpressionInfo;

export interface AbstractInterpretationInfo {
	dataFrame?: (DataFrameInfo | { type?: never }) & DataFrameInfoBase
}
