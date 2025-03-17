import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { DataFrameDomain } from './domain';
import type { DataFrameOperationName } from './semantics';

export interface DataFrameOperation {
	operation: DataFrameOperationName,
	operand:   NodeId | undefined,
	arguments: (NodeId | undefined)[],
	modify?:   boolean
}

interface DataFrameInfo {
	type:    string;
	domain?: Map<NodeId, DataFrameDomain>
}

export interface DataFrameAssignmentInfo extends DataFrameInfo {
	type:       'assignment',
	identifier: NodeId,
	expression: NodeId
}

export interface DataFrameExpressionInfo extends DataFrameInfo {
	type:       'expression',
	operations: DataFrameOperation[]
}

export interface DataFrameOtherInfo extends DataFrameInfo {
	type: 'other'
}

export interface AbstractInterpretationInfo {
	dataFrame?: DataFrameAssignmentInfo | DataFrameExpressionInfo | DataFrameOtherInfo
}
