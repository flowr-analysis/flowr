import type { NodeToSlice } from './slicer-types';
import type { VisitingQueue } from './visiting-queue';
import { guard } from '../../util/assert';
import { envFingerprint, type Fingerprint } from './fingerprint';
import { getAllLinkedFunctionDefinitions } from '../../dataflow/internal/linker';
import {
	type DataflowGraphVertexFunctionCall,
	type DataflowGraphVertexFunctionDefinition,
	type DataflowGraphVertexInfo,
	VertexType
} from '../../dataflow/graph/vertex';
import type { REnvironmentInformation } from '../../dataflow/environments/environment';
import {
	type DataflowGraph,
	FunctionArgument,
	type OutgoingEdges
} from '../../dataflow/graph/graph';
import { resolveByName } from '../../dataflow/environments/resolve-by-name';
import { DfEdge, EdgeType } from '../../dataflow/graph/edge';
import { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { ReferenceType } from '../../dataflow/environments/identifier';
import {
	retrieveActiveEnvironment
} from '../../dataflow/internal/process/functions/call/built-in/built-in-function-definition';
import { updatePotentialAddition } from './static-slicer';
import type { DataflowInformation } from '../../dataflow/info';
import type { ReadOnlyFlowrAnalyzerContext } from '../../project/context/flowr-analyzer-context';
import type { AstIdMap } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { RType } from '../../r-bridge/lang-4.x/ast/model/type';
import { RNode } from '../../r-bridge/lang-4.x/ast/model/model';

/**
 * Returns the function call targets (definitions) by the given caller
 */
export function getAllFunctionCallTargetsForSlice(dataflowGraph: DataflowGraph, callerInfo: DataflowGraphVertexFunctionCall, baseEnvironment: REnvironmentInformation, queue: VisitingQueue, ctx: ReadOnlyFlowrAnalyzerContext): [Set<DataflowGraphVertexInfo>, REnvironmentInformation] {
	// bind with call-local environments during slicing
	const outgoingEdges = dataflowGraph.get(callerInfo.id, true);
	guard(outgoingEdges !== undefined, () => `outgoing edges of id: ${callerInfo.id} must be in graph but can not be found, keep in slice to be sure`);

	// lift baseEnv on the same level

	const activeEnvironment = retrieveActiveEnvironment(callerInfo.environment, baseEnvironment, ctx);

	const name = callerInfo.name;
	guard(name !== undefined, () => `name of id: ${callerInfo.id} can not be found in id map`);
	const functionCallDefs = resolveByName(name, activeEnvironment, ReferenceType.Unknown)?.filter(d => !NodeId.isBuiltIn(d.definedAt))?.map(d => d.nodeId) ?? [];

	for(const [target, outgoingEdge] of outgoingEdges[1].entries()) {
		if(DfEdge.includesType(outgoingEdge, EdgeType.Calls)) {
			functionCallDefs.push(target);
		}
	}

	const functionCallTargets = queue.memoizeCallTargets(functionCallDefs.join(';'), () =>  getAllLinkedFunctionDefinitions(new Set(functionCallDefs), dataflowGraph)[0]);
	return [functionCallTargets, activeEnvironment];
}

function includeArgumentFunctionCallClosure(arg: FunctionArgument, activeEnvironment: REnvironmentInformation, queue: VisitingQueue, dataflowGraph: DataflowGraph): void {
	const valueRoot = FunctionArgument.getReference(arg);
	if(!valueRoot) {
		return;
	}
	const callTargets = queue.memoizeCallTargets(valueRoot, () => getAllLinkedFunctionDefinitions(new Set<NodeId>([valueRoot]), dataflowGraph)[0]);
	linkCallTargets(
		false,
		callTargets,
		activeEnvironment,
		envFingerprint(activeEnvironment),
		queue
	);
}

function linkCallTargets(
	onlyForSideEffects: boolean,
	functionCallTargets: ReadonlySet<DataflowGraphVertexInfo>,
	activeEnvironment: REnvironmentInformation,
	activeEnvironmentFingerprint: Fingerprint,
	queue: VisitingQueue
): void {
	for(const functionCallTarget of functionCallTargets) {
		for(const exitPoint of (functionCallTarget as DataflowGraphVertexFunctionDefinition).exitPoints) {
			queue.add(exitPoint.nodeId, activeEnvironment, activeEnvironmentFingerprint, onlyForSideEffects);
		}
		// handle open reads
		for(const openIn of (functionCallTarget as DataflowGraphVertexFunctionDefinition).subflow.in) {
			// resolve them in the active env
			if(openIn.name) {
				const resolved = resolveByName(openIn.name, activeEnvironment, ReferenceType.Unknown);
				for(const res of resolved ?? []) {
					updatePotentialAddition(queue, functionCallTarget.id, res.nodeId, activeEnvironment, activeEnvironmentFingerprint);
				}
			}
		}
	}
}

/** returns the new threshold hit count */
export function sliceForCall(current: NodeToSlice, callerInfo: DataflowGraphVertexFunctionCall, { graph }: DataflowInformation, queue: VisitingQueue, ctx: ReadOnlyFlowrAnalyzerContext): void {
	const [functionCallTargets, activeEnvironment] = getAllFunctionCallTargetsForSlice(graph, callerInfo, current.baseEnvironment, queue, ctx);

	if(functionCallTargets.size === 0) {
		/*
		 * if we do not have any call to resolve this function, we have to assume that every function passed is actually called!
		 * hence, we add a new flag and add all argument values to the queue causing directly
		 */
		for(const arg of callerInfo.args) {
			includeArgumentFunctionCallClosure(arg, activeEnvironment, queue, graph);
		}
		return;
	}
	const activeEnvironmentFingerprint = envFingerprint(activeEnvironment);
	linkCallTargets(current.onlyForSideEffects, functionCallTargets, activeEnvironment, activeEnvironmentFingerprint, queue);
}

/**
 * Finds the nearest enclosing function-definition node for the given id by walking up the AST parent chain.
 * Used by `includeCallees` to detect the function-definition boundary a node sits inside, as backward slicing
 * does not otherwise visit the function-definition vertex itself (nothing within the body links to it).
 */
export function findEnclosingFunctionDefinition(id: NodeId, idMap: AstIdMap): NodeId | undefined {
	let node = idMap.get(id);
	while(node !== undefined) {
		if(node.type === RType.FunctionDefinition) {
			return node.info.id;
		}
		node = node.info.parent !== undefined ? idMap.get(node.info.parent) : undefined;
	}
	return undefined;
}

/**
 * For `includeCallees`: decides whether the current slice of a function definition's body actually depends on
 * the function's interface, i.e., whether the callers can influence the sliced result at all. This is the case iff
 * the slice reaches one of the definition's parameters, or it reads a free reference captured from the enclosing
 * scope. If the sliced body is self-contained (only locally-defined variables, no parameter and no captured
 * variable), the callers are irrelevant and the boundary must not be crossed.
 */
export function sliceReachesFunctionInterface(fnDefId: NodeId, graph: DataflowGraph, queue: VisitingQueue, idMap: AstIdMap, ctx: ReadOnlyFlowrAnalyzerContext): boolean {
	const vertex = graph.getVertex(fnDefId);
	if(vertex === undefined || vertex.tag !== VertexType.FunctionDefinition) {
		return false;
	}
	// (a) the slice reaches a parameter of this definition
	for(const paramId of Object.keys(vertex.params)) {
		if(queue.hasId(NodeId.normalize(paramId))) {
			return true;
		}
	}
	// (b) a sliced body node captures a variable from the enclosing scope: it links (via `defined-by-on-call`, the
	// closure/argument binding resolved at the call site) to a non-builtin definition that lives outside this body.
	const fnNode = idMap.get(fnDefId);
	const bodyIds = fnNode ? new Set(RNode.collectAllIds(fnNode)) : new Set<NodeId>();
	for(const bodyId of bodyIds) {
		if(!queue.hasId(bodyId)) {
			continue;
		}
		const outgoing = graph.outgoingEdges(bodyId);
		if(outgoing === undefined) {
			continue;
		}
		for(const [target, edge] of outgoing) {
			if(DfEdge.includesType(edge, EdgeType.DefinedByOnCall) && !NodeId.isBuiltIn(target) && !bodyIds.has(target)) {
				return true;
			}
		}
	}
	// (c) fallback for captures that could not be resolved at definition time: an open in-reference that is in the
	// slice and resolves to a non-builtin definition in the enclosing scope.
	const definitionEnvironment = vertex.environment ?? ctx.env.makeCleanEnv();
	for(const open of vertex.subflow.in) {
		if(open.name === undefined || !queue.hasId(open.nodeId)) {
			continue;
		}
		const resolved = resolveByName(open.name, definitionEnvironment, open.type ?? ReferenceType.Unknown);
		if(resolved?.some(d => !NodeId.isBuiltIn(d.nodeId))) {
			return true;
		}
	}
	return false;
}

const CalleeBoundaryEdges = EdgeType.DefinedBy | EdgeType.Calls;

/**
 * For `includeCallees`: given the id of a function-definition vertex, enqueues the vertex that binds/defines
 * the function (e.g. `f <- function...`, via the `defined-by` edge) as well as all of its call sites (via
 * `calls` edges). Call site arguments are picked up automatically once the call vertex is processed normally,
 * as `argument` edges are always traversed.
 * This is the reverse of what {@link sliceForCall} does for call -\> definition linking.
 */
export function includeCalleesOfDefinition(fnDefId: NodeId, graph: DataflowGraph, queue: VisitingQueue, baseEnvironment: REnvironmentInformation, baseEnvFingerprint: Fingerprint): void {
	const ingoing = graph.ingoingEdges(fnDefId);
	if(ingoing === undefined) {
		return;
	}
	for(const [source, edge] of ingoing) {
		if(DfEdge.includesType(edge, CalleeBoundaryEdges)) {
			queue.add(source, baseEnvironment, baseEnvFingerprint, false);
		}
	}
}

const PotentialFollowOnReturn = EdgeType.DefinesOnCall | EdgeType.DefinedByOnCall | EdgeType.Argument;
/** Returns true if we found at least one return edge */
export function handleReturns(from: NodeId, queue: VisitingQueue, currentEdges: OutgoingEdges, baseEnvFingerprint: Fingerprint, baseEnvironment: REnvironmentInformation): boolean {
	const e = Array.from(currentEdges.entries());
	const found = e.filter(([_, edge]) => DfEdge.includesType(edge, EdgeType.Returns));
	if(found.length === 0) {
		return false;
	}
	for(const [target] of found) {
		queue.add(target, baseEnvironment, baseEnvFingerprint, false);
	}
	for(const [target, edge] of e) {
		if(DfEdge.includesType(edge, EdgeType.Reads)) {
			queue.add(target, baseEnvironment, baseEnvFingerprint, false);
		} else if(DfEdge.includesType(edge, PotentialFollowOnReturn)) {
			updatePotentialAddition(queue, from, target, baseEnvironment, baseEnvFingerprint);
		}
	}
	return true;
}
