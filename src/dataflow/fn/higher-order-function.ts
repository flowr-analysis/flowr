import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { DataflowGraph } from '../graph/graph';
import {
	type DataflowGraphVertexArgument,
	type DataflowGraphVertexFunctionDefinition,
	FunctionCallVertex,
	FunctionDefinitionVertex
} from '../graph/vertex';
import { isNotUndefined } from '../../util/assert';
import { DfEdge, EdgeType } from '../graph/edge';
import { NodeValue } from '../eval/resolve/node-value';
import { VariableResolve } from '../../config';
import { EmptyArgument } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { ReadOnlyFlowrAnalyzerContext } from '../../project/context/flowr-analyzer-context';

function isAnyReturnAFunction(def: DataflowGraphVertexFunctionDefinition, graph: DataflowGraph): boolean {
	const workingQueue: DataflowGraphVertexArgument[] = def.exitPoints.map(d => graph.getVertex(d.nodeId)).filter(isNotUndefined);
	const seen = new Set<NodeId>();
	while(workingQueue.length > 0) {
		const current = workingQueue.pop() as DataflowGraphVertexArgument;
		if(seen.has(current.id)) {
			continue;
		}
		seen.add(current.id);
		if(FunctionDefinitionVertex.is(current)) {
			return true;
		}
		const next = graph.outgoingEdges(current.id) ?? [];
		for(const [t, e] of next) {
			if(DfEdge.includesType(e, EdgeType.Returns)) {
				const v = graph.getVertex(t);
				if(v) {
					workingQueue.push(v);
				}
			}
		}
	}
	return false;
}

function inspectCallSitesArgumentsFns(def: DataflowGraphVertexFunctionDefinition, graph: DataflowGraph, ctx: ReadOnlyFlowrAnalyzerContext, invertedGraph?: DataflowGraph): boolean {
	const callSites = invertedGraph?.outgoingEdges(def.id) ?? graph.ingoingEdges(def.id);

	for(const [callerId, e] of callSites ?? []) {
		if(!DfEdge.includesType(e, EdgeType.Calls)) {
			continue;
		}
		const caller = graph.getVertex(callerId);
		if(!caller || !FunctionCallVertex.is(caller)) {
			continue;
		}
		for(const arg of caller.args) {
			if(arg === EmptyArgument) {
				continue;
			}
			const value = NodeValue.inGraph.setOf(arg.nodeId, graph, ctx, { resolve: VariableResolve.Alias });
			if(value?.elements.some(e => e.type === 'function-definition')) {
				return true;
			}
		}
	}
	return false;
}

/**
 * Determines whether the function with the given id is a higher-order function, i.e.,
 * either takes a function as an argument or (may) returns a function.
 * If the return is an identity, e.g., `function(x) x`, this is not considered higher-order,
 * if no function is passed as an argument.
 * Please note that inspecting higher order functions can be sped up (if queries multiple times) by providing an inverted graph as well!
 */
export function isFunctionHigherOrder(id: NodeId, graph: DataflowGraph, ctx: ReadOnlyFlowrAnalyzerContext, invertedGraph?: DataflowGraph): boolean {
	const vert = graph.getVertex(id);
	if(!vert || !FunctionDefinitionVertex.is(vert)) {
		return false;
	}

	// 1. check whether any of the exit types is a function
	if(isAnyReturnAFunction(vert, graph)) {
		return true;
	}

	// 2. check whether any of the callsites passes a function
	return inspectCallSitesArgumentsFns(vert, graph, ctx, invertedGraph);
}