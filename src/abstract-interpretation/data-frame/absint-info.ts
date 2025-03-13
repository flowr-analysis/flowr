import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { DataFrameDomain } from './domain';
import type { DataFrameOperationName } from './semantics';

export interface DataFrameOperation {
	operation: DataFrameOperationName,
	operand:   NodeId | undefined,
	arguments: (NodeId | undefined)[]
}

interface DataFrameStatementInfo {
	type:   'statement',
	domain: Map<NodeId, DataFrameDomain>
}

interface DataFrameAssignmentInfo {
	type:       'assignment',
	identifier: NodeId,
	expression: NodeId
}

interface DataFrameExpressionInfo {
	type:       'expression',
	operations: DataFrameOperation[]
}

interface DataFrameSymbolInfo {
	type:  'symbol',
	value: DataFrameDomain
}

type DataFrameInfo = DataFrameStatementInfo | DataFrameAssignmentInfo | DataFrameExpressionInfo | DataFrameSymbolInfo;

export interface AbstractInterpretationInfo {
	dataFrame?: DataFrameInfo
}
