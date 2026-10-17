import { RArgument } from '../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import { DefaultMap } from '../../util/collections/defaultmap';
import { RFunctionCall } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { FunctionSemantics } from '../fn/function-semantics';
import { RNode } from '../../r-bridge/lang-4.x/ast/model/model';
import { isNotUndefined } from '../../util/assert';
import { expensiveTrace } from '../../util/log';
import type { BuiltIn } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { type InGraphIdentifierDefinition, hasEnvState, Identifier, type IdentifierDefinition, type IdentifierReference, isReferenceType, ReferenceType } from '../environments/identifier';
import type { FunctionArgument, DataflowGraph } from '../graph/graph';
import type { RParameter } from '../../r-bridge/lang-4.x/ast/model/nodes/r-parameter';
import type { AstIdMap, ParentInformation } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { dataflowLogger } from '../logger';
import { ControlFlowEdgeTypes, DfEdge, EdgeType } from '../graph/edge';
import { type DataflowGraphVertexFunctionCall, type DataflowGraphVertexFunctionDefinition, type DataflowGraphVertexInfo, VertexType } from '../graph/vertex';
import type { REnvironmentInformation } from '../environments/environment';
import type { ControlDependency, ExitPoint } from '../info';
import { negateControlDependency, doesExitPointPropagateCalls } from '../info';
import { RAccess } from '../../r-bridge/lang-4.x/ast/model/nodes/r-access';
import { RNumber } from '../../r-bridge/lang-4.x/ast/model/nodes/r-number';
import { RString } from '../../r-bridge/lang-4.x/ast/model/nodes/r-string';
import { UnnamedFunctionCallPrefix } from './process/functions/call/unnamed-call-handling';
import { BuiltInProcName } from '../environments/built-in-proc-name';
import { DfgVertex } from '../graph/vertex';
import { Resolve } from '../environments/resolve-helper';
import { RFunctionDefinition } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-definition';
import { RBinaryOp } from '../../r-bridge/lang-4.x/ast/model/nodes/r-binary-op';
import { RSymbol } from '../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { BuiltInLookup } from '../fn/frame-reflection';
import { Dataflow } from '../graph/df-helper';

export type NameIdMap = DefaultMap<Identifier, IdentifierReference[]>;

const ValueFlowBits = EdgeType.Reads | EdgeType.DefinedBy | EdgeType.DefinedByOnCall;
const FCallLinkReadBits = EdgeType.Reads | EdgeType.Calls | EdgeType.DefinedByOnCall;

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
	const nonLocalReads: IdentifierReference[] = [];
	/* the tag already says what the reference is, so no vertex has to be fetched to decide */
	for(const [tag, type] of [[VertexType.Use, ReferenceType.Variable], [VertexType.FunctionCall, ReferenceType.Function]] as const) {
		for(const [nodeId] of graph.verticesOfType(tag)) {
			if(ignores.has(nodeId)) {
				continue;
			}
			/* control flow edges say nothing about what a name resolves to, so they do not count as a link */
			let linked = false;
			let nonLocal = false;
			for(const [target, e] of graph.edgesFrom(nodeId)) {
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
				nonLocalReads.push({ nodeId, name: NodeId.recoverName(nodeId, graph.idMap), type });
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
 * {@link FunctionSemantics.call.match.onCall|Matches} the arguments to the parameters and links them in the graph,
 * returning the resolved map from argument ids to parameter ids.
 * @useInstead {@link FunctionSemantics.call.match.onCallAndLink}
 */
export function linkArgumentsOnCall(args: readonly FunctionArgument[], params: readonly RParameter<ParentInformation>[], graph: DataflowGraph): Map<NodeId, NodeId> {
	return FunctionSemantics.call.match.onCallAndLink(args, params, graph);
}

function environmentsOfCallee(info: DataflowGraphVertexFunctionCall, environment: REnvironmentInformation): readonly REnvironmentInformation[] {
	if(info.name === undefined) {
		return [];
	}
	return (Resolve.byName(info.name, environment) ?? []).filter(hasEnvState).map(d => d.envState);
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
		let callee: readonly REnvironmentInformation[] | undefined;
		/* for each open ingoing reference, try to resolve it here, and if so, add a read edge from the call to signal that it reads it */
		for(const ingoing of fnSubflow.in) {
			const name = ingoing.name;
			if(name === undefined) {
				continue;
			}
			callee ??= environmentsOfCallee(info, environment);
			const inCallee = callee.values().map(env => Resolve.byNameAndType(name, env, ingoing.type)).find(isNotUndefined);
			const defs = inCallee ?? Resolve.byNameAndType(name, environment, ingoing.type) ?? [];
			for(const { nodeId, type, value, definedAt, envState } of defs as readonly InGraphIdentifierDefinition[]) {
				if(fnSubflow.graph.has(nodeId) || NodeId.isBuiltIn(nodeId)) {
					continue;
				}
				graph.addEdge(ingoing.nodeId, nodeId, EdgeType.DefinedByOnCall);
				graph.addEdge(id, nodeId, EdgeType.DefinesOnCall);
				if(envState !== undefined) {
					linkFieldWritesOnCall(graph, id, fnId, ingoing.nodeId, nodeId, envState, idMap);
				}
				if(definedAt !== undefined && definedAt !== nodeId && !NodeId.isBuiltIn(definedAt)
					&& graph.hasVertex(definedAt) && !DfgVertex.isVariableDefinition(graph.getVertex(nodeId))) {
					graph.addEdge(id, definedAt, EdgeType.Reads);
				}
				if(type === ReferenceType.Function && ingoing.type === ReferenceType.S7MethodPrefix && Array.isArray(value)) {
					for(const v of value) {
						graph.addEdge(id, v, EdgeType.Calls);
						graph.addEdge(ingoing.nodeId, v, EdgeType.Calls);
						const vInfo = graph.getVertex(v);
						if(DfgVertex.isFunctionDefinition(vInfo) && !vInfo.mode?.includes('s7')) {
							(vInfo.mode ??= []).push('s7');
						}
					}
				}
			}
		}
	}

	for(const node of fnSubflow.graph) {
		if(!DfgVertex.isVariableDefinition(graph.getVertex(node)) || fieldAssignmentOf(node, idMap) === undefined) {
			continue;
		}
		for(const captured of Dataflow.targetsOf(graph, node, EdgeType.Reads)) {
			const frame = fnSubflow.graph.has(captured) ? undefined : RNode.findEnclosing(captured, idMap, RFunctionDefinition.is);
			const owner = frame === undefined ? undefined : graph.getVertex(frame);
			const name = NodeId.recoverName(captured, idMap);
			const envState = DfgVertex.isFunctionDefinition(owner) && name !== undefined ? Resolve.byName(name, owner.subflow.environment)?.filter(hasEnvState).find(d => d.nodeId === captured)?.envState : undefined;
			if(envState !== undefined) {
				linkFieldWritesOnCall(graph, id, fnId, node, captured, envState, idMap);
			}
		}
	}

	for(const exitPoint of exitPoints) {
		graph.addEdge(id, exitPoint.nodeId, EdgeType.Returns);
	}
	expensiveTrace(dataflowLogger, () => `recording expr-list-level call from ${NodeId.recoverName(id, idMap)} to ${NodeId.recoverName(fnId, idMap)}`);
	graph.addEdge(id, fnId, EdgeType.Calls);
	const fn = idMap.get(fnId);
	if(RFunctionDefinition.is(fn)) {
		applyForForcedArgs(graph, id, params, linkArgumentsOnCall(info.args, fn.parameters, graph));
	}
	return exitPoints.filter(e => doesExitPointPropagateCalls(e.type));
}

/** for each parameter that we link that gets forced, add a reads edge from the call to argument to show that it reads it */
function applyForForcedArgs(graph: DataflowGraph, callId: NodeId, readParams: Record<NodeId, boolean>, argToParam: ReadonlyMap<NodeId, NodeId>): void {
	for(const [arg, param] of argToParam) {
		if(readParams[String(param)]) {
			graph.addEdge(callId, arg, EdgeType.Reads);
			/* a call in the argument only runs when the call forces it, so its side effects depend on the call */
			if(DfgVertex.isFunctionCall(graph.getVertex(arg))) {
				graph.addEdge(arg, callId, EdgeType.Reads);
			}
		}
	}
}

/** The call `id` of `fnId` writes the fields of the environment `binding` holds through every alias of `start`. */
function linkFieldWritesOnCall(graph: DataflowGraph, id: NodeId, fnId: NodeId, start: NodeId, binding: NodeId, envState: REnvironmentInformation, idMap: AstIdMap): void {
	const aliases = new Set<NodeId>([start]);
	for(const alias of aliases) {
		for(const from of Dataflow.sourcesOf(graph, alias, ValueFlowBits)) {
			aliases.add(from);
		}
	}
	for(const read of aliases) {
		bindAccessedField(graph, read, envState, idMap);
		const write = fieldAssignmentOf(read, idMap);
		if(write !== undefined) {
			graph.addEdge(id, write, EdgeType.Reads);
			graph.addEdge(binding, id, EdgeType.SideEffectOnCall);
			/* a write in a nested function only runs when that function is called */
			const within = RNode.findEnclosing(write, idMap, RFunctionDefinition.is);
			for(const caller of within === undefined || within === fnId ? [] : Dataflow.sourcesOf(graph, within, EdgeType.Calls)) {
				graph.addEdge(write, caller, EdgeType.Reads);
			}
		}
	}
}

/** What {@link linkFunctionCalls} reports for a call it linked. */
export type CalledFunctions = {
	functionCall:        NodeId,
	called:              readonly DataflowGraphVertexInfo[],
	propagateExitPoints: readonly ExitPoint[],
	calledBuiltIns?:     readonly NodeId[]
};

function linkFunctionCall(graph: DataflowGraph, id: NodeId, info: DataflowGraphVertexFunctionCall, idMap: AstIdMap, isRoot: boolean): CalledFunctions | undefined {
	const readIds = new Set<NodeId>();
	for(const [t, e] of graph.edgesFrom(id)) {
		if(!NodeId.isBuiltIn(t) && DfEdge.doesNotIncludeType(e, EdgeType.Argument) && DfEdge.includesType(e, FCallLinkReadBits)) {
			readIds.add(t);
		}
	}
	const [functionDefs, builtIns] = getAllLinkedFunctionDefinitions(readIds, graph);
	const propagateExitPoints: ExitPoint[] = [];
	for(const def of functionDefs) {
		/* we can skip this if we already linked it */
		if(!Dataflow.hasEdge(graph, id, def.id, EdgeType.Calls)) {
			propagateExitPoints.push(...linkFunctionCallWithSingleTarget(graph, def, info, idMap));
		}
	}
	if(!isRoot || (functionDefs.size === 0 && builtIns.size === 0)) {
		return undefined;
	}
	/* a built-in reached through a variable (`p <- par; p(...)`) was not processed as that built-in */
	const calledBuiltIns = builtIns.size > 0 ? [...builtIns] : undefined;
	return { functionCall: id, called: [...functionDefs], propagateExitPoints, calledBuiltIns };
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
): CalledFunctions[] {
	const called: (CalledFunctions | undefined)[] = [];
	for(const [id, info] of thisGraph.verticesOfType(VertexType.FunctionCall)) {
		if(!info.onlyBuiltin) {
			called.push(linkFunctionCall(graph, id, info, idMap, thisGraph.isRoot(id)));
		}
	}
	for(const id of alsoCalls) {
		const info = graph.getVertex(id);
		if(DfgVertex.isFunctionCall(info)) {
			called.push(linkFunctionCall(graph, id, info, idMap, graph.isRoot(id)));
		}
	}
	return called.filter(isNotUndefined);
}

/**
 * convenience function returning all known call targets, as well as the name source which defines them
 * @useInstead {@link Dataflow.callTargetsOf}
 */
export function getAllFunctionCallTargets(call: NodeId, graph: DataflowGraph, environment?: REnvironmentInformation): NodeId[] {
	const info = graph.getVertex(call);
	if(!DfgVertex.isFunctionCall(info)) {
		return [];
	}
	const known = environment ?? info.environment;
	const refType = DfgVertex.hasOrigin(info, BuiltInProcName.S3Dispatch) ? ReferenceType.S3MethodPrefix :
		DfgVertex.hasOrigin(info, BuiltInProcName.S7Dispatch) ? ReferenceType.S7MethodPrefix : ReferenceType.Function;
	let functionCallDefs: NodeId[] = [];
	if(known !== undefined && info.name !== undefined && !Identifier.getName(info.name).startsWith(UnnamedFunctionCallPrefix)) {
		functionCallDefs = Resolve.byNameAndType(info.name, known, refType)?.map(d => d.nodeId) ?? [];
	}
	const followBits = DfgVertex.hasOrigin(info, BuiltInProcName.Unnamed) || functionCallDefs.length === 0 ? FCallLinkReadBits : EdgeType.Calls;
	for(const [target, edge] of graph.edgesFrom(call)) {
		if(DfEdge.includesType(edge, followBits) && DfEdge.doesNotIncludeType(edge, EdgeType.Argument) && (known !== undefined || !NodeId.isBuiltIn(target))) {
			functionCallDefs.push(target);
		}
	}
	if(functionCallDefs.length === 0) {
		return [];
	}
	const [targets, builtIns] = getAllLinkedFunctionDefinitions(new Set(functionCallDefs), graph);
	return [...new Set([...targets.values().map(t => t.id), ...builtIns, ...functionCallDefs])];
}

/**
 * Finds all linked function definitions starting from the given read ids; expects the caller to already have resolved
 * the accessed objects (first layer of reads/returns/calls/...). For call targets, use {@link Dataflow.callTargetsOf} instead.
 */
export function getAllLinkedFunctionDefinitions(
	functionDefinitionReadIds: ReadonlySet<NodeId>,
	dataflowGraph: DataflowGraph
): [Set<Required<DataflowGraphVertexFunctionDefinition>>, Set<BuiltIn>] {
	const result = new Set<Required<DataflowGraphVertexFunctionDefinition>>();
	const builtIns = new Set<BuiltIn>();
	const potential: [NodeId, boolean][] = Array.from(functionDefinitionReadIds, id => [id, false]);
	const visited = new Set<NodeId>();
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
		} else if(vertex.subflow !== undefined) {
			result.add(vertex as Required<DataflowGraphVertexFunctionDefinition>);
			continue;
		}
		const nextViaAccess = viaAccess || DfgVertex.hasOrigin(vertex, BuiltInProcName.Access);
		const isSkipType = DfgVertex.isFunctionCall(vertex) || (DfgVertex.isVariableDefinition(vertex) && vertex.par && !nextViaAccess);
		let hasReturnEdge = false;
		let followTargets: NodeId[] | undefined;
		/* a list handed on as a whole (a loop, an apply) yields its entries, an access the entry it names */
		const handedBack = !viaAccess && DfgVertex.hasOrigin(vertex, BuiltInProcName.List) ? EdgeType.Returns | EdgeType.Argument : EdgeType.Returns;
		for(const [target, e] of dataflowGraph.edgesFrom(cid)) {
			if(DfEdge.includesType(e, handedBack)) {
				hasReturnEdge = true;
				if(!visited.has(target)) {
					potential.push([target, nextViaAccess]);
				}
			} else if(!isSkipType && !hasReturnEdge && DfEdge.includesType(e, ValueFlowBits) && !visited.has(target)) {
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
			/* the call vertex carries the call's id, its name symbol has no vertex of its own */
			references.push({ nodeId: inner.info.id, name: inner.functionName.content, cds: undefined, type: ReferenceType.Function });
		} else if(RSymbol.is(inner) && !callees.has(inner.info.id)) {
			references.push({ nodeId: inner.info.id, name: inner.content, cds: undefined, type: ReferenceType.Variable });
		}
		return false;
	});
	const unresolved = linkInputs(references, environment, [], graph, false);
	for(const call of references.filter(r => r.type === ReferenceType.Function)) {
		linkCallToDefinitions(graph, call.nodeId, Resolve.byNameAndType(call.name as Identifier, environment, ReferenceType.Function)?.map(d => d.nodeId) ?? [], idMap);
	}
	return unresolved;
}

/** Links the call `callId` to the functions the given definitions bind, which it did not know of when it was processed. */
export function linkCallToDefinitions(graph: DataflowGraph, callId: NodeId, definitions: readonly NodeId[], idMap: AstIdMap): void {
	const call = graph.getVertex(callId);
	if(definitions.length === 0 || !DfgVertex.isFunctionCall(call)) {
		return;
	}
	for(const fn of getAllLinkedFunctionDefinitions(new Set(definitions), graph)[0]) {
		if(!Dataflow.hasEdge(graph, callId, fn.id, EdgeType.Calls)) {
			linkFunctionCallWithSingleTarget(graph, fn, call, idMap);
		}
	}
}

/**
 * Links a set of read variables to definitions in `environmentInformation`; each reference that cannot be linked (or
 * links to built-ins only) is added to `givenInputs` (marked maybe if `maybeForRemaining`), and the extended list is returned.
 * @param alsoFrom - a node that reads every definition found as well
 */
export function linkInputs(referencesToLinkAgainstEnvironment: readonly IdentifierReference[], environmentInformation: REnvironmentInformation, givenInputs: IdentifierReference[], graph: DataflowGraph, maybeForRemaining: boolean, alsoFrom?: NodeId): IdentifierReference[] {
	for(const bodyInput of referencesToLinkAgainstEnvironment) {
		const probableTarget = bodyInput.name ? Resolve.byNameAndType(bodyInput.name, environmentInformation, bodyInput.type) : undefined;
		if(probableTarget === undefined) {
			if(maybeForRemaining) {
				bodyInput.cds ??= [];
			}
			givenInputs.push(bodyInput);
			continue;
		}
		for(const target of probableTarget) {
			graph.addEdge(bodyInput.nodeId, target.nodeId, EdgeType.Reads);
			if(alsoFrom !== undefined) {
				graph.addEdge(alsoFrom, target.nodeId, EdgeType.Reads);
			}
		}
		if(probableTarget.every(t => isReferenceType(t.type, ReferenceType.BuiltInConstant | ReferenceType.BuiltInFunction))) {
			givenInputs.push(bodyInput);
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
			for(const def of environment.current.memory.get(Identifier.getName(name)) ?? []) {
				if(outgoingIds.has(def.nodeId)) {
					for(const target of targets) {
						graph.addEdge(target.nodeId, def.nodeId, EdgeType.Reads);
					}
				}
			}
		}
		return;
	}
	/* fallback: keep only the last definition per identifier (used when no environment is available) */
	const lastOutgoing = new Map<Identifier, IdentifierReference>();
	for(const out of outgoing) {
		if(out.name) {
			lastOutgoing.set(out.name, out);
		}
	}
	for(const [name, targets] of openIns.entries()) {
		for(const [outName, { nodeId }] of lastOutgoing) {
			if(Identifier.matches(outName, name)) {
				for(const target of targets) {
					graph.addEdge(target.nodeId, nodeId, EdgeType.Reads);
				}
			}
		}
	}
}

function addControlDependency(holder: { cds?: ControlDependency[] | undefined }, cd: ControlDependency): boolean {
	if(holder.cds?.some(c => c.id === cd.id)) {
		return false;
	}
	(holder.cds ??= []).push(cd);
	return true;
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
			if(!addControlDependency(ref, cd)) {
				continue;
			}
			const vertex = graph.getVertex(ref.nodeId);
			if(vertex) {
				addControlDependency(vertex, cd);
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
		definition.subflow.in = linkInputs(definition.subflow.in, environment, [], graph, false, callId);
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
		if(fd.definedAt !== undefined && fd.definedAt !== fd.nodeId) {
			graph.addEdge(accessId, fd.definedAt, EdgeType.Reads);
		}
		if(returnsFunctions && fd.type === ReferenceType.Function) {
			graph.addEdge(accessId, fd.nodeId, EdgeType.Returns);
		}
	}
}

/** The call writing a field into the environment the symbol `readId` holds: `x$f <- v` (its replacement call) or `assign("f", v, envir = x)`. */
function fieldAssignmentOf(readId: NodeId, idMap: AstIdMap): NodeId | undefined {
	const read = idMap.get(readId);
	const access = read === undefined ? undefined : RNode.directParent(read, idMap);
	/* `assign("f", v, envir = x)` writes into `x` as well */
	const call = access === undefined ? undefined : RNode.directParent(access, idMap);
	if(RFunctionCall.isNamed(call, 'assign') && call.arguments.indexOf(access as never) >= 2) {
		return call.info.id;
	}
	if(!RAccess.is(access) || access.accessed.info.id !== readId) {
		return undefined;
	}
	/* `x$f[[k]] <- v` writes the field `f` as well */
	let target: RNode<ParentInformation> = access;
	let assign = call;
	while(RAccess.is(assign) && assign.accessed.info.id === target.info.id) {
		target = assign;
		assign = RNode.directParent(assign, idMap);
	}
	/* the replacement call `$<-` carries the id of the access it writes through */
	return RBinaryOp.is(assign) && assign.lhs.info.id === target.info.id && /^(<<?-|=)$/.test(assign.operator) ? access.info.id : undefined;
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
	const fieldName = accessedFieldName(RArgument.valueOf(access.access[0]), RAccess.isNamed(access));
	linkFieldReads(graph, access.info.id, fieldName ? envState.current.memory.get(fieldName) : undefined, true);
}

/** The factory that creates and returns only `closure`, calling only known built-ins and not reflecting on its frame, with the names its frame binds. */
function factoryOf(closure: DataflowGraphVertexFunctionDefinition, graph: DataflowGraph, known: BuiltInLookup, idMap: AstIdMap): { readonly factory: NodeId, readonly locals: ReadonlySet<string> } | undefined {
	const id = RNode.strictlyEnclosingFunction(closure.id, idMap);
	const factory = id === undefined ? undefined : graph.getVertex(id);
	if(!DfgVertex.isFunctionDefinition(factory) || factory.exitPoints.length === 0 || !factory.exitPoints.every(e => e.nodeId === closure.id)
		|| FunctionSemantics.frameReflection(factory, graph, { known }) !== 0) {
		return undefined;
	}
	const locals = new Set<string>();
	for(const node of factory.subflow.graph) {
		const vertex = graph.getVertex(node);
		if(node === closure.id || closure.subflow.graph.has(node)) {
			continue;
		} else if(DfgVertex.isFunctionDefinition(vertex) || (DfgVertex.isFunctionCall(vertex) && (!vertex.onlyBuiltin || graph.unknownSideEffects.has(NodeId.normalize(node))))
			|| DfgVertex.hasOrigin(vertex, BuiltInProcName.SuperAssignment)) {
			return undefined;
		} else if(DfgVertex.isVariableDefinition(vertex)) {
			locals.add(NodeId.recoverName(node, idMap) ?? '');
		}
	}
	for(const param of Object.keys(factory.params)) {
		locals.add(NodeId.recoverName(NodeId.normalize(param), idMap) ?? '');
	}
	return { factory: factory.id, locals };
}

/** The factory calls whose closure `call` may run, `undefined` if it may run one created any other way. */
function instancesOf(call: NodeId, closure: NodeId, factory: NodeId, graph: DataflowGraph): NodeId[] | undefined {
	if(!Dataflow.hasEdge(graph, call, closure, EdgeType.Calls)) {
		return undefined;
	}
	const instances: NodeId[] = [];
	for(const [binding, edge] of graph.edgesFrom(call)) {
		if(!DfEdge.includesType(edge, EdgeType.Reads) || DfEdge.includesType(edge, EdgeType.Argument) || NodeId.isBuiltIn(binding)) {
			continue;
		}
		/* the binding the call reads holds what one call of the factory created, and nothing else */
		const isCallOfAFunction = (target: NodeId) => {
			const vertex = graph.getVertex(target);
			return DfgVertex.isFunctionCall(vertex) && !DfgVertex.hasOrigin(vertex, BuiltInProcName.Assignment);
		};
		const created = DfgVertex.isVariableDefinition(graph.getVertex(binding)) ? Dataflow.targetsOf(graph, binding, EdgeType.DefinedBy).filter(isCallOfAFunction) : [];
		const callees = created.length === 1 ? Dataflow.targetsOf(graph, created[0], EdgeType.Calls) : [];
		if(callees.length !== 1 || callees[0] !== factory) {
			return undefined;
		}
		instances.push(created[0]);
	}
	return instances.length > 0 ? instances : undefined;
}

/** A closure's `<<-` into its factory frame is seen only by calls of closures from the same factory call, so such calls depend on each other instead. */
export function separateClosureInstances(graph: DataflowGraph, known: BuiltInLookup): void {
	const idMap = graph.idMap;
	if(idMap === undefined) {
		return;
	}
	for(const [closure, vertex] of graph.verticesOfType(VertexType.FunctionDefinition)) {
		/* only a closure writing with `<<-` can share state */
		const superAssignments = vertex.subflow.graph.values().filter(id => DfgVertex.hasOrigin(graph.getVertex(id), BuiltInProcName.SuperAssignment)).toArray();
		const found = superAssignments.length === 0 ? undefined : factoryOf(vertex, graph, known, idMap);
		if(found === undefined) {
			continue;
		}
		const writes = superAssignments.flatMap(id => Dataflow.targetsOf(graph, id, EdgeType.Returns)).filter(target => {
			const name = idMap.get(target);
			return RSymbol.is(name) && found.locals.has(Identifier.getName(name.content));
		});
		/* someone outside the closure seeing the write would see it for every instance */
		const seenOutside = (write: NodeId) => Dataflow.sourcesOf(graph, write, ~ControlFlowEdgeTypes).some(from => !vertex.subflow.graph.has(from));
		if(writes.length === 0 || writes.some(seenOutside)) {
			continue;
		}
		const calls = new Map<NodeId, NodeId[] | undefined>();
		for(const call of writes.flatMap(w => Dataflow.targetsOf(graph, w, EdgeType.SideEffectOnCall))) {
			calls.set(call, instancesOf(call, closure, found.factory, graph));
		}
		if(new Set([...calls.values()].flatMap(i => i ?? [])).size < 2) {
			continue;
		}
		for(const write of writes) {
			for(const call of calls.keys()) {
				graph.removeEdgeType(write, call, EdgeType.SideEffectOnCall);
			}
		}
		for(const [call, instances] of calls) {
			for(const [other, others] of calls) {
				if(other !== call && (instances === undefined || others === undefined || instances.some(i => others.includes(i)))) {
					graph.addEdge(call, other, EdgeType.Reads);
				}
			}
		}
	}
}
