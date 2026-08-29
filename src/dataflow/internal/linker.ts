import { DefaultMap } from '../../util/collections/defaultmap';
import { Fn } from '../fn/fn';
import { RNode } from '../../r-bridge/lang-4.x/ast/model/model';
import { RFunctionCall } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { isNotUndefined } from '../../util/assert';
import { expensiveTrace } from '../../util/log';
import type { BuiltIn } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { type InGraphIdentifierDefinition, Identifier, type IdentifierReference, isReferenceType, ReferenceType } from '../environments/identifier';
import type { FunctionArgument, DataflowGraph } from '../graph/graph';
import { NoEdges } from '../graph/graph';
import type { RParameter } from '../../r-bridge/lang-4.x/ast/model/nodes/r-parameter';
import type { AstIdMap, ParentInformation } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { dataflowLogger } from '../logger';
import { DfEdge, EdgeType } from '../graph/edge';
import { type DataflowGraphVertexFunctionCall, type DataflowGraphVertexFunctionDefinition, type DataflowGraphVertexInfo, VertexType } from '../graph/vertex';
import type { REnvironmentInformation } from '../environments/environment';
import type { ExitPoint } from '../info';
import { negateControlDependency, doesExitPointPropagateCalls } from '../info';
import { UnnamedFunctionCallPrefix } from './process/functions/call/unnamed-call-handling';
import { BuiltInProcName } from '../environments/built-in-proc-name';
import { DfgVertex } from '../graph/vertex';
import { Resolve } from '../environments/resolve-helper';
import { RFunctionDefinition } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-definition';
import { RSymbol } from '../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';

export type NameIdMap = DefaultMap<Identifier, IdentifierReference[]>;

/**
 * Find all reads within the graph that do not reference a local definition in the graph.
 */
export function findNonLocalReads(graph: DataflowGraph, ignores: ReadonlySet<NodeId> = new Set()): IdentifierReference[] {
	const defs = new Set<NodeId>();
	for(const tag of [VertexType.VariableDefinition, VertexType.FunctionDefinition]) {
		for(const [id] of graph.verticesOfType(tag)) {
			defs.add(id);
		}
	}
	/* find all variable use ids which do not link to a given id */
	const nonLocalReads: IdentifierReference[] = [];
	/* the tag already says what the reference is, so no vertex has to be fetched to decide */
	for(const [tag, type] of [[VertexType.Use, ReferenceType.Variable], [VertexType.FunctionCall, ReferenceType.Function]] as const) {
		for(const [nodeId] of graph.verticesOfType(tag)) {
			if(ignores.has(nodeId)) {
				continue;
			}
			const outgoing = graph.outgoingEdges(nodeId);
			const name = NodeId.recoverName(nodeId, graph.idMap);
			const identifierRef = { nodeId, name, type };

			/* control flow edges say nothing about what a name resolves to, so they do not count as a link */
			let linked = false;
			let nonLocal = false;
			for(const [target, e] of outgoing ?? NoEdges) {
				if(DfEdge.isOnlyControlFlow(e)) {
					continue;
				}
				linked = true;
				if(DfEdge.includesType(e, EdgeType.Reads) && !defs.has(target)) {
					nonLocal = true;
					break;
				}
			}
			if(!linked || nonLocal) {
				nonLocalReads.push(identifierRef);
			}
		}
	}
	return nonLocalReads;
}

/**
 * Produces a map from names to all identifier references sharing that name.
 */
export function produceNameSharedIdMap(references: IdentifierReference[]): NameIdMap {
	const nameIdShares = new DefaultMap<Identifier, IdentifierReference[]>(() => []);
	for(const reference of references) {
		const rn = reference.name;
		if(rn) {
			nameIdShares.get(rn).push(reference);
		}
	}
	return nameIdShares;
}

/**
 * {@link Fn.call.match.onCall|Matches} the arguments to the parameters and links them in the graph,
 * returning the resolved map from argument ids to parameter ids.
 * @useInstead {@link Fn.call.match.onCallAndLink}
 */
export function linkArgumentsOnCall(args: readonly FunctionArgument[], params: readonly RParameter<ParentInformation>[], graph: DataflowGraph): Map<NodeId, NodeId> {
	return Fn.call.match.onCallAndLink(args, params, graph);
}

/**
 * {@link Fn.call.match.toSpec|Matches} the arguments against a parameter specification, returning the
 * arguments bound to each target.
 * @useInstead {@link Fn.call.match.toSpec}
 */
export function pMatch<Targets extends NodeId>(args: readonly FunctionArgument[], params: Record<string, Targets>): Map<Targets, NodeId[]> {
	return Fn.call.match.toSpec(args, params);
}

/**
 * Links the function call arguments to the target function definition and returns a map from argument ids to parameter ids.
 */
function linkFunctionCallArguments(targetId: NodeId, idMap: AstIdMap, functionCallName: string | undefined, functionRootId: NodeId, callArgs: FunctionArgument[], finalGraph: DataflowGraph): Map<NodeId, NodeId> | undefined {
	const linkedFunction = idMap.get(targetId);
	if(linkedFunction === undefined) {
		dataflowLogger.trace(`no fdef found for ${functionCallName} (${functionRootId})`);
		return;
	}

	if(!RFunctionDefinition.is(linkedFunction)) {
		dataflowLogger.trace(`function call definition base ${functionCallName} does not lead to a function definition (${functionRootId}) but got ${linkedFunction.type}`);
		return;
	}
	return linkArgumentsOnCall(callArgs, linkedFunction.parameters, finalGraph);
}

/**
 * Links a function call with a single target function definition.
 */
export function linkFunctionCallWithSingleTarget(
	graph: DataflowGraph,
	{ subflow: fnSubflow, exitPoints, id: fnId, params }: DataflowGraphVertexFunctionDefinition,
	info: DataflowGraphVertexFunctionCall,
	idMap: AstIdMap
): ExitPoint[] {
	const id = info.id;
	if(info.environment !== undefined) {
		// for each open ingoing reference, try to resolve it here, and if so, add a read edge from the call to signal that it reads it
		for(const ingoing of fnSubflow.in) {
			const defs = ingoing.name ? Resolve.byNameAndType(ingoing.name, info.environment, ingoing.type) : undefined;
			if(defs === undefined) {
				continue;
			}
			for(const { nodeId, type, value } of defs as InGraphIdentifierDefinition[]) {
				if(!NodeId.isBuiltIn(nodeId)) {
					graph.addEdge(ingoing.nodeId, nodeId, EdgeType.DefinedByOnCall);
					graph.addEdge(id, nodeId, EdgeType.DefinesOnCall);
					if(type === ReferenceType.Function && ingoing.type === ReferenceType.S7MethodPrefix && Array.isArray(value)) {
						for(const v of value) {
							graph.addEdge(id, v, EdgeType.Calls);
							graph.addEdge(ingoing.nodeId, v, EdgeType.Calls);
							const vInfo = graph.getVertex(v);
							if(vInfo && DfgVertex.isFunctionDefinition(vInfo)) {
								vInfo.mode ??= [];
								if(!vInfo.mode.includes('s7')) {
									vInfo.mode.push('s7');
								}
							}
						}
					}
				}
			}
		}
	}

	const propagateExitPoints: ExitPoint[] = [];
	for(const exitPoint of exitPoints) {
		graph.addEdge(id, exitPoint.nodeId, EdgeType.Returns);
		if(doesExitPointPropagateCalls(exitPoint.type)) {
			propagateExitPoints.push(exitPoint);
		}
	}

	const defName = NodeId.recoverName(fnId, idMap);
	expensiveTrace(dataflowLogger, () => `recording expr-list-level call from ${NodeId.recoverName(info.id, idMap)} to ${defName}`);
	graph.addEdge(id, fnId, EdgeType.Calls);
	applyForForcedArgs(graph, info.id, params, linkFunctionCallArguments(fnId, idMap, defName, id, info.args, graph));
	return propagateExitPoints;
}

/** for each parameter that we link that gets forced, add a reads edge from the call to argument to show that it reads it */
function applyForForcedArgs(graph: DataflowGraph, callId: NodeId, readParams: Record<NodeId, boolean>, maps: Map<NodeId, NodeId> | undefined): void {
	if(maps === undefined) {
		return;
	}
	for(const [arg, param] of maps.entries()) {
		if(readParams[String(param)]) {
			graph.addEdge(callId, arg, EdgeType.Reads);
		}
	}
}

const FCallLinkReadBits = EdgeType.Reads | EdgeType.Calls | EdgeType.DefinedByOnCall;
/* there is _a lot_ potential for optimization here */
function linkFunctionCall(
	graph: DataflowGraph,
	id: NodeId,
	info: DataflowGraphVertexFunctionCall,
	idMap: AstIdMap,
	thisGraph: DataflowGraph,
	calledFunctionDefinitions: {
		functionCall:        NodeId;
		called:              readonly DataflowGraphVertexInfo[],
		propagateExitPoints: readonly ExitPoint[]
	}[]
) {
	const edges = graph.outgoingEdges(id);
	if(edges === undefined) {
		return;
	}

	const functionDefinitionReadIds = new Set<NodeId>();
	for(const [t, e] of edges.entries()) {
		if(!NodeId.isBuiltIn(t) && DfEdge.doesNotIncludeType(e, EdgeType.Argument) && DfEdge.includesType(e, FCallLinkReadBits)) {
			functionDefinitionReadIds.add(t);
		}
	}

	const [functionDefs] = getAllLinkedFunctionDefinitions(functionDefinitionReadIds, graph);

	const propagateExitPoints: ExitPoint[] = [];
	for(const def of functionDefs.values()) {
		// we can skip this if we already linked it
		const oEdge = graph.outgoingEdges(id)?.get(def.id);
		if(oEdge && DfEdge.includesType(oEdge, EdgeType.Calls)) {
			continue;
		}
		for(const ep of linkFunctionCallWithSingleTarget(graph, def, info, idMap)) {
			propagateExitPoints.push(ep);
		}
	}
	if(thisGraph.isRoot(id) && functionDefs.size > 0) {
		calledFunctionDefinitions.push({ functionCall: id, called: functionDefs.values().toArray(), propagateExitPoints });
	}
}

/**
 * Returns the called functions within `graph` (ideally a superset of `thisGraph`, the graph searched for calls), which
 * can be used to merge the environments with the call; also links the corresponding arguments.
 */
export function linkFunctionCalls(
	graph: DataflowGraph,
	idMap: AstIdMap,
	thisGraph: DataflowGraph
): { functionCall: NodeId, called: readonly DataflowGraphVertexInfo[], propagateExitPoints: readonly ExitPoint[] }[] {
	const calledFunctionDefinitions: { functionCall: NodeId, called: DataflowGraphVertexInfo[], propagateExitPoints: readonly ExitPoint[] }[] = [];
	for(const [id, info] of thisGraph.verticesOfType(VertexType.FunctionCall)) {
		if(!info.onlyBuiltin) {
			linkFunctionCall(graph, id, info, idMap, thisGraph, calledFunctionDefinitions);
		}
	}
	return calledFunctionDefinitions;
}

/**
 * convenience function returning all known call targets, as well as the name source which defines them
 */
export function getAllFunctionCallTargets(call: NodeId, graph: DataflowGraph, environment?: REnvironmentInformation): NodeId[] {
	const found: Set<NodeId> = new Set();
	const callVertex = graph.get(call, true);
	if(callVertex === undefined) {
		return [];
	}

	const [info, outgoingEdges] = callVertex;

	if(!DfgVertex.isFunctionCall(info)) {
		return [];
	}

	const known = environment ?? info.environment;
	let functionCallDefs: NodeId[] = [];
	if(known !== undefined) {
		const refType = info.origin.includes(BuiltInProcName.S3Dispatch) ? ReferenceType.S3MethodPrefix :
			info.origin.includes(BuiltInProcName.S7Dispatch) ? ReferenceType.S7MethodPrefix : ReferenceType.Function;
		if(info.name !== undefined && !Identifier.getName(info.name).startsWith(UnnamedFunctionCallPrefix)) {
			functionCallDefs = Resolve.byNameAndType(info.name, known, refType)?.map(d => d.nodeId) ?? [];
		}
	}
	/* a call that kept no environment still knows the user definitions it was linked to, and those are targets */
	for(const [target, outgoingEdge] of outgoingEdges.entries()) {
		if(DfEdge.includesType(outgoingEdge, EdgeType.Calls) && (known !== undefined || !NodeId.isBuiltIn(target))) {
			functionCallDefs.push(target);
		}
	}

	if(functionCallDefs.length > 0) {
		const [functionCallTargets, builtInTargets] = getAllLinkedFunctionDefinitions(new Set(functionCallDefs), graph);
		for(const target of functionCallTargets) {
			found.add(target.id);
		}
		for(const arr of [builtInTargets, functionCallDefs]) {
			for(const target of arr) {
				found.add(target);
			}
		}
	}

	return Array.from(found);
}

const LinkedFnFollowBits = EdgeType.Reads | EdgeType.DefinedBy | EdgeType.DefinedByOnCall;

/**
 * Finds all linked function definitions starting from the given read ids; expects the caller to already have resolved
 * the accessed objects (first layer of reads/returns/calls/...). For call targets, use {@link getAllFunctionCallTargets} instead.
 */
export function getAllLinkedFunctionDefinitions(
	functionDefinitionReadIds: ReadonlySet<NodeId>,
	dataflowGraph: DataflowGraph
): [Set<Required<DataflowGraphVertexFunctionDefinition>>, Set<BuiltIn>] {
	const result = new Set<Required<DataflowGraphVertexFunctionDefinition>>();
	const builtIns = new Set<BuiltIn>();

	if(functionDefinitionReadIds.size === 0) {
		return [result, builtIns];
	}

	const potential: NodeId[] = Array.from(functionDefinitionReadIds);
	const visited = new Set<NodeId>();

	while(potential.length !== 0) {
		const cid = potential.pop() as NodeId;
		visited.add(cid);

		if(NodeId.isBuiltIn(cid)) {
			builtIns.add(cid);
			continue;
		}

		const vertex = dataflowGraph.getVertex(cid);
		if(vertex === undefined) {
			continue;
		}

		if(vertex.subflow !== undefined) {
			result.add(vertex as Required<DataflowGraphVertexFunctionDefinition>);
			continue;
		}

		const outgoing = dataflowGraph.outgoingEdges(cid);
		if(!outgoing) {
			continue;
		}

		const isSkipType = DfgVertex.isFunctionCall(vertex) || (DfgVertex.isVariableDefinition(vertex) && vertex.par);
		let hasReturnEdge = false;
		let followTargets: NodeId[] | undefined;

		for(const [target, e] of outgoing) {
			if(DfEdge.includesType(e, EdgeType.Returns)) {
				hasReturnEdge = true;
				if(!visited.has(target)) {
					potential.push(target);
				}
			} else if(!isSkipType && !hasReturnEdge && DfEdge.includesType(e, LinkedFnFollowBits) && !visited.has(target)) {
				(followTargets ??= []).push(target);
			}
		}

		if(!hasReturnEdge && followTargets) {
			for(const target of followTargets) {
				potential.push(target);
			}
		}
	}

	return [result, builtIns];
}

/**
 * Links every name in the expression rooted at `expr` against `environment`, as if it were written there, and
 * hands back what stays unresolved. This is how an expression that was captured elsewhere is read here.
 * @useInstead {@link Fn.call.quoted.evaluateIn}
 */
export function linkExpressionIn<Info>(this: void, graph: DataflowGraph, expr: NodeId, environment: REnvironmentInformation, idMap: AstIdMap<Info & ParentInformation>): readonly IdentifierReference[] {
	const node = idMap.get(expr);
	if(node === undefined) {
		return [];
	}
	const references: IdentifierReference[] = [];
	const callees = new Set<NodeId>();
	RNode.visitAst<Info & ParentInformation>(node, inner => {
		if(RFunctionCall.isNamed(inner)) {
			callees.add(inner.functionName.info.id);
			references.push({ nodeId: inner.functionName.info.id, name: inner.functionName.content, cds: undefined, type: ReferenceType.Function });
		} else if(RSymbol.is(inner) && !callees.has(inner.info.id)) {
			references.push({ nodeId: inner.info.id, name: inner.content, cds: undefined, type: ReferenceType.Variable });
		}
		return false;
	});
	const unresolved: IdentifierReference[] = [];
	linkInputs(references, environment, unresolved, graph, false);
	return unresolved;
}

/**
 * Links a set of read variables to definitions in `environmentInformation`; each reference that cannot be linked is
 * added to `givenInputs` (marked maybe if `maybeForRemaining`), and the extended list is returned.
 */
export function linkInputs(referencesToLinkAgainstEnvironment: readonly IdentifierReference[], environmentInformation: REnvironmentInformation, givenInputs: IdentifierReference[], graph: DataflowGraph, maybeForRemaining: boolean): IdentifierReference[] {
	for(const bodyInput of referencesToLinkAgainstEnvironment) {
		const probableTarget = bodyInput.name ? Resolve.byNameAndType(bodyInput.name, environmentInformation, bodyInput.type) : undefined;
		if(probableTarget === undefined) {
			if(maybeForRemaining) {
				bodyInput.cds ??= [];
			}
			givenInputs.push(bodyInput);
		} else {
			let allBuiltIn = true;
			for(const target of probableTarget) {
				graph.addEdge(bodyInput.nodeId, target.nodeId, EdgeType.Reads);
				if(!isReferenceType(target.type, ReferenceType.BuiltInConstant | ReferenceType.BuiltInFunction)) {
					allBuiltIn = false;
				}
			}
			if(allBuiltIn) {
				givenInputs.push(bodyInput);
			}
		}
	}
	return givenInputs;
}

/**
 * A loop variable read before its within-loop redefinition gets a maybe marker to that def (e.g. `x_2` may read the
 * prior iteration's `x_1` in `for(...) { x_1 <- x_2 + 1 }`); with `environment`, this uses all defs live at loop exit.
 */
export function linkCircularRedefinitionsWithinALoop(graph: DataflowGraph, openIns: NameIdMap, outgoing: readonly IdentifierReference[], environment?: REnvironmentInformation): void {
	if(environment !== undefined) {
		const outgoingIds = new Set(outgoing.map(o => o.nodeId));
		for(const [name, targets] of openIns.entries()) {
			const liveDefs = environment.current.memory.get(Identifier.getName(name));
			if(liveDefs === undefined) {
				continue;
			}
			for(const def of liveDefs) {
				if(outgoingIds.has(def.nodeId)) {
					for(const target of targets) {
						graph.addEdge(target.nodeId, def.nodeId, EdgeType.Reads);
					}
				}
			}
		}
		return;
	}

	// fallback: keep only the last definition per identifier (used when no environment is available)
	const lastOutgoing = new Map<Identifier, IdentifierReference>();
	for(const out of outgoing) {
		const on = out.name;
		if(on) {
			lastOutgoing.set(on, out);
		}
	}

	for(const [name, targets] of openIns.entries()) {
		for(const { name: outName, nodeId } of lastOutgoing.values()) {
			if(outName !== undefined && Identifier.matches(outName, name)) {
				for(const target of targets) {
					graph.addEdge(target.nodeId, nodeId, EdgeType.Reads);
				}
			}
		}
	}
}

/**
 * Reapplies the loop exit points' control dependencies to the given identifier references.
 */
export function reapplyLoopExitPoints(exits: readonly ExitPoint[], references: readonly IdentifierReference[], graph: DataflowGraph): void {
	const exitCds = exits.flatMap(e => e.cds?.map(negateControlDependency))
		.filter(isNotUndefined)
		.map(cd => ({ ...cd, byIteration: true }));
	const seenRefs = new Set<NodeId>();
	for(const ref of references) {
		if(seenRefs.has(ref.nodeId)) {
			continue;
		}
		seenRefs.add(ref.nodeId);
		for(const cd of exitCds) {
			const { id: cId } = cd;
			let setVertex = false;
			if(ref.cds) {
				if(!ref.cds?.find(c => c.id === cId)) {
					ref.cds.push(cd);
					setVertex = true;
				}
			} else {
				ref.cds = [cd];
				setVertex = true;
			}
			if(setVertex) {
				const vertex = graph.getVertex(ref.nodeId);
				if(vertex) {
					if(vertex.cds) {
						if(!vertex.cds?.find(c => c.id === cId)) {
							vertex.cds.push(cd);
						}
					} else {
						vertex.cds = [cd];
					}
				}
			}
		}
	}
}

/** The open references a function definition still carries into its closure. */
export const ClosureRefs = {
	name: 'ClosureRefs',
	/**
	 * Resolves the open ingoing references of a definition called anonymously at `callId` against `environment`,
	 * links what resolves, and leaves only the references that stay open.
	 */
	resolveOpenIngoing(this: void, graph: DataflowGraph, callId: NodeId, definition: DataflowGraphVertexFunctionDefinition, environment: REnvironmentInformation): void {
		const remainingIn: IdentifierReference[] = [];
		for(const ingoing of definition.subflow.in) {
			const resolved = ingoing.name ? Resolve.byNameAndType(ingoing.name, environment, ingoing.type) : undefined;
			if(resolved === undefined) {
				remainingIn.push(ingoing);
				continue;
			}
			expensiveTrace(dataflowLogger, () => `Found ${resolved.length} references to open ref ${ingoing.nodeId} in closure of function definition ${callId}`);
			let allBuiltIn = true;
			const inId = ingoing.nodeId;
			for(const { nodeId, type } of resolved) {
				graph.addEdge(inId, nodeId, EdgeType.Reads);
				graph.addEdge(callId, nodeId, EdgeType.Reads); // because the def. is the anonymous call
				if(!isReferenceType(type, ReferenceType.BuiltInConstant | ReferenceType.BuiltInFunction)) {
					allBuiltIn = false;
				}
			}
			if(allBuiltIn) {
				remainingIn.push(ingoing);
			}
		}
		definition.subflow.in = remainingIn;
	}
} as const;
