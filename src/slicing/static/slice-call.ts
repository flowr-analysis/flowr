import type { NodeToSlice } from './slicer-types';
import type { VisitingQueue } from './visiting-queue';
import { guard } from '../../util/assert';
import { envFingerprint, type Fingerprint } from './fingerprint';
import { getAllLinkedFunctionDefinitions } from '../../dataflow/internal/linker';
import type { DataflowGraphVertexFunctionCall, DataflowGraphVertexFunctionDefinition, DataflowGraphVertexInfo } from '../../dataflow/graph/vertex';
import type { REnvironmentInformation } from '../../dataflow/environments/environment';
import { type DataflowGraph, FunctionArgument, type OutgoingEdges } from '../../dataflow/graph/graph';
import { Resolve } from '../../dataflow/environments/resolve-helper';
import { DfEdge, EdgeType } from '../../dataflow/graph/edge';
import { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { ReferenceType } from '../../dataflow/environments/identifier';
import { retrieveActiveEnvironment } from '../../dataflow/internal/process/functions/call/built-in/built-in-function-definition';
import { updatePotentialAddition } from './static-slicer';
import type { DataflowInformation } from '../../dataflow/info';
import type { ReadOnlyFlowrAnalyzerContext } from '../../project/context/flowr-analyzer-context';
import type { AstIdMap } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { RNode } from '../../r-bridge/lang-4.x/ast/model/model';
import { DfgVertex } from '../../dataflow/graph/vertex';
import { BuiltInProcName } from '../../dataflow/environments/built-in-proc-name';
import { Dataflow } from '../../dataflow/graph/df-helper';

const NoCallTargets: ReadonlySet<DataflowGraphVertexInfo> = new Set();

const linkedByGraph = new WeakMap<DataflowGraph, Map<string, ReadonlySet<DataflowGraphVertexInfo>>>();

function linkedFunctionsOf(defs: readonly NodeId[], graph: DataflowGraph): ReadonlySet<DataflowGraphVertexInfo> {
	let known = linkedByGraph.get(graph);
	if(known === undefined) {
		linkedByGraph.set(graph, known = new Map<string, ReadonlySet<DataflowGraphVertexInfo>>());
	}
	const key = defs.join(';');
	let linked = known.get(key);
	if(linked === undefined) {
		known.set(key, linked = getAllLinkedFunctionDefinitions(new Set(defs), graph)[0]);
	}
	return linked;
}

/**
 * Returns the function call targets (definitions) by the given caller
 */
export function getAllFunctionCallTargetsForSlice(dataflowGraph: DataflowGraph, callerInfo: DataflowGraphVertexFunctionCall, baseEnvironment: REnvironmentInformation, ctx: ReadOnlyFlowrAnalyzerContext): [ReadonlySet<DataflowGraphVertexInfo>, REnvironmentInformation] {
	guard(dataflowGraph.hasVertex(callerInfo.id), () => `outgoing edges of id: ${callerInfo.id} must be in graph but can not be found, keep in slice to be sure`);
	// bind with call-local environments during slicing
	const activeEnvironment = callerInfo.environment === undefined ? baseEnvironment : retrieveActiveEnvironment(callerInfo.environment, baseEnvironment, ctx);
	const resolved = (Resolve.byName(callerInfo.name, activeEnvironment) ?? []).filter(d => !NodeId.isBuiltIn(d.definedAt));
	const functionCallDefs = [...resolved.map(d => d.nodeId), ...Dataflow.targetsOf(dataflowGraph, callerInfo.id, EdgeType.Calls)];
	const functionCallTargets = functionCallDefs.length === 0 ? NoCallTargets : linkedFunctionsOf(functionCallDefs, dataflowGraph);
	return [functionCallTargets, activeEnvironment];
}

function linkCallTargets(
	onlyForSideEffects: boolean,
	functionCallTargets: ReadonlySet<DataflowGraphVertexInfo>,
	activeEnvironment: REnvironmentInformation,
	activeEnvironmentFingerprint: () => Fingerprint,
	queue: VisitingQueue
): void {
	for(const functionCallTarget of functionCallTargets as ReadonlySet<DataflowGraphVertexFunctionDefinition>) {
		/* a call kept only for what it does needs what its function reads, not what it returns */
		for(const exitPoint of onlyForSideEffects ? [] : functionCallTarget.exitPoints) {
			queue.add(exitPoint.nodeId, activeEnvironment, activeEnvironmentFingerprint(), false);
		}
		for(const openIn of functionCallTarget.subflow.in) {
			for(const res of openIn.name ? Resolve.byName(openIn.name, activeEnvironment) ?? [] : []) {
				updatePotentialAddition(queue, functionCallTarget.id, res.nodeId, activeEnvironment, activeEnvironmentFingerprint());
			}
		}
	}
}

/** Links the call `callerInfo` to the definitions it resolves to, or to the closures of its arguments if it resolves to none. */
export function sliceForCall(current: NodeToSlice, callerInfo: DataflowGraphVertexFunctionCall, { graph }: DataflowInformation, queue: VisitingQueue, ctx: ReadOnlyFlowrAnalyzerContext): void {
	const [functionCallTargets, activeEnvironment] = getAllFunctionCallTargetsForSlice(graph, callerInfo, current.baseEnvironment, ctx);
	/* hashing the environment is expensive, so only a call that links something pays for it */
	let fingerprint: Fingerprint | undefined;
	const activeEnvironmentFingerprint = () => fingerprint ??= activeEnvironment === current.baseEnvironment ? current.envFingerprint : envFingerprint(activeEnvironment);
	if(functionCallTargets.size > 0) {
		linkCallTargets(current.onlyForSideEffects, functionCallTargets, activeEnvironment, activeEnvironmentFingerprint, queue);
		return;
	}
	/*
	 * if we do not have any call to resolve this function, we have to assume that every function passed is actually called!
	 * hence, we add all argument values to the queue causing directly
	 * (an assignment only stores the function, and a call handing an argument back unchanged, like `return(f)`,
	 * did not call it either: what it is bound to is called later, or never)
	 */
	if(DfgVertex.hasOrigin(callerInfo, BuiltInProcName.Assignment)) {
		return;
	}
	for(const arg of callerInfo.args) {
		const reference = FunctionArgument.getReference(arg);
		if(reference && !Dataflow.hasEdge(graph, callerInfo.id, reference, EdgeType.Returns)) {
			linkCallTargets(false, linkedFunctionsOf([reference], graph), activeEnvironment, activeEnvironmentFingerprint, queue);
		}
	}
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
	if(!DfgVertex.isFunctionDefinition(vertex)) {
		return false;
	}
	// (a) the slice reaches a parameter of this definition
	if(Object.keys(vertex.params).some(paramId => queue.hasId(NodeId.normalize(paramId)))) {
		return true;
	}
	// (b) a sliced body node captures a variable from the enclosing scope: it links (via `defined-by-on-call`, the
	// closure/argument binding resolved at the call site) to a non-builtin definition that lives outside this body.
	const bodyIds = RNode.collectAllIds(idMap.get(fnDefId));
	for(const bodyId of bodyIds) {
		if(!queue.hasId(bodyId)) {
			continue;
		}
		const captures = Dataflow.targetsOf(graph, bodyId, EdgeType.DefinedByOnCall);
		if(captures.some(target => !NodeId.isBuiltIn(target) && !bodyIds.has(target))) {
			return true;
		}
	}
	// (c) fallback for captures that could not be resolved at definition time: an open in-reference that is in the
	// slice and resolves to a non-builtin definition in the enclosing scope.
	const definitionEnvironment = vertex.environment ?? ctx.env.makeCleanEnv();
	for(const open of vertex.subflow.in) {
		if(open.name === undefined || !queue.hasId(open.nodeId)) {
			continue;
		}
		const resolved = Resolve.byNameAndType(open.name, definitionEnvironment, open.type ?? ReferenceType.Unknown);
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
 * @returns the enqueued ids
 */
export function includeCalleesOfDefinition(fnDefId: NodeId, graph: DataflowGraph, queue: VisitingQueue, baseEnvironment: REnvironmentInformation, baseEnvFingerprint: Fingerprint): NodeId[] {
	const added = Dataflow.sourcesOf(graph, fnDefId, CalleeBoundaryEdges);
	for(const source of added) {
		queue.add(source, baseEnvironment, baseEnvFingerprint, false);
	}
	return added;
}

const PotentialFollowOnReturn = EdgeType.DefinesOnCall | EdgeType.DefinedByOnCall | EdgeType.Argument;
/** Returns true if we found at least one return edge */
export function handleReturns(from: NodeId, queue: VisitingQueue, currentEdges: OutgoingEdges, baseEnvFingerprint: Fingerprint, baseEnvironment: REnvironmentInformation): boolean {
	if(![...currentEdges.values()].some(edge => DfEdge.includesType(edge, EdgeType.Returns))) {
		return false;
	}
	for(const [target, edge] of currentEdges) {
		if(DfEdge.includesType(edge, EdgeType.Returns)) {
			queue.add(target, baseEnvironment, baseEnvFingerprint, false);
		}
	}
	for(const [target, edge] of currentEdges) {
		if(DfEdge.includesType(edge, EdgeType.Reads)) {
			queue.add(target, baseEnvironment, baseEnvFingerprint, false);
		} else if(DfEdge.includesType(edge, PotentialFollowOnReturn)) {
			updatePotentialAddition(queue, from, target, baseEnvironment, baseEnvFingerprint);
		}
	}
	return true;
}
