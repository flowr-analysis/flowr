import { DataflowGraph } from './graph';
import type {
	DataflowGraphVertexFunctionCall,
	DataflowGraphVertexFunctionDefinition,
	DataflowGraphVertexInfo } from './vertex';
import {
	VertexType
} from './vertex';
import type { REnvironmentInformation } from '../environments/environment';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { getAllFunctionCallTargets } from '../internal/linker';
import { edgeDoesNotIncludeType, edgeIncludesType, EdgeType } from './edge';
import { builtInId, isBuiltIn } from '../environments/built-in';
import { DefaultMap } from '../../util/collections/defaultmap';

/**
 * A call graph is a dataflow graph where all vertices are function calls.
 */
export type CallGraph = DataflowGraph<
	Required<DataflowGraphVertexFunctionCall | DataflowGraphVertexFunctionDefinition>
>

interface State {
	visited:           Set<NodeId>;
	// links to be added if not otherwise found
	potentials:        [NodeId, Set<NodeId>][]
	knownReachability: DefaultMap<NodeId, Set<NodeId>>;
}

function reaches(from: NodeId, to: NodeId, graph: DataflowGraph, knownReachability: DefaultMap<NodeId, Set<NodeId>>): boolean {
	const visited: Set<NodeId> = new Set();
	const toVisit: NodeId[] = [from];

	while(toVisit.length > 0) {
		const currentId = toVisit.pop() as NodeId;
		if(visited.has(currentId)) {
			continue;
		}
		if(currentId === to) {
			knownReachability.get(from).add(to);
			return true;
		} else if(knownReachability.get(currentId).has(to)) {
			knownReachability.get(from).add(to);
			return true;
		}
		visited.add(currentId);
		for(const [tar] of graph.outgoingEdges(currentId) ?? []) {
			toVisit.push(tar);
		}
	}
	return false;
}

/**
 * Computes the call graph from the given dataflow graph.
 */
export function computeCallGraph(graph: DataflowGraph): CallGraph {
	const result: CallGraph = new DataflowGraph(graph.idMap);
	const state: State = {
		visited:           new Set(),
		potentials:        [],
		knownReachability: new DefaultMap(() => new Set())
	};
	for(const [,vert] of graph.vertices(false)) {
		if(vert?.tag === VertexType.FunctionCall) {
			processCall(vert, undefined, graph, result, state);
		} else if(vert?.tag === VertexType.FunctionDefinition) {
			processFunctionDefinition(vert, undefined, graph, result, state);
		}
	}
	for(const [from, tos] of state.potentials) {
		for(const to of tos) {
			if(!result.hasVertex(to)) {
				const v = graph.getVertex(to, true);
				if(v) {
					processUnknown(v, from, graph, result, state);
				}
			} else if(!reaches(from, to, result, state.knownReachability)) {
				result.addEdge(from, to, EdgeType.Calls);
			}
		}
	}
	return result;
}

function processCds(vtx: DataflowGraphVertexInfo, graph: DataflowGraph, result: CallGraph, state: State): void {
	for(const tar of vtx.controlDependencies ?? []) {
		const targetVtx = graph.getVertex(tar.id, true);
		if(targetVtx) {
			processUnknown(targetVtx, undefined, graph, result, state);
		}
	}
}

/**
 * This tracks the known symbol origins for a function call for which we know that flowr found no targets!
 */
function fallbackUntargetedCall(vtx: Required<DataflowGraphVertexFunctionCall>, graph: DataflowGraph): Set<NodeId> {
	// we track all aliases to their roots here, we know there is no known call target
	const collected: Set<NodeId> = new Set();
	const visited: Set<NodeId> = new Set();
	const toVisit: NodeId[] = [vtx.id];

	while(toVisit.length > 0) {
		const currentId = toVisit.pop() as NodeId;
		if(visited.has(currentId)) {
			continue;
		}
		visited.add(currentId);
		const currentVtx = graph.getVertex(currentId, true);
		if(!currentVtx) {
			continue;
		}
		let addedNew = false;
		for(const [tar, { types }] of graph.outgoingEdges(currentId) ?? []) {
			if(edgeIncludesType(types, EdgeType.Reads | EdgeType.DefinedByOnCall | EdgeType.DefinedBy | EdgeType.Returns) && edgeDoesNotIncludeType(types, EdgeType.NonStandardEvaluation | EdgeType.Argument)) {
				addedNew = true;
				toVisit.push(tar);
			}
		}
		// we have reached our end(s)
		if(!addedNew && currentId !== vtx.id) {
			collected.add(currentId);
		}
	}

	return collected;
}

function processCall(vtx: Required<DataflowGraphVertexFunctionCall>, from: NodeId | undefined, graph: DataflowGraph, result: CallGraph, state: State): void {
	if(from && !reaches(from, vtx.id, result, state.knownReachability)) {
		result.addEdge(from, vtx.id, EdgeType.Calls);
	}
	if(state.visited.has(vtx.id)) {
		return;
	}
	result.addVertex(vtx, undefined as unknown as REnvironmentInformation, true);
	processCds(vtx, graph, result, state);
	state.visited.add(vtx.id);

	// for each call, resolve the targets
	const tars = getAllFunctionCallTargets(vtx.id, graph, vtx.environment);
	let addedTarget = false;
	for(const tar of tars) {
		if(isBuiltIn(tar)) {
			result.addEdge(vtx.id, tar, EdgeType.Calls);
			addedTarget = true;
			continue;
		}
		const targetVtx = graph.getVertex(tar, true);
		if(targetVtx?.tag !== VertexType.FunctionDefinition) {
			continue;
		}
		addedTarget = true;
		processFunctionDefinition(targetVtx, vtx.id, graph, result, state);
	}
	if(vtx.origin !== 'unnamed') {
		for(const origs of vtx.origin) {
			if(origs.startsWith('builtin:')) {
				addedTarget = true;
				result.addEdge(vtx.id, builtInId(
					origs.substring('builtin:'.length)
				), EdgeType.Calls);
			}
		}
	}
	if(!addedTarget) {
		const origs = fallbackUntargetedCall(vtx, graph);
		for(const ori of origs) {
			const oriVtx = graph.getVertex(ori, true);
			if(!oriVtx) {
				continue;
			}
			result.addEdge(vtx.id, ori, EdgeType.Calls);
			const name = graph.idMap?.get(ori);
			if(name?.lexeme && oriVtx.tag === VertexType.Use) {
				result.addVertex({
					...oriVtx,
					tag:         VertexType.FunctionCall,
					name:        name.lexeme,
					onlyBuiltin: false,
					origin:      ['function'],
					args:        []
				}, oriVtx.environment);
			}
		}
	}

	// handle arguments, traversing the 'reads' and the 'returns' edges
	for(const [tar, { types }] of graph.outgoingEdges(vtx.id) ?? []) {
		if(edgeDoesNotIncludeType(types, EdgeType.Reads | EdgeType.Returns | EdgeType.Argument)) {
			continue;
		}
		const tVtx = graph.getVertex(tar, true);
		if(!tVtx) {
			continue;
		}
		processUnknown(tVtx, vtx.id, graph, result, state);
	}
}
function processUnknown(vtx: DataflowGraphVertexInfo, from: NodeId | undefined, graph: DataflowGraph, result: CallGraph, state: State): void {
	switch(vtx.tag) {
		case VertexType.FunctionCall:
			processCall(vtx, from, graph, result, state);
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

function processFunctionDefinition(vtx: Required<DataflowGraphVertexFunctionDefinition>, from: NodeId | undefined, graph: DataflowGraph, result: CallGraph, state: State): void {
	if(from) {
		result.addEdge(from, vtx.id, EdgeType.Calls);
	}
	if(state.visited.has(vtx.id)) {
		return;
	}
	state.visited.add(vtx.id);
	result.addVertex(vtx, undefined as unknown as REnvironmentInformation, true);
	processCds(vtx, graph, result, state);

	const exits = new Set(vtx.exitPoints);
	for(const { nodeId } of exits) {
		const v = graph.getVertex(nodeId, true);
		if(v) {
			processUnknown(v, vtx.id, graph, result, state);
		}
	}
	state.potentials.push([vtx.id, vtx.subflow.graph.difference(exits)]);
}
