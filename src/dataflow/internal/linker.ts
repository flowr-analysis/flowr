import { DefaultMap } from '../../util/collections/defaultmap';
import { isNotUndefined } from '../../util/assert';
import { expensiveTrace, log } from '../../util/log';
import { type NodeId, recoverName } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import {
	type InGraphIdentifierDefinition,
	Identifier,
	type IdentifierReference,
	isReferenceType,
	ReferenceType
} from '../environments/identifier';
import { type DataflowGraph, type FunctionArgument, isNamedArgument } from '../graph/graph';
import type { RParameter } from '../../r-bridge/lang-4.x/ast/model/nodes/r-parameter';
import type { AstIdMap, ParentInformation } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { dataflowLogger } from '../logger';
import { EmptyArgument } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { DfEdge, EdgeType } from '../graph/edge';
import { RType } from '../../r-bridge/lang-4.x/ast/model/type';
import {
	type DataflowGraphVertexFunctionCall,
	type DataflowGraphVertexFunctionDefinition,
	type DataflowGraphVertexInfo,
	VertexType
} from '../graph/vertex';
import { resolveByName } from '../environments/resolve-by-name';
import { type BuiltIn, BuiltInProcName, isBuiltIn } from '../environments/built-in';
import type { REnvironmentInformation } from '../environments/environment';
import { findByPrefixIfUnique } from '../../util/prefix';
import type { ExitPoint } from '../info';
import { doesExitPointPropagateCalls } from '../info';
import { UnnamedFunctionCallPrefix } from './process/functions/call/unnamed-call-handling';

export type NameIdMap = DefaultMap<Identifier, IdentifierReference[]>;

/**
 * Find all reads within the graph that do not reference a local definition in the graph.
 */
export function findNonLocalReads(graph: DataflowGraph, ignore: readonly IdentifierReference[]): IdentifierReference[] {
	const ignores = new Set(ignore.map(i => i.nodeId));
	const ids = new Set(
		graph.vertexIdsOfType(VertexType.Use).concat(
			graph.vertexIdsOfType(VertexType.FunctionCall)
		)
	);
	/* find all variable use ids which do not link to a given id */
	const nonLocalReads: IdentifierReference[] = [];
	for(const nodeId of ids) {
		if(ignores.has(nodeId)) {
			continue;
		}
		const outgoing = graph.outgoingEdges(nodeId);
		const name = recoverName(nodeId, graph.idMap);
		const origin = graph.getVertex(nodeId);

		const type = origin?.tag === VertexType.FunctionCall ? ReferenceType.Function : ReferenceType.Variable;

		if(outgoing === undefined) {
			nonLocalReads.push({ name, nodeId, type });
			continue;
		}
		for(const [target, e] of outgoing) {
			if(DfEdge.includesType(e, EdgeType.Reads) && !ids.has(target)) {
				nonLocalReads.push({ name,  nodeId,  type });
				break;
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
		if(reference.name) {
			nameIdShares.get(reference.name).push(reference);
		}
	}
	return nameIdShares;
}

/**
 * Links the given arguments to the given parameters within the given graph.
 * This follows the `pmatch` semantics of R
 * @see https://cran.r-project.org/doc/manuals/R-lang.html#Argument-matching
 * This returns the resolved map from argument ids to parameter ids.
 * If you just want to match by name, use {@link pMatch}.
 */
export function linkArgumentsOnCall(args: readonly FunctionArgument[], params: readonly RParameter<ParentInformation>[], graph: DataflowGraph): Map<NodeId, NodeId> {
	const nameArgMap = new Map<string, IdentifierReference>(args.filter(isNamedArgument).map(a => [a.name, a] as const));
	const nameParamMap = new Map<string, RParameter<ParentInformation>>(
		params.filter(p => p?.name?.content !== undefined)
			.map(p => [p.name.content, p]));
	const maps = new Map<NodeId, NodeId>();

	const specialDotParameter = params.find(p => p.special);
	const sid = specialDotParameter?.name.info.id;

	// all parameters matched by name
	const matchedParameters = new Set<string>();
	const paramNames = nameParamMap.keys().toArray();
	// first map names
	for(const [name, { nodeId: argId }] of nameArgMap) {
		const pmatchName = findByPrefixIfUnique(name, paramNames) ?? name;
		const param = nameParamMap.get(pmatchName);
		if(param?.name) {
			const pid = param.name.info.id;
			graph.addEdge(argId, pid, EdgeType.DefinesOnCall);
			graph.addEdge(pid, argId, EdgeType.DefinedByOnCall);
			maps.set(argId, pid);
			matchedParameters.add(name);
		} else if(sid) {
			graph.addEdge(argId, sid, EdgeType.DefinesOnCall);
			graph.addEdge(sid, argId, EdgeType.DefinedByOnCall);
			maps.set(argId, sid);
		}
	}

	const remainingParameter = params.filter(p => !p?.name || !matchedParameters.has(p.name.content));
	const remainingArguments = args.filter(a => !isNamedArgument(a));

	for(let i = 0; i < remainingArguments.length; i++) {
		const arg = remainingArguments[i];
		if(arg === EmptyArgument) {
			continue;
		}
		const aid = arg.nodeId;
		if(remainingParameter.length <= i) {
			if(sid) {
				graph.addEdge(aid, sid, EdgeType.DefinesOnCall);
				graph.addEdge(sid, aid, EdgeType.DefinedByOnCall);
				maps.set(aid, sid);
			} else {
				dataflowLogger.warn(`skipping argument ${i} as there is no corresponding parameter - R should block that`);
			}
			continue;
		}
		const param = remainingParameter[i];
		dataflowLogger.trace(`mapping unnamed argument ${i} (id: ${aid}) to parameter "${param.name?.content ?? '??'}"`);
		if(param.name) {
			const pid = param.name.info.id;
			graph.addEdge(aid, pid, EdgeType.DefinesOnCall);
			graph.addEdge(pid, aid, EdgeType.DefinedByOnCall);
			maps.set(aid, pid);
		}
	}
	return maps;
}

/**
 * Returns all argument ids that map to the given target parameter id.
 */
export function getAllIdsWithTarget<Targets extends NodeId>(maps: Map<NodeId, Targets>, target: Targets): NodeId[] {
	return maps.entries().filter(([, v]) => v === target).map(([k]) => k).toArray();
}

/**
 * Inverts the argument to parameter map to a parameter to argument map.
 */
export function invertArgumentMap<Targets extends NodeId>(maps: Map<NodeId, Targets>): Map<Targets, NodeId[]> {
	const inverted = new Map<Targets, NodeId[]>();
	for(const [arg, param] of maps.entries()) {
		const existing = inverted.get(param);
		if(existing) {
			existing.push(arg);
		} else {
			inverted.set(param, [arg]);
		}
	}
	return inverted;
}

/**
 * Links the given arguments to the given parameters within the given graph by name only.
 * @note
 * To obtain the arguments from a {@link RFunctionCall}[], either use {@link processAllArguments} (also available via {@link processKnownFunctionCall})
 * or convert them with {@link convertFnArguments}.
 * You can use {@link getAllIdsWithTarget} to get all argument ids that map to a given parameter.
 */
export function pMatch<Targets extends NodeId>(args: readonly FunctionArgument[], params: Record<string, Targets>): Map<NodeId, Targets> {
	const nameArgMap = new Map<string, IdentifierReference>(args.filter(isNamedArgument).map(a => [a.name, a] as const));

	const maps = new Map<NodeId, Targets>();

	const sid = params['...'];
	const paramNames = Object.keys(params);

	// all parameters matched by name
	const matchedParameters = new Set<string>();

	// first map names
	for(const [name, { nodeId: argId }] of nameArgMap) {
		const pmatchName = findByPrefixIfUnique(name, paramNames) ?? name;
		const param = params[pmatchName];
		if(param) {
			maps.set(argId, param);
			matchedParameters.add(name);
		} else if(sid) {
			maps.set(argId, sid);
		}
	}

	const remainingParameter = paramNames.filter(p => !matchedParameters.has(p));
	const remainingArguments = args.filter(a => !isNamedArgument(a));

	for(let i = 0; i < remainingArguments.length; i++) {
		const arg = remainingArguments[i];
		if(arg === EmptyArgument) {
			continue;
		}
		const aid = arg.nodeId;
		if(remainingParameter.length <= i) {
			if(sid) {
				maps.set(aid, sid);
			}
			continue;
		}
		const param = params[remainingParameter[i]];
		if(param) {
			maps.set(aid, param);
		}
	}
	return maps;
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

	if(linkedFunction.type !== RType.FunctionDefinition) {
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
			const defs = ingoing.name ? resolveByName(ingoing.name, info.environment, ingoing.type) : undefined;
			if(defs === undefined) {
				continue;
			}
			for(const { nodeId, type, value } of defs as InGraphIdentifierDefinition[]) {
				if(!isBuiltIn(nodeId)) {
					graph.addEdge(ingoing.nodeId, nodeId, EdgeType.DefinedByOnCall);
					graph.addEdge(id, nodeId, EdgeType.DefinesOnCall);
					if(type === ReferenceType.Function && ingoing.type === ReferenceType.S7MethodPrefix && Array.isArray(value)) {
						for(const v of value) {
							graph.addEdge(id, v, EdgeType.Calls);
							graph.addEdge(ingoing.nodeId, v, EdgeType.Calls);
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
		if(!isBuiltIn(t) && DfEdge.doesNotIncludeType(e, EdgeType.Argument) && DfEdge.includesType(e, FCallLinkReadBits)) {
			functionDefinitionReadIds.add(t);
		}
	}

	const [functionDefs] = getAllLinkedFunctionDefinitions(new Set(functionDefinitionReadIds), graph);

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

	if(info.tag !== VertexType.FunctionCall) {
		return [];
	}

	if(environment !== undefined || info.environment !== undefined) {
		let functionCallDefs: NodeId[] = [];
		const refType = info.origin.includes(BuiltInProcName.S3Dispatch) ? ReferenceType.S3MethodPrefix :
			info.origin.includes(BuiltInProcName.S7Dispatch) ? ReferenceType.S7MethodPrefix : ReferenceType.Function;
		if(info.name !== undefined && !Identifier.getName(info.name).startsWith(UnnamedFunctionCallPrefix)) {
			functionCallDefs = resolveByName(
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

		if(isBuiltIn(cid)) {
			builtIns.add(cid);
			continue;
		}

		const currentInfo = dataflowGraph.get(cid, true);
		if(currentInfo === undefined) {
			continue;
		}

		const [vertex, edges] = currentInfo;

		// Found a function definition
		if(vertex.subflow !== undefined) {
			result.add(vertex as Required<DataflowGraphVertexFunctionDefinition>);
			continue;
		}

		let hasReturnEdge = false;
		for(const [target, e] of edges) {
			if(DfEdge.includesType(e, EdgeType.Returns)) {
				hasReturnEdge = true;
				if(!visited.has(target)) {
					potential.push(target);
				}
			}
		}

		if(vertex.tag === VertexType.FunctionCall || hasReturnEdge || (vertex.tag === VertexType.VariableDefinition && vertex.par)) {
			continue;
		}

		for(const [target, e] of edges) {
			if(DfEdge.includesType(e, LinkedFnFollowBits) && !visited.has(target)) {
				potential.push(target);
			}
		}
	}

	return [result, builtIns];
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
		const probableTarget = bodyInput.name ? resolveByName(bodyInput.name, environmentInformation, bodyInput.type) : undefined;
		if(probableTarget === undefined) {
			log.trace(`found no target for ${bodyInput.name ? Identifier.toString(bodyInput.name) : '<no-name>'}`);
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
 */
export function linkCircularRedefinitionsWithinALoop(graph: DataflowGraph, openIns: NameIdMap, outgoing: readonly IdentifierReference[]): void {
	// first, we preprocess out so that only the last definition of a given identifier survives
	// this implicitly assumes that the outgoing references are ordered
	const lastOutgoing = new Map<Identifier, IdentifierReference>();
	for(const out of outgoing) {
		if(out.name) {
			lastOutgoing.set(out.name, out);
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
export function reapplyLoopExitPoints(exits: readonly ExitPoint[], references: readonly IdentifierReference[]): void {
	// just apply the cds of all exit points not already present
	const exitCds = new Set(exits.flatMap(e => e.cds).filter(isNotUndefined));

	for(const ref of references) {
		for(const cd of exitCds) {
			const { id: cId, when: cWhen } = cd;
			if(ref.cds) {
				if(!ref.cds?.find(c => c.id === cId && c.when === cWhen)) {
					ref.cds.push({ ...cd, byIteration: true });
				}
			} else {
				ref.cds = [{ ...cd, byIteration: true }];
			}
		}
	}
}
