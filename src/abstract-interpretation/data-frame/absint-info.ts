import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { DataFrameStateDomain } from './domain';
import type { DataFrameOperationName } from './semantics';

export interface DataFrameOperation {
	operation: DataFrameOperationName,
	operand:   NodeId | undefined,
	arguments: (NodeId | undefined)[],
	modify?:   boolean
}

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

export interface DataFrameOtherInfo {
	type: 'other'
}

export type DataFrameInfo = DataFrameAssignmentInfo | DataFrameExpressionInfo | DataFrameOtherInfo;

export interface AbstractInterpretationInfo {
	dataFrame?: DataFrameInfo & DataFrameInfoBase
}
