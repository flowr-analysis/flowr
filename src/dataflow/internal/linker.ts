import { DefaultMap } from '../../util/collections/defaultmap';
import { RNode } from '../../r-bridge/lang-4.x/ast/model/model';
import { RFunctionCall } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { isNotUndefined } from '../../util/assert';
import { expensiveTrace } from '../../util/log';
import type { BuiltIn } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { NodeId, recoverName } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import {
	type InGraphIdentifierDefinition,
	Identifier,
	type IdentifierReference,
	isReferenceType,
	ReferenceType
} from '../environments/identifier';
import type { FunctionArgument, DataflowGraph } from '../graph/graph';
import { NoEdges } from '../graph/graph';
import type { RParameter } from '../../r-bridge/lang-4.x/ast/model/nodes/r-parameter';
import type { AstIdMap, ParentInformation } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { dataflowLogger } from '../logger';
import { DfEdge, EdgeType } from '../graph/edge';
import {
	type DataflowGraphVertexFunctionCall,
	type DataflowGraphVertexFunctionDefinition,
	type DataflowGraphVertexInfo,
	VertexType
} from '../graph/vertex';
import type { REnvironmentInformation } from '../environments/environment';
import { MatchArgs } from '../graph/match-args';
import type { ExitPoint } from '../info';
import { negateControlDependency, doesExitPointPropagateCalls } from '../info';
import { UnnamedFunctionCallPrefix } from './process/functions/call/unnamed-call-handling';
import { BuiltInProcName } from '../environments/built-in-proc-name';
import { VariableDefinitionVertex, FunctionCallVertex, FunctionDefinitionVertex } from '../graph/vertex';
import { Resolve } from '../environments/resolve-helper';
import { RFunctionDefinition } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-definition';
import { RSymbol } from '../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';

export type NameIdMap = DefaultMap<Identifier, IdentifierReference[]>;

/**
 * Find all reads within the graph that do not reference a local definition in the graph.
 */
export function findNonLocalReads(graph: DataflowGraph, ignores: ReadonlySet<NodeId> = new Set()): IdentifierReference[] {
	const defs = new Set(graph.vertexIdsOfType(VertexType.VariableDefinition).concat(
		graph.vertexIdsOfType(VertexType.FunctionDefinition)
	));
	/* find all variable use ids which do not link to a given id */
	const nonLocalReads: IdentifierReference[] = [];
	for(const ids of [graph.vertexIdsOfType(VertexType.Use), graph.vertexIdsOfType(VertexType.FunctionCall)]) {
		for(const nodeId of ids) {
			if(ignores.has(nodeId)) {
				continue;
			}
			const outgoing = graph.outgoingEdges(nodeId);
			const origin = graph.getVertex(nodeId);
			const name = recoverName(nodeId, graph.idMap);

			const type = FunctionCallVertex.is(origin) ? ReferenceType.Function : ReferenceType.Variable;

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
 * {@link MatchArgs.onCall|Matches} the arguments to the parameters and links them in the graph,
 * returning the resolved map from argument ids to parameter ids.
 * @useInstead {@link MatchArgs.onCallAndLink}
 */
export function linkArgumentsOnCall(args: readonly FunctionArgument[], params: readonly RParameter<ParentInformation>[], graph: DataflowGraph): Map<NodeId, NodeId> {
	return MatchArgs.onCallAndLink(args, params, graph);
}

/**
 * {@link MatchArgs.toSpec|Matches} the arguments against a parameter specification, returning the
 * arguments bound to each target.
 * @useInstead {@link MatchArgs.toSpec}
 */
export function pMatch<Targets extends NodeId>(args: readonly FunctionArgument[], params: Record<string, Targets>): Map<Targets, NodeId[]> {
	return MatchArgs.toSpec(args, params);
}


/**
 * Links the function call arguments to the target function definition and returns a map from argument ids to parameter ids.
 */
function linkFunctionCallArguments(targetId: NodeId, idMap: AstIdMap, functionCallName: string | undefined, functionRootId: NodeId, callArgs: FunctionArgument[], finalGraph: DataflowGraph): Map<NodeId, NodeId> | undefined {
	// we get them by just choosing the rhs of the definition
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
							// add s7 to vertex
							const vInfo = graph.getVertex(v);
							if(vInfo && FunctionDefinitionVertex.is(vInfo)) {
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
			// add the exit point to the call!
			propagateExitPoints.push(exitPoint);
		}
	}

	const defName = recoverName(fnId, idMap);
	expensiveTrace(dataflowLogger, () => `recording expr-list-level call from ${recoverName(info.id, idMap)} to ${defName}`);
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
		/* no outgoing edges */
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
 * Returns the called functions within the current graph, which can be used to merge the environments with the call.
 * Furthermore, it links the corresponding arguments.
 * @param graph     - The graph to use for search and resolution traversals (ideally a superset of the `thisGraph`)
 * @param idMap     - The map to resolve ids to names
 * @param thisGraph - The graph to search for function calls in
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

	if(!FunctionCallVertex.is(info)) {
		return [];
	}

	if(environment !== undefined || info.environment !== undefined) {
		let functionCallDefs: NodeId[] = [];
		const refType = info.origin.includes(BuiltInProcName.S3Dispatch) ? ReferenceType.S3MethodPrefix :
			info.origin.includes(BuiltInProcName.S7Dispatch) ? ReferenceType.S7MethodPrefix : ReferenceType.Function;
		if(info.name !== undefined && !Identifier.getName(info.name).startsWith(UnnamedFunctionCallPrefix)) {
			functionCallDefs = Resolve.byNameAndType(
				info.name, environment ?? info.environment as REnvironmentInformation, refType
			)?.map(d => d.nodeId) ?? [];
		}
		for(const [target, outgoingEdge] of outgoingEdges.entries()) {
			if(DfEdge.includesType(outgoingEdge, EdgeType.Calls)) {
				functionCallDefs.push(target);
			}
		}

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
 * Finds all linked function definitions starting from the given set of read ids.
 * This is a complicated function, please only call it if you know what you are doing.
 * For example, if you are interested in the called functions of a function call, use {@link getAllFunctionCallTargets} instead.
 * This function here expects you to handle the accessed objects yourself (e.g,. already resolve the first layer of reads/returns/calls/... or resolve the identifier by name)
 * and then pass in the relevant read ids.
 * @example
 * Consider a scenario like this:
 * ```R
 * x <- function() 3
 * x()
 * ```
 * To resolve the call `x` in the second line, use {@link getAllFunctionCallTargets}!
 * To know what fdefs the definition of `x` in the first line links to, you can use {@link getAllLinkedFunctionDefinitions|this function}.
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

		// Found a function definition
		if(vertex.subflow !== undefined) {
			result.add(vertex as Required<DataflowGraphVertexFunctionDefinition>);
			continue;
		}

		const outgoing = dataflowGraph.outgoingEdges(cid);
		if(!outgoing) {
			continue;
		}

		const isSkipType = FunctionCallVertex.is(vertex) || (VariableDefinitionVertex.is(vertex) && vertex.par);
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
 * @useInstead {@link Quoted.evaluateIn}
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
 * This method links a set of read variables to definitions in an environment.
 * @param referencesToLinkAgainstEnvironment - The set of references to link against the environment
 * @param environmentInformation             - The environment information to link against
 * @param givenInputs                        - The existing list of inputs that might be extended
 * @param graph                              - The graph to enter the found links
 * @param maybeForRemaining                  - Each input that can not be linked, will be added to `givenInputs`. If this flag is `true`, it will be marked as `maybe`.
 * @returns the given inputs, possibly extended with the remaining inputs (those of `referencesToLinkAgainstEnvironment` that could not be linked against the environment)
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
				// we can stick with maybe even if readId.attribute is always
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
	// data.graph.get(node.id).definedAtPosition = false
	return givenInputs;
}

/**
 * all loops variables which are open read (not already bound by a redefinition within the loop) get a maybe read marker to their last definition within the loop
 * e.g. with:
 * ```R
 * for(i in 1:10) {
 *  x_1 <- x_2 + 1
 * }
 * ```
 * `x_2` must get a read marker to `x_1` as `x_1` is the active redefinition in the second loop iteration.
 *
 * When `environment` is supplied the function uses it to discover ALL definitions that are still live at the
 * loop exit, so sequential overwrites contribute a single candidate while if-else branches contribute one
 * candidate per branch.
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
	// just apply the cds of all exit points not already present
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
