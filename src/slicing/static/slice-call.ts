import type { NodeToSlice } from './slicer-types';
import type { VisitingQueue } from './visiting-queue';
import { guard } from '../../util/assert';
import { envFingerprint, type Fingerprint } from './fingerprint';
import { getAllLinkedFunctionDefinitions } from '../../dataflow/internal/linker';
import type { CallRuledOut, DataflowGraphVertexFunctionCall, DataflowGraphVertexFunctionDefinition, DataflowGraphVertexInfo } from '../../dataflow/graph/vertex';
import type { REnvironmentInformation } from '../../dataflow/environments/environment';
import { type DataflowGraph, FunctionArgument, type ReadonlyOutgoingEdges } from '../../dataflow/graph/graph';
import { Resolve } from '../../dataflow/environments/resolve-helper';
import { DfEdge, EdgeType } from '../../dataflow/graph/edge';
import { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { type BrandedIdentifier, ReferenceType } from '../../dataflow/environments/identifier';
import { callBoundInScope, retrieveActiveEnvironment } from '../../dataflow/internal/process/functions/call/built-in/built-in-function-definition';
import { updatePotentialAddition } from './static-slicer';
import type { DataflowInformation } from '../../dataflow/info';
import type { ReadOnlyFlowrAnalyzerContext } from '../../project/context/flowr-analyzer-context';
import type { AstIdMap } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { RNode } from '../../r-bridge/lang-4.x/ast/model/model';
import { DfgVertex } from '../../dataflow/graph/vertex';
import { BuiltInProcName } from '../../dataflow/environments/built-in-proc-name';
import { Dataflow } from '../../dataflow/graph/df-helper';
import { ArgProp, FnSig, SemanticCallTag } from '../../dataflow/environments/built-in-props';
import { callFnProps } from '../../dataflow/environments/query-fn-props';
import { RArgument } from '../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import { RFunctionCall } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { RFunctionDefinition } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-definition';

const NoCallTargets: ReadonlySet<DataflowGraphVertexInfo> = new Set();

const linkedByGraph = new WeakMap<DataflowGraph, Map<BrandedIdentifier, ReadonlySet<DataflowGraphVertexInfo>>>();

function linkedFunctionsOf(defs: readonly NodeId[], graph: DataflowGraph): ReadonlySet<DataflowGraphVertexInfo> {
	let known = linkedByGraph.get(graph);
	if(known === undefined) {
		linkedByGraph.set(graph, known = new Map<BrandedIdentifier, ReadonlySet<DataflowGraphVertexInfo>>());
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
export function getAllFunctionCallTargetsForSlice(dataflowGraph: DataflowGraph, callerInfo: DataflowGraphVertexFunctionCall, baseEnvironment: REnvironmentInformation, ctx: ReadOnlyFlowrAnalyzerContext, ruledOut?: ReadonlySet<NodeId>): [ReadonlySet<DataflowGraphVertexInfo>, REnvironmentInformation] {
	guard(dataflowGraph.hasVertex(callerInfo.id), () => `outgoing edges of id: ${callerInfo.id} must be in graph but can not be found, keep in slice to be sure`);
	// bind with call-local environments during slicing
	const activeEnvironment = callerInfo.environment === undefined ? baseEnvironment : retrieveActiveEnvironment(callerInfo.environment, baseEnvironment, ctx);
	/* the environment knows nothing of the scopes a closure is nested in, the graph does for a name they bind first */
	const resolved = callBoundInScope(callerInfo.id, dataflowGraph) ? [] : (Resolve.byName(callerInfo.name, activeEnvironment) ?? []).filter(d => !NodeId.isBuiltIn(d.definedAt));
	const functionCallDefs = [...resolved.map(d => d.nodeId), ...Dataflow.targetsOf(dataflowGraph, callerInfo.id, EdgeType.Calls)];
	const linked = functionCallDefs.length === 0 ? NoCallTargets : linkedFunctionsOf(functionCallDefs, dataflowGraph);
	/* a lookup by name still finds the methods the dispatch of the call rules out */
	const excludes = callerInfo.ruledOut;
	const functionCallTargets = excludes === undefined && ruledOut === undefined ? linked : new Set(linked.values().filter(t => !excludes?.includes(t.id) && !ruledOut?.has(t.id)));
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

/**
 * Links the call `callerInfo` to the definitions it resolves to, or to the closures of its arguments if it resolves to none.
 * @param ruledOut - the methods the dispatch of the call does not run in this slice, beyond those it never runs
 */
export function sliceForCall(current: NodeToSlice, callerInfo: DataflowGraphVertexFunctionCall, { graph }: DataflowInformation, queue: VisitingQueue, ctx: ReadOnlyFlowrAnalyzerContext, ruledOut?: ReadonlySet<NodeId>): void {
	const [functionCallTargets, activeEnvironment] = getAllFunctionCallTargetsForSlice(graph, callerInfo, current.baseEnvironment, ctx, ruledOut);
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
	 * (an assignment or a replacement like `e$h <- f` only stores the function, and a call handing an argument back
	 * unchanged, like `return(f)`, did not call it either: what it is bound to is called later, or never)
	 */
	if(DfgVertex.hasOrigin(callerInfo, BuiltInProcName.Assignment) || DfgVertex.hasOrigin(callerInfo, BuiltInProcName.Replacement)) {
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
 * The methods a dispatch decided per call of the function `enclosing` holding it does not run in a slice: those it rules
 * out at every call of `enclosing` the slice holds, at such a call with what it rules out at every call the slice holds
 * of the function holding that call in turn. A slice starting in a function, or holding none of its calls, keeps all.
 * @example
 * ```ts
 * // f <- function(x) UseMethod("f"), sliced for f(structure(1, class = "a")) alone
 * ruledOutInSlice(dispatch.ruledOutAt, idOfF, graph, queue, opened); // the method f.b
 * ```
 */
export function ruledOutInSlice(perCall: readonly CallRuledOut[], enclosing: NodeId | undefined, graph: DataflowGraph, queue: VisitingQueue, opened: ReadonlySet<NodeId>): ReadonlySet<NodeId> | undefined {
	if(enclosing === undefined || opened.has(enclosing)) {
		return undefined;
	}
	let common: ReadonlySet<NodeId> | undefined;
	for(const caller of Dataflow.sourcesOf(graph, enclosing, EdgeType.Calls)) {
		if(queue.hasId(caller)) {
			const at = perCall.find(p => p.call === caller);
			const outer = at?.within === undefined || graph.idMap === undefined ? undefined : ruledOutInSlice(at.within, RNode.strictlyEnclosingFunction(caller, graph.idMap), graph, queue, opened);
			const methods = [...at?.methods ?? [], ...outer ?? []];
			const before = common;
			common = new Set(before === undefined ? methods : methods.filter(m => before.has(m)));
			if(common.size === 0) {
				return undefined;
			}
		}
	}
	return common;
}

/**
 * The methods a dispatch decided per call does not run when the calls `via` ran it, the call of the function holding
 * it first, then the call of the function holding that one, and so on.
 * @example
 * ```ts
 * // f <- function(x) UseMethod("f"); g <- function(v) f(v); g(structure(1, class = "a"))
 * ruledOutVia(dispatch.ruledOutAt, [idOfFInG, idOfGCall]); // the method f.b
 * ```
 */
export function ruledOutVia(perCall: readonly CallRuledOut[] | undefined, via: readonly NodeId[]): NodeId[] {
	const ruledOut: NodeId[] = [];
	let level = perCall;
	for(const call of via) {
		const at = level?.find(p => p.call === call);
		if(at === undefined) {
			break;
		}
		ruledOut.push(...at.methods);
		level = at.within;
	}
	return ruledOut;
}

/** Every call `perCall` decides for, at any depth. */
export function callsRuledOutAt(perCall: readonly CallRuledOut[]): NodeId[] {
	return perCall.flatMap(p => [p.call, ...callsRuledOutAt(p.within ?? [])]);
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
export function handleReturns(from: NodeId, queue: VisitingQueue, currentEdges: ReadonlyOutgoingEdges, baseEnvFingerprint: Fingerprint, baseEnvironment: REnvironmentInformation): boolean {
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

/** What a call states of an argument it does not evaluate where and when it stands: quoted, or called as a function. */
const RunsElsewhere = ArgProp.Nse | ArgProp.Callee;

/** A promise the call does not force may run any number of times, or never, as with `replicate(n, expr)`. */
function runsElsewhere(prop: number): boolean {
	return (prop & RunsElsewhere) !== 0 || (prop & (ArgProp.Value | ArgProp.Forced)) === ArgProp.Value;
}

/** What decides whether a call runs code elsewhere: the role of each argument, and whether it evaluates code (`eval`) at all. */
interface DeferringInfo {
	readonly sig?:      FnSig
	readonly evaluates: boolean
}

/**
 * The built-in call that decides when, where or whether the code at `id` runs: the closest call it is an argument
 * of that quotes it or calls it (`on.exit(expr)`, `do.call("f", args)`, `delayedAssign(x, expr)`), up to the
 * function it is defined in. Without that call, the code would run in the order of the caller. A call capturing
 * its argument for another call to evaluate is left to the evaluation of captured code, as that one drops it
 * where the captured code is run in place.
 * @param sigs - the signatures of the calls met on the way, filled as they are asked for
 */
export function deferringCall(id: NodeId, info: DataflowInformation, idMap: AstIdMap, sigs: Map<NodeId, DeferringInfo>): NodeId | undefined {
	for(let child = idMap.get(id), parent = child && RNode.directParent(child, idMap); child !== undefined && parent !== undefined && !RFunctionDefinition.is(parent); child = parent, parent = RNode.directParent(parent, idMap)) {
		if(!RArgument.is(child) || !RFunctionCall.is(parent)) {
			continue;
		}
		const call = parent.info.id;
		let known = sigs.get(call);
		if(known === undefined) {
			const props = callFnProps(call, info);
			known = { sig: props?.sig, evaluates: props?.tags?.includes(SemanticCallTag.Eval) === true };
			sigs.set(call, known);
		}
		/* quoted code the dataflow evaluates in place needs neither the quote nor the evaluating call */
		if(DfgVertex.hasOrigin(info.graph.getVertex(call), BuiltInProcName.Quote)) {
			return undefined;
		}
		if(known.evaluates || (known.sig !== undefined && runsElsewhere(FnSig.propAt(FnSig.layout(known.sig), parent.arguments.indexOf(child))))) {
			return call;
		}
	}
	return undefined;
}
