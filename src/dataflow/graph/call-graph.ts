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

// TODO: wiki-analyzer doku on callgraph link to a new wiki page explaining the call-graph!; explain cg as a *view* of the DFG
/**
 * Computes the call graph from the given dataflow graph.
 */
export function computeCallGraph(graph: DataflowGraph): CallGraph {
	const result: CallGraph = new DataflowGraph(graph.idMap);
	const visited: Set<NodeId> = new Set();
	for(const [,vert] of graph.vertices(false)) {
		if(vert?.tag === VertexType.FunctionCall) {
			processCall(vert, undefined, graph, result, visited);
		} else if(vert?.tag === VertexType.FunctionDefinition) {
			processFunctionDefinition(vert, undefined, graph, result, visited);
		}
	}
	return result; // pruneTransitiveEdges(result);
}

function processCds(vtx: DataflowGraphVertexInfo, graph: DataflowGraph, result: CallGraph, visited: Set<NodeId>): void {
	for(const tar of vtx.cds ?? []) {
		const targetVtx = graph.getVertex(tar.id, true);
		if(targetVtx) {
			processUnknown(targetVtx, undefined, graph, result, visited);
		}
	}
}

function processCall(vtx: Required<DataflowGraphVertexFunctionCall>, from: NodeId | undefined, graph: DataflowGraph, result: CallGraph, visited: Set<NodeId>): void {
	if(from) {
		result.addEdge(from, vtx.id, EdgeType.Calls);
	}
	if(visited.has(vtx.id)) {
		return;
	}
	result.addVertex(vtx, undefined as unknown as REnvironmentInformation, true);
	processCds(vtx, graph, result, visited);
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
	if(vtx.origin !== 'unnamed') {
		for(const origs of vtx.origin) {
			if(origs.startsWith('builtin:')) {
				result.addEdge(vtx.id, builtInId(
					origs.substring('builtin:'.length)
				), EdgeType.Calls);
			}
		}
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
		processUnknown(tVtx, vtx.id, graph, result, visited);
	}
}
function processUnknown(vtx: DataflowGraphVertexInfo, from: NodeId | undefined, graph: DataflowGraph, result: CallGraph, visited: Set<NodeId>): void {
	switch(vtx.tag) {
		case VertexType.FunctionCall:
			processCall(vtx, from, graph, result, visited);
			return;
		case VertexType.FunctionDefinition:
			if(from) {
				result.addEdge(from, builtInId('function'), EdgeType.Calls);
			}
			return;
		default:
			return;
	}
}

function processFunctionDefinition(vtx: Required<DataflowGraphVertexFunctionDefinition>, from: NodeId | undefined, graph: DataflowGraph, result: CallGraph, visited: Set<NodeId>): void {
	result.addVertex(vtx, undefined as unknown as REnvironmentInformation, true);
	processCds(vtx, graph, result, visited);

	if(from) {
		result.addEdge(from, vtx.id, EdgeType.Calls);
	}
	const s = vtx.exitPoints;
	for(const id of s) {
		const v = graph.getVertex(id, true);
		if(v) {
			processUnknown(v, vtx.id, graph, result, visited);
		}
	}
}
