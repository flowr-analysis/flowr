import { DefaultMap } from '../../util/collections/defaultmap';
import { RFunctionCall } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { FunctionSemantics } from '../fn/function-semantics';
import { RNode } from '../../r-bridge/lang-4.x/ast/model/model';
import { isNotUndefined } from '../../util/assert';
import { expensiveTrace } from '../../util/log';
import type { BuiltIn } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { type InGraphIdentifierDefinition, Identifier, type IdentifierDefinition, type IdentifierReference, isReferenceType, ReferenceType } from '../environments/identifier';
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
import { RAccess } from '../../r-bridge/lang-4.x/ast/model/nodes/r-access';
import { unpackArg } from './process/functions/call/argument/unpack-argument';
import { RNumber } from '../../r-bridge/lang-4.x/ast/model/nodes/r-number';
import { RString } from '../../r-bridge/lang-4.x/ast/model/nodes/r-string';
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
 * {@link FunctionSemantics.call.match.onCall|Matches} the arguments to the parameters and links them in the graph,
 * returning the resolved map from argument ids to parameter ids.
 * @useInstead {@link FunctionSemantics.call.match.onCallAndLink}
 */
export function linkArgumentsOnCall(args: readonly FunctionArgument[], params: readonly RParameter<ParentInformation>[], graph: DataflowGraph): Map<NodeId, NodeId> {
	return FunctionSemantics.call.match.onCallAndLink(args, params, graph);
}

/**
 * {@link FunctionSemantics.call.match.toSpec|Matches} the arguments against a parameter specification, returning the
 * arguments bound to each target.
 * @useInstead {@link FunctionSemantics.call.match.toSpec}
 */
export function pMatch<Targets extends NodeId>(args: readonly FunctionArgument[], params: Record<string, Targets>): Map<Targets, NodeId[]> {
	return FunctionSemantics.call.match.toSpec(args, params);
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

const NoCalleeEnvironments: readonly REnvironmentInformation[] = [];

/** The environments a called function was given of its own, as `environment(f) <- e` gives one. */
function environmentsOfCallee(info: DataflowGraphVertexFunctionCall): readonly REnvironmentInformation[] {
	if(info.name === undefined || info.environment === undefined) {
		return NoCalleeEnvironments;
	}
	const found: REnvironmentInformation[] = [];
	for(const def of Resolve.byName(info.name, info.environment) ?? []) {
		const state = (def as InGraphIdentifierDefinition).envState;
		if(state !== undefined) {
			found.push(state);
		}
	}
	return found;
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
	const environment = info.environment;
	if(environment !== undefined) {
		/* `environment(f) <- e` decides where the body looks its free names up, so that env comes first */
		let callee: readonly REnvironmentInformation[] | undefined = undefined;
		// for each open ingoing reference, try to resolve it here, and if so, add a read edge from the call to signal that it reads it
		for(const ingoing of fnSubflow.in) {
			const name = ingoing.name;
			if(name === undefined) {
				continue;
			}
			/* what the callee itself wrote is not what it read: `f` reading `x` cannot mean the `x <<- ` inside `f`,
			 * however the environment looks once that write has been folded back into the caller */
			callee ??= environmentsOfCallee(info);
			let defs: readonly IdentifierDefinition[] | undefined = undefined;
			for(const env of callee) {
				defs = Resolve.byNameAndType(name, env, ingoing.type);
				if(defs !== undefined) {
					break;
				}
			}
			defs ??= Resolve.byNameAndType(name, environment, ingoing.type);
			if(defs === undefined) {
				continue;
			}
			for(const d of defs as readonly InGraphIdentifierDefinition[]) {
				const { nodeId, type, value, definedAt, envState } = d;
				if(!fnSubflow.graph.has(nodeId) && !NodeId.isBuiltIn(nodeId)) {
					graph.addEdge(ingoing.nodeId, nodeId, EdgeType.DefinedByOnCall);
					graph.addEdge(id, nodeId, EdgeType.DefinesOnCall);
					if(envState !== undefined) {
						bindAccessedField(graph, ingoing.nodeId, envState, idMap);
					}
					/* a binding that is no name of its own -- an environment field binds the value node -- has nothing
					 * leading back to the statement that wrote it, so the call has to read that statement itself */
					if(definedAt !== undefined && definedAt !== nodeId && !NodeId.isBuiltIn(definedAt)
						&& graph.hasVertex(definedAt) && !DfgVertex.isVariableDefinition(graph.getVertex(nodeId))) {
						graph.addEdge(id, definedAt, EdgeType.Reads);
					}
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
	thisGraph: DataflowGraph,
	/** calls `graph` knows of that `thisGraph` does not, as a read that became a call */
	alsoCalls: readonly NodeId[] = []
): { functionCall: NodeId, called: readonly DataflowGraphVertexInfo[], propagateExitPoints: readonly ExitPoint[] }[] {
	const calledFunctionDefinitions: { functionCall: NodeId, called: DataflowGraphVertexInfo[], propagateExitPoints: readonly ExitPoint[] }[] = [];
	for(const [id, info] of thisGraph.verticesOfType(VertexType.FunctionCall)) {
		if(!info.onlyBuiltin) {
			linkFunctionCall(graph, id, info, idMap, thisGraph, calledFunctionDefinitions);
		}
	}
	for(const id of alsoCalls) {
		const info = graph.getVertex(id);
		if(DfgVertex.isFunctionCall(info)) {
			linkFunctionCall(graph, id, info, idMap, graph, calledFunctionDefinitions);
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
	/* a call that kept no environment still knows the user definitions it was linked to, and those are targets;
	 * an unnamed call has nothing to look up, so what its callee expression reads is where its targets come from */
	const followBits = info.origin.includes(BuiltInProcName.Unnamed) ? FCallLinkReadBits : EdgeType.Calls;
	for(const [target, outgoingEdge] of outgoingEdges.entries()) {
		if(DfEdge.includesType(outgoingEdge, followBits) && DfEdge.doesNotIncludeType(outgoingEdge, EdgeType.Argument) && (known !== undefined || !NodeId.isBuiltIn(target))) {
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

	/* `viaAccess` records that the traversal passed through a subsetting call, where the question is no longer
	 * whether the variable *is* a function but what `x$f`/`x[[i]]` holds, so a partial definition still counts */
	const potential: [NodeId, boolean][] = Array.from(functionDefinitionReadIds, id => [id, false]);
	const visited = new Set<NodeId>();
	/* expanding a state again can only push what its first expansion already did */
	const expanded = new Set<NodeId>();
	const expandedViaAccess = new Set<NodeId>();

	while(potential.length !== 0) {
		const [cid, viaAccess] = potential.pop() as [NodeId, boolean];
		const done = viaAccess ? expandedViaAccess : expanded;
		if(done.has(cid)) {
			continue;
		}
		done.add(cid);
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

		const nextViaAccess = viaAccess || DfgVertex.hasOrigin(vertex, BuiltInProcName.Access);
		const isSkipType = DfgVertex.isFunctionCall(vertex) || (DfgVertex.isVariableDefinition(vertex) && vertex.par && !nextViaAccess);
		let hasReturnEdge = false;
		let followTargets: NodeId[] | undefined;

		for(const [target, e] of outgoing) {
			if(DfEdge.includesType(e, EdgeType.Returns)) {
				hasReturnEdge = true;
				if(!visited.has(target)) {
					potential.push([target, nextViaAccess]);
				}
			} else if(!isSkipType && !hasReturnEdge && DfEdge.includesType(e, LinkedFnFollowBits) && !visited.has(target)) {
				(followTargets ??= []).push(target);
			}
		}

		if(!hasReturnEdge && followTargets) {
			for(const target of followTargets) {
				potential.push([target, nextViaAccess]);
			}
		}
	}

	return [result, builtIns];
}

/**
 * Links every name in the expression rooted at `expr` against `environment`, as if it were written there, and
 * hands back what stays unresolved. This is how an expression that was captured elsewhere is read here.
 * @useInstead {@link FunctionSemantics.call.quoted.evaluateIn}
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

/**
 * The open references a function definition still carries into its closure.
 * @helper api
 */
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

/** The field an access names, if it is written out: `x$f`, `x[["f"]]`, or `x[[2]]`, which is how a list records its positional entries. */
export function accessedFieldName(fieldNode: RNode<ParentInformation> | undefined, treatIndicesAsString: boolean | undefined): string | undefined {
	if(RString.is(fieldNode)) {
		return fieldNode.content.str;
	} else if(treatIndicesAsString) {
		return fieldNode?.lexeme;
	}
	return RNumber.is(fieldNode) && !fieldNode.content.complexNumber && Number.isInteger(fieldNode.content.num) && fieldNode.content.num > 0
		? String(fieldNode.content.num) : undefined;
}

/** Links the access at `accessId` to the `fieldDefs` it reaches; a function held in a field is what the access returns. */
export function linkFieldReads(graph: DataflowGraph, accessId: NodeId, fieldDefs: readonly IdentifierDefinition[] | undefined, returnsFunctions: boolean): void {
	for(const fd of fieldDefs ?? []) {
		graph.addEdge(accessId, fd.nodeId, EdgeType.Reads);
		/* the field name alone carries no value, so the call that wrote it is what the access depends on */
		if(fd.definedAt !== undefined && fd.definedAt !== fd.nodeId) {
			graph.addEdge(accessId, fd.definedAt, EdgeType.Reads);
		}
		if(returnsFunctions && fd.type === ReferenceType.Function) {
			graph.addEdge(accessId, fd.nodeId, EdgeType.Returns);
		}
	}
}

/**
 * An access `x$f` written where `x` was still open reads the field of whatever `x` is bound to once that binding is
 * known, so binding the read at `readId` to a definition holding `envState` links the access to that field.
 */
export function bindAccessedField(graph: DataflowGraph, readId: NodeId, envState: REnvironmentInformation, idMap: AstIdMap): void {
	const read = idMap.get(readId);
	const access = read === undefined ? undefined : RNode.directParent(read, idMap);
	if(!RAccess.is(access) || access.accessed.info.id !== readId) {
		return;
	}
	const fieldName = accessedFieldName(unpackArg(access.access[0]), RAccess.isNamed(access));
	linkFieldReads(graph, access.info.id, fieldName ? envState.current.memory.get(fieldName) : undefined, true);
}
