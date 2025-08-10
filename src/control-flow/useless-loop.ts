import type { VariableResolve } from '../config';
import { resolveIdToValue } from '../dataflow/eval/resolve/alias-tracking';
import { valueSetGuard } from '../dataflow/eval/values/general';
import { isValue } from '../dataflow/eval/values/r-value';
import type { DataflowGraph } from '../dataflow/graph/graph';
import { VertexType } from '../dataflow/graph/vertex';
import { EmptyArgument } from '../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';
import { guard } from '../util/assert';
import type { ControlFlowInformation } from './control-flow-graph';


/**
 * Checks wheter a loop only loops once 
 * 
 * 
 * 
 * @param loop        - nodeid of the loop to analyse
 * @param dataflow    - dataflow graph
 * @param controlflow - controlflow graph
 * @returns true if the given loop only iterates once
 */
export function onlyLoopsOnce(loop: NodeId, dataflow: DataflowGraph, controlflow: ControlFlowInformation, resolveConfig: VariableResolve): boolean | undefined {
	const vertex = dataflow.getVertex(loop);
	if(!vertex) {
		return undefined;
	}

	guard(vertex.tag === VertexType.FunctionCall, 'onlyLoopsOnce can only be called on loops');

	// 1.  In case of for loop, check if vector has only one element
	if(vertex.origin !== 'unnamed' && vertex.origin[0] === 'builtin:for-loop') {
		if(vertex.args.length < 2) {
			return undefined;
		}	

		const vectorOfLoop = vertex.args[1];
		if(vectorOfLoop === EmptyArgument) {
			return undefined;
		}

		const values = valueSetGuard(resolveIdToValue(vectorOfLoop.nodeId, { graph: dataflow, idMap: dataflow.idMap, resolve: resolveConfig }));
		if(values === undefined || values.elements.length !== 1 || values.elements[0].type !== 'vector' || !isValue(values.elements[0].elements)) {
			return undefined;
		}

		if(values.elements[0].elements.length === 1) {
			return true;
		}
	}


	// 2. Use CFG Visitor to determine if loop always exits after the first iteration
}