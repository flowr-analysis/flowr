import { DataflowGraph } from './graph';
import type {
	DataflowGraphVertexFunctionCall,
	DataflowGraphVertexFunctionDefinition,
	DataflowGraphVertexInfo
} from './vertex';
import { VertexType, DfgVertex } from './vertex';
import type { REnvironmentInformation } from '../environments/environment';
import { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { DfEdge, EdgeType } from './edge';
import { BuiltInProcName } from '../environments/built-in-proc-name';
import { DefaultMap } from '../../util/collections/defaultmap';
import { GraphHelper } from './graph-helper';
import { RFunctionDefinition } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-definition';
import { RBinaryOp } from '../../r-bridge/lang-4.x/ast/model/nodes/r-binary-op';
import { RNode } from '../../r-bridge/lang-4.x/ast/model/model';
import { Identifier } from '../environments/identifier';
import { RArgument } from '../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import { Dataflow } from './df-helper';

/**
 * A call graph is a dataflow graph where all vertices are function calls.
 * You can create a call graph from a dataflow graph using {@link CallGraph.compute}.
 * If you want to extract a sub call graph, use {@link CallGraph.computeSubCallGraph}.
 * @see {@link dropTransitiveEdges} - to reduce the call graph by dropping transitive edges
 */
export type CallGraph = DataflowGraph<
	Required<DataflowGraphVertexFunctionCall | DataflowGraphVertexFunctionDefinition>
>;

export interface State {
	visited:    Set<NodeId>;
	// links to be added if not otherwise found
	potentials: [NodeId, Set<NodeId>][]
}

function processCds(vtx: DataflowGraphVertexInfo, graph: DataflowGraph, result: CallGraph, state: State): void {
	for(const tar of vtx.cds ?? []) {
		const targetVtx = graph.getVertex(tar.id);
		if(targetVtx) {
			processUnknown(targetVtx, undefined, graph, result, state);
		}
	}
}

const UntargetedCallFollow = EdgeType.Reads | EdgeType.DefinedByOnCall | EdgeType.DefinedBy | EdgeType.Returns;
const UntargetedCallAvoid = EdgeType.NonStandardEvaluation | EdgeType.Argument;

/**
 * The origins of what a call flowR found no target for calls, following its name back through reads and
 * parameter bindings: `f(x)` within `apply_f <- function(f, x) f(x)` ends at what callers hand in as `f`.
 */
export function fallbackUntargetedCall(vtx: Pick<DataflowGraphVertexFunctionCall, 'id'>, graph: DataflowGraph): Set<NodeId> {
	/* we track all aliases to their roots here, we know there is no known call target */
	const collected: Set<NodeId> = new Set();
	const visited: Set<NodeId> = new Set();
	const toVisit: NodeId[] = [vtx.id];
	while(toVisit.length > 0) {
		const currentId = toVisit.pop() as NodeId;
		if(visited.has(currentId)) {
			continue;
		}
		visited.add(currentId);
		const currentVtx = graph.getVertex(currentId);
		if(!currentVtx) {
			continue;
		}
		let addedNew = false;
		/* past the call asked about, a call hands back what it returns; a plain read of another call is state it depends on, not its name */
		const follow = currentId !== vtx.id && DfgVertex.isFunctionCall(currentVtx) ? EdgeType.Returns : UntargetedCallFollow;
		for(const [tar, e] of graph.edgesFrom(currentId)) {
			if(DfEdge.includesType(e, follow) && DfEdge.doesNotIncludeType(e, UntargetedCallAvoid)
				&& (DfEdge.includesType(e, EdgeType.Returns) || !DfgVertex.isFunctionCall(graph.getVertex(tar)))) {
				addedNew = true;
				toVisit.push(tar);
			}
		}
		/* we have reached our end(s) */
		if(!addedNew && currentId !== vtx.id) {
			collected.add(currentId);
		}
	}
	return collected;
}

function processCall(vtx: Required<DataflowGraphVertexFunctionCall>, from: NodeId | undefined, graph: DataflowGraph, result: CallGraph, state: State): void {
	const vid = vtx.id;
	if(from) {
		result.addEdge(from, vid, EdgeType.Calls);
	}
	if(state.visited.has(vid)) {
		return;
	}
	state.visited.add(vid);
	result.addVertex(vtx, undefined as unknown as REnvironmentInformation, true);
	processCds(vtx, graph, result, state);

	let addedTarget = false;
	let addedBiTarget = false;
	for(const tar of Dataflow.callTargetsOf(vid, graph, vtx.environment)) {
		const targetVtx = graph.getVertex(tar);
		if(NodeId.isBuiltIn(tar)) {
			result.addEdge(vid, tar, EdgeType.Calls);
			addedTarget = true;
			addedBiTarget = true;
		} else if(DfgVertex.isFunctionDefinition(targetVtx)) {
			addedTarget = true;
			processFunctionDefinition(targetVtx, vid, graph, result, state);
		}
	}
	if(!addedBiTarget && vtx.origin !== 'unnamed') {
		for(const origs of vtx.origin) {
			if(origs.startsWith('builtin:')) {
				addedTarget = true;
				result.addEdge(vid, NodeId.toBuiltIn(origs.slice('builtin:'.length)), EdgeType.Calls);
			}
		}
	}
	if(!addedTarget) {
		for(const ori of fallbackUntargetedCall(vtx, graph)) {
			const oriVtx = graph.getVertex(ori);
			if(!oriVtx) {
				continue;
			}
			result.addEdge(vid, ori, EdgeType.Calls);
			const name = graph.idMap?.get(ori);
			if(name?.lexeme && DfgVertex.isUse(oriVtx)) {
				result.addVertex({
					...oriVtx,
					tag:         VertexType.FunctionCall,
					name:        name.lexeme,
					onlyBuiltin: false,
					origin:      [BuiltInProcName.Function],
					args:        []
				}, oriVtx.environment);
			}
		}
	}

	/* handle arguments, traversing the 'reads' and the 'returns' edges */
	for(const [tar, e] of graph.edgesFrom(vid)) {
		if(DfEdge.doesNotIncludeType(e, EdgeType.Reads | EdgeType.Returns | EdgeType.Argument)) {
			continue;
		}
		const tVtx = graph.getVertex(tar);
		if(tVtx) {
			processUnknown(tVtx, vid, graph, result, state);
		}
	}
}

function processUnknown(vtx: DataflowGraphVertexInfo, from: NodeId | undefined, graph: DataflowGraph, result: CallGraph, state: State): void {
	if(DfgVertex.isFunctionCall(vtx)) {
		processCall(vtx, from, graph, result, state);
	} else if(DfgVertex.isFunctionDefinition(vtx) && from) {
		result.addEdge(from, NodeId.toBuiltIn('function'), EdgeType.Calls);
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
	state.potentials.push([vtx.id, vtx.subflow.graph.difference(exits)]);

	for(const { nodeId } of exits) {
		const v = graph.getVertex(nodeId);
		if(v) {
			processUnknown(v, vtx.id, graph, result, state);
		}
	}
}

/**
 * The caller to record for a function definition found in the body of `from`. A definition the body writes is
 * not called by writing it, so it gets none; a definition flowR synthesizes for a deferred expression
 * (`on.exit` and its relatives) is one the body really runs, so it keeps `from`.
 */
function callerOfBodyDefinition(from: NodeId | undefined, to: NodeId): NodeId | undefined {
	return NodeId.isWritten(to) ? undefined : from;
}

/** Follows the `Calls` edges from `seeds`, collecting everything they reach in `reached`. */
function followCalls(graph: CallGraph, seeds: Iterable<NodeId>, reached: Set<NodeId>): void {
	const toVisit = Array.from(seeds);
	while(toVisit.length > 0) {
		const current = toVisit.pop() as NodeId;
		if(reached.has(current)) {
			continue;
		}
		reached.add(current);
		toVisit.push(...Dataflow.targetsOf(graph, current, EdgeType.Calls));
	}
}

/** Whether `name` is a `<generic>.<class>` of a generic that is called, as `print.foo` is when `print` is. */
function mayBeDispatchedTo(name: string, generics: ReadonlySet<string>): boolean {
	for(let dot = name.indexOf('.'); dot > 0; dot = name.indexOf('.', dot + 1)) {
		if(generics.has(name.slice(0, dot))) {
			return true;
		}
	}
	return false;
}

/** The names the reached calls go by, which are the generics a method of the program may be dispatched to for. */
function reachedCallNames(graph: CallGraph, reached: ReadonlySet<NodeId>): Set<string> {
	const names = new Set<string>();
	for(const id of reached) {
		const vertex = graph.getVertex(id);
		if(DfgVertex.isFunctionCall(vertex)) {
			names.add(Identifier.getName(vertex.name));
		}
	}
	return names;
}

/**
 * The unreached function definitions that may still run: one the code hands to another call (a callback, an
 * S4 method, a shiny handler), and one bound to a `<generic>.<class>` name of a generic the program calls.
 */
function mayRunAnyway(graph: CallGraph, reached: ReadonlySet<NodeId>): NodeId[] {
	const idMap = graph.idMap;
	if(idMap === undefined) {
		return [];
	}
	const seeds: NodeId[] = [];
	let generics: Set<string> | undefined;
	for(const [id] of graph.verticesOfType(VertexType.FunctionDefinition)) {
		if(reached.has(id)) {
			continue;
		}
		const node = idMap.get(id);
		if(node === undefined) {
			continue;
		}
		const parent = RNode.directParent(node, idMap);
		if(RArgument.is(parent)) {
			seeds.push(id);
			continue;
		}
		const bound = RBinaryOp.is(parent) ? RNode.lexeme(parent.lhs) : undefined;
		generics ??= reachedCallNames(graph, reached);
		if(bound !== undefined && mayBeDispatchedTo(bound, generics)) {
			seeds.push(id);
		}
	}
	return seeds;
}

/**
 * Helper object for call-graphs, you can compute new call graphs based on {@link CallGraph.compute}.
 * @helper dataflow
 * @see {@link Dataflow}
 * @see {@link CallGraph}
 */
export const CallGraph = {
	...GraphHelper,
	name: 'CallGraph',
	/** Extracts the sub call graph from the given call graph, starting from the given entry points. */
	computeSubCallGraph(this: void, graph: CallGraph, entryPoints: Set<NodeId>): CallGraph {
		const result: CallGraph = new DataflowGraph(graph.idMap);
		const reached = new Set<NodeId>();
		followCalls(graph, entryPoints, reached);
		for(const id of reached) {
			const vtx = graph.getVertex(id);
			if(!vtx) {
				continue;
			}
			result.addVertex(vtx, undefined as unknown as REnvironmentInformation, true);
			for(const tar of Dataflow.targetsOf(graph, id, EdgeType.Calls)) {
				result.addEdge(id, tar, EdgeType.Calls);
			}
		}

		return result;
	},

	/**
	 * Whether the function definition with the given id (transitively) calls itself; `false` for ids that are no function definition.
	 * @param id    - The id of the function definition
	 * @param graph - The call graph to follow
	 */
	isRecursive(this: void, id: NodeId, graph: CallGraph): boolean {
		if(!DfgVertex.isFunctionDefinition(graph.getVertex(id))) {
			return false;
		}
		const seen = new Set<NodeId>();
		const toVisit: NodeId[] = [id];
		let gotStart = 0;
		while(toVisit.length > 0) {
			const currentId = toVisit.pop() as NodeId;
			if(currentId === id && gotStart++ > 0) {
				return true;
			}
			if(seen.has(currentId)) {
				continue;
			}
			seen.add(currentId);
			for(const nextId of graph.edgesFrom(currentId).keys()) {
				toVisit.push(nextId);
			}
		}
		return false;
	},

	/** The calls the program makes on its own: those outside of any function definition. */
	entryPoints(this: void, graph: CallGraph): Set<NodeId> {
		const entries = new Set<NodeId>();
		const idMap = graph.idMap;
		if(idMap === undefined) {
			return entries;
		}
		for(const [id] of graph.verticesOfType(VertexType.FunctionCall)) {
			const node = idMap.get(id);
			if(node !== undefined && RFunctionDefinition.wrappingFunctionDefinition(node, idMap) === undefined) {
				entries.add(id);
			}
		}
		return entries;
	},

	/**
	 * The calls no execution starting at the top level reaches: those in a function nothing (transitively) calls.
	 * What {@link mayRunAnyway} may still run is left out, so a call reported here really does not run.
	 */
	unreachableCalls(this: void, graph: CallGraph): NodeId[] {
		const reached = new Set<NodeId>();
		followCalls(graph, CallGraph.entryPoints(graph), reached);
		for(let seeds = mayRunAnyway(graph, reached); seeds.length > 0; seeds = mayRunAnyway(graph, reached)) {
			followCalls(graph, seeds, reached);
		}
		return graph.vertices(true)
			.filter(([id, vertex]) => DfgVertex.isFunctionCall(vertex) && !reached.has(id))
			.map(([id]) => id)
			.toArray();
	},

	/** Reduces the call graph by dropping all transitive edges. */
	dropTransitiveEdges(this: void, graph: CallGraph): CallGraph {
		const newCg: CallGraph = new DataflowGraph(graph.idMap);
		newCg.mergeVertices(graph);
		const knownReachability: DefaultMap<NodeId, Set<NodeId>> = new DefaultMap(() => new Set());
		// heuristically sort by dif in ids
		const es = Array.from(
			graph.edges(),
			([e, ts]) => ts.entries().map(([t, { types }]) => [e, t, types] as [NodeId, NodeId, EdgeType]).toArray()
		).flat()
			.sort((a, b) => String(a[0]).localeCompare(String(a[1])) - String(b[0]).localeCompare(String(b[1])));

		for(const [from, to, types] of es) {
			if(!CallGraph.reaches(from, to, newCg, knownReachability)) {
				newCg.addEdge(from, to, types);
			}
		}
		return newCg;
	},

	/**
	 * Computes the call graph from the given dataflow graph.
	 * @see {@link CallGraph} - for details
	 * @see {@link CallGraph.computeSubCallGraph} - to extract sub call graphs
	 * @see {@link CallGraph.dropTransitiveEdges} - to reduce the call graph by dropping transitive edges
	 */
	compute(this: void, graph: DataflowGraph): CallGraph {
		const result: CallGraph = new DataflowGraph(graph.idMap);
		const state: State = {
			visited:    new Set(),
			potentials: []
		};
		for(const [,vert] of graph.vertices(false)) {
			if(DfgVertex.isFunctionCall(vert)) {
				processCall(vert, undefined, graph, result, state);
			} else if(DfgVertex.isFunctionDefinition(vert)) {
				processFunctionDefinition(vert, undefined, graph, result, state);
			}
		}
		for(const [from, tos] of state.potentials) {
			for(const to of tos) {
				if(!result.hasVertex(to)) {
					const v = graph.getVertex(to);
					if(v) {
						processUnknown(v, from, graph, result, state);
						if(DfgVertex.isFunctionDefinition(v)) {
							processFunctionDefinition(v, callerOfBodyDefinition(from, to), graph, result, state);
						}
					}
				} else if(callerOfBodyDefinition(from, to) !== undefined || !DfgVertex.isFunctionDefinition(graph.getVertex(to))) {
					result.addEdge(from, to, EdgeType.Calls);
				}
			}
		}
		return result;
	}
} as const;