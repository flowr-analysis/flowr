import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { DataflowGraph } from '../graph/graph';
import type { DataflowGraphVertexArgument, DataflowGraphVertexFunctionDefinition } from '../graph/vertex';
import { isFunctionCallVertex, isFunctionDefinitionVertex } from '../graph/vertex';
import { isNotUndefined } from '../../util/assert';
import { edgeIncludesType, EdgeType } from '../graph/edge';
import { resolveIdToValue } from '../eval/resolve/alias-tracking';
import { VariableResolve } from '../../config';
import { EmptyArgument } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { valueSetGuard } from '../eval/values/general';

function isAnyReturnAFunction(def: DataflowGraphVertexFunctionDefinition, graph: DataflowGraph): boolean {
	const workingQueue: DataflowGraphVertexArgument[] = def.exitPoints.map(d => graph.getVertex(d, true)).filter(isNotUndefined);
	const seen = new Set<NodeId>();
	while(workingQueue.length > 0) {
		const current = workingQueue.pop() as DataflowGraphVertexArgument;
		if(seen.has(current.id)) {
			continue;
		}
		seen.add(current.id);
		if(isFunctionDefinitionVertex(current)) {
			return true;
		}
		const next = graph.outgoingEdges(current.id) ?? [];
		for(const [t, { types }] of next) {
			if(edgeIncludesType(types, EdgeType.Returns)) {
				const v = graph.getVertex(t, true);
				if(v) {
					workingQueue.push(v);
				}
			}
		}
	}
	return false;
}

function inspectCallSitesArgumentsFns(def: DataflowGraphVertexFunctionDefinition, graph: DataflowGraph): boolean {
	const callSites = graph.ingoingEdges(def.id);

	for(const [callerId, { types }] of callSites ?? []) {
		if(!edgeIncludesType(types, EdgeType.Calls)) {
			continue;
		}
		const caller = graph.getVertex(callerId, true);
		if(!caller || !isFunctionCallVertex(caller)) {
			continue;
		}
		for(const arg of caller.args) {
			if(arg === EmptyArgument) {
				continue;
			}
			const value = valueSetGuard(resolveIdToValue(arg.nodeId, { graph, idMap: graph.idMap, resolve: VariableResolve.Alias, full: true }));
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
 */
export function isHigherOrder(id: NodeId, graph: DataflowGraph): boolean {
	const vert = graph.getVertex(id);
	if(!vert || !isFunctionDefinitionVertex(vert)) {
		return false;
	}

	// 1. check whether any of the exit types is a function
	if(isAnyReturnAFunction(vert, graph)) {
		return true;
	}

	// 2. check whether any of the callsites passes a function
	return inspectCallSitesArgumentsFns(vert, graph);
}