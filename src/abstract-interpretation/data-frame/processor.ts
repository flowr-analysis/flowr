import { type DataflowGraph } from '../../dataflow/graph/graph';
import type { RNode } from '../../r-bridge/lang-4.x/ast/model/model';
import type { RBinaryOp } from '../../r-bridge/lang-4.x/ast/model/nodes/r-binary-op';
import type { RFunctionCall } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { EmptyArgument } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { ParentInformation } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { RType } from '../../r-bridge/lang-4.x/ast/model/type';
import type { RFalse, RTrue } from '../../r-bridge/lang-4.x/convert-values';
import type { DataFrameStateDomain  } from './domain';

export type ConditionalDataFrameState = Record<'FD' | typeof RTrue | typeof RFalse, DataFrameStateDomain>;

export function processDataFrameNode<OtherInfo>(
	node: RNode<OtherInfo & ParentInformation>,
	domain: DataFrameStateDomain,
	dfg: DataflowGraph
): DataFrameStateDomain | ConditionalDataFrameState {
	switch(node.type) {
		case RType.BinaryOp:
			return processBinaryOp(node, domain, dfg);
		case RType.FunctionCall:
			return processFunctionCall(node, domain, dfg);
		default:
			return domain;
	}
}

function processBinaryOp<OtherInfo>(
	node: RBinaryOp<OtherInfo & ParentInformation>,
	domain: DataFrameStateDomain,
	dfg: DataflowGraph
): DataFrameStateDomain | ConditionalDataFrameState {
	console.log(node, dfg.get(node.info.id), { lhs: dfg.get(node.lhs.info.id), rhs: dfg.get(node.rhs.info.id) });
	return domain;
}

function processFunctionCall<OtherInfo>(
	node: RFunctionCall<OtherInfo & ParentInformation>,
	domain: DataFrameStateDomain,
	dfg: DataflowGraph
): DataFrameStateDomain | ConditionalDataFrameState {
	console.log(node, dfg.get(node.info.id), node.arguments.map(arg => arg !== EmptyArgument && arg.value ? dfg.get(arg.value?.info.id) : undefined));
	return domain;
}
