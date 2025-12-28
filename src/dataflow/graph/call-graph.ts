import { DataflowGraph } from './graph';
import type {
	DataflowGraphVertexFunctionCall,
	DataflowGraphVertexFunctionDefinition,
	DataflowGraphVertexInfo
} from './vertex';
import { VertexType } from './vertex';
import type { REnvironmentInformation } from '../environments/environment';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { getAllFunctionCallTargets } from '../internal/linker';
import { edgeIncludesType, EdgeType } from './edge';
import { builtInId } from '../environments/built-in';

/**
 * A call graph is a dataflow graph where all vertices are function calls.
 */
export type CallGraph = DataflowGraph<
	Required<DataflowGraphVertexFunctionCall | DataflowGraphVertexFunctionDefinition>
>

// TODO: wiki-analyzer doku on callgraph link to a new wiki page explaining the call-graph!
/**
 * Computes the call graph from the given dataflow graph.
 */
export function computeCallGraph(graph: DataflowGraph): CallGraph {
	const result: CallGraph = new DataflowGraph(graph.idMap);
	const visited: Set<NodeId> = new Set();
	for(const [,vert] of graph.vertices(false)) {
		if(vert?.tag === VertexType.FunctionCall) {
			processCall(vert, undefined, graph, result, visited);
		}
	}
	console.log([...result.edges()]);
	return result; // pruneTransitiveEdges(result);
}

function processCall(vtx: DataflowGraphVertexFunctionCall, from: NodeId | undefined, graph: DataflowGraph, result: CallGraph, visited: Set<NodeId>): void {
	if(from) {
		result.addEdge(from, vtx.id, EdgeType.Calls);
	}
	if(visited.has(vtx.id)) {
		return;
	}
	result.addVertex(vtx, undefined as unknown as REnvironmentInformation, true);
	visited.add(vtx.id);
	// TODO: handle origins!

	// for each calls, resolve the targets
	const tars = getAllFunctionCallTargets(vtx.id, graph, vtx.environment);
	for(const tar of tars) {
		const targetVtx = graph.getVertex(tar, true);
		if(targetVtx?.tag !== VertexType.FunctionDefinition) {
			return;
		}
		processFunctionDefinition(targetVtx, vtx.id, graph, result, visited);
	}

	// handle arguments, traversing the 'reads' and the 'returns' edges
	for(const [tar, { types }] of graph.outgoingEdges(vtx.id) ?? []) {
		if(!edgeIncludesType(types, EdgeType.Reads) && !edgeIncludesType(types, EdgeType.Returns)) {
			continue;
		}
		const tVtx = graph.getVertex(tar, true);
		if(!tVtx) {
			continue;
		}
		processArg(tVtx, vtx.id, graph, result, visited);
	}
}
function processArg(vtx: DataflowGraphVertexInfo, from: NodeId | undefined, graph: DataflowGraph, result: CallGraph, visited: Set<NodeId>): void {
	switch(vtx.tag) {
		case VertexType.FunctionCall:
			processCall(vtx as DataflowGraphVertexFunctionCall, from, graph, result, visited);
			return;
		case VertexType.FunctionDefinition:
			if(from) {
				graph.addEdge(from, builtInId('function'), EdgeType.Calls);
			}
			return;
		case VertexType.Use:
			trackAliasedCallsOfUse(vtx, from, graph, result, visited);
			return;
		default:
			return;
	}
}

// TODO:
function trackAliasedCallsOfUse(vtx: DataflowGraphVertexInfo, from: NodeId | undefined, graph: DataflowGraph, result: CallGraph, visited: Set<NodeId>): void {

}



function processFunctionDefinition(vtx: DataflowGraphVertexFunctionDefinition, from: NodeId | undefined, graph: DataflowGraph, result: CallGraph, visited: Set<NodeId>): void {
	result.addVertex(vtx, undefined as unknown as REnvironmentInformation, true);
	if(from) {
		result.addEdge(from, vtx.id, EdgeType.Calls);
	}
	const s = vtx.exitPoints;
	for(const id of s) {
		const v = graph.getVertex(id, true);
		if(v) {
			processArg(v, vtx.id, graph, result, visited);
		}
	}
}

/*
function pruneTransitiveEdges(graph: CallGraph): CallGraph {
	const newGraph: CallGraph = new DataflowGraph(graph.idMap);
	for(const [,vert] of graph.vertices(true)) {
		newGraph.addVertex(vert, undefined as unknown as REnvironmentInformation, true);
	}
	const foundPaths = new DefaultMap(() => new Set<NodeId>());
	function hasTransitivePath(from: NodeId, to: NodeId): boolean {
		const visited = new Set<NodeId>();
		// TODO: improve
		const stack: NodeId[] = Array.from(graph.outgoingEdges(from)?.entries()?.map(([id]) => id).filter(f => f !== to) ?? []);
		while(stack.length > 0) {
			console.log(stack.length);
			const current = stack.pop() as NodeId;
			if(current === to || foundPaths.get(from).has(to) || visited.has(from)) {
				return true;
			}
			visited.add(current);
			for(const [next] of graph.outgoingEdges(current) ?? []) {
				if(!visited.has(next)) {
					stack.push(next);
				}
			}
		}
		return false;
	}

	for(const [from, targets] of graph.edges()) {
		for(const [to, { types }] of targets) {
			if(!edgeIncludesType(types, EdgeType.Calls) || foundPaths.get(from).has(to)) {
				continue;
			}
			if(!hasTransitivePath(from, to)) {
				newGraph.addEdge(from, to, EdgeType.Calls);
			}
			foundPaths.get(from).add(to);

		}
	}
	return newGraph;
}

 */