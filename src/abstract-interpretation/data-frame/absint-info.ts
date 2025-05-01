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

export interface DataFrameAssignmentInfo {
	type:       'assignment',
	identifier: NodeId,
	expression: NodeId
}

export interface DataFrameExpressionInfo {
	type:       'expression',
	operations: DataFrameOperations[]
}

export type DataFrameInfo = DataFrameAssignmentInfo | DataFrameExpressionInfo;

export interface AbstractInterpretationInfo {
	dataFrame?: (DataFrameInfo & DataFrameInfoBase) | DataFrameInfoBase
}
