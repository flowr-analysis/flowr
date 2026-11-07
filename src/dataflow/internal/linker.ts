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
import type { DataflowGraph } from '../graph/graph';
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
import { readEnvironmentContents } from './process/functions/call/built-in/built-in-envir-utils';
import { BuiltInProcName } from '../environments/built-in-proc-name';
import { DfgVertex } from '../graph/vertex';
import { Resolve } from '../environments/resolve-helper';
import { scopeOf } from '../environments/resolve-by-name';
import { RFunctionDefinition } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-definition';
import { RBinaryOp } from '../../r-bridge/lang-4.x/ast/model/nodes/r-binary-op';
import { RSymbol } from '../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { BuiltInLookup } from '../fn/frame-reflection';
import { Dataflow } from '../graph/df-helper';
import { ClosureFrames } from '../graph/closure-frames';
import { AmbientStateName } from '../environments/ambient-state-name';
import { instanceBindingsOfMethod } from '../fn/class-declaration';
import { ReachSummaries, unionOfSets } from '../../util/fixpoint';

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
				nonLocalReads.push({ nodeId, name: NodeId.recoverBareName(nodeId, graph.idMap), type });
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

function environmentsOfCallee(info: DataflowGraphVertexFunctionCall, environment: REnvironmentInformation): readonly REnvironmentInformation[] {
	if(info.name === undefined) {
		return [];
	}
	return (Resolve.byName(info.name, environment) ?? []).filter(hasEnvState).map(d => d.envState);
}

/** The definitions holding the instance a method call `obj$m(...)` runs `fn` on, with the names `fn` sees that instance by. */
function instanceOfMethodCall(graph: DataflowGraph, fn: NodeId, info: DataflowGraphVertexFunctionCall, environment: REnvironmentInformation, idMap: AstIdMap): { readonly bindings: readonly string[], readonly holders: readonly IdentifierDefinition[] } | undefined {
	const call = idMap.get(info.id);
	/* a method taken out of its instance first, `f <- o$m; f()`, still runs on that instance */
	const accesses = RFunctionCall.isUnnamed(call) ? [call.calledFunction] : Dataflow.targetsOf(graph, info.id, EdgeType.Reads).map(d => idMap.get(Dataflow.assignedValueOf(d, graph) ?? d));
	const instances = accesses.map(a => RAccess.is(a) && RSymbol.is(a.accessed) ? a.accessed.content : undefined).filter(isNotUndefined);
	const bindings = instances.length > 0 ? instanceBindingsOfMethod(fn, graph, idMap) : undefined;
	const holders = bindings && instances.flatMap(i => Resolve.byNameAndType(i, environment, ReferenceType.Variable)?.filter(hasEnvState) ?? []);
	return holders?.length ? { bindings: bindings as readonly string[], holders } : undefined;
}

/**
 * The frames of `environment` a function whose body runs at `bodyLevel` can see: the frame it was defined in and
 * those around it, never the frames of the functions calling it.
 */
function definitionFramesOf(bodyLevel: number, environment: REnvironmentInformation): REnvironmentInformation {
	const level = Math.max(0, Math.min(bodyLevel - 1, environment.level));
	let current = environment.current;
	for(let skip = environment.level - level; skip > 0 && current.parent !== undefined; skip--) {
		current = current.parent;
	}
	return { current, level };
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
		let lexical: REnvironmentInformation | undefined;
		let instance: ReturnType<typeof instanceOfMethodCall> | null = null;
		/* for each open ingoing reference, try to resolve it here, and if so, add a read edge from the call to signal that it reads it */
		for(const ingoing of fnSubflow.in) {
			const name = ingoing.name;
			if(name === undefined) {
				continue;
			}
			/* a variable is looked up where the function was defined, global state (options, files, the working directory) is what it is where it is called */
			const inCallee = AmbientStateName.is(name) ? undefined : (callee ??= environmentsOfCallee(info, environment)).values().map(env => Resolve.byNameAndType(name, env, ingoing.type)).find(isNotUndefined);
			const defs = inCallee ?? Resolve.byNameAndType(name, AmbientStateName.is(name) ? environment : lexical ??= definitionFramesOf(fnSubflow.environment.level, environment), ingoing.type)
				?? ((instance ??= instanceOfMethodCall(graph, fnId, info, environment, idMap))?.bindings.includes(Identifier.getName(name)) ? instance.holders : []);
			for(const def of defs as readonly InGraphIdentifierDefinition[]) {
				const { nodeId, type, value, definedAt, envState } = def;
				/* the state an earlier run of the function left behind is what its next run reads */
				if(fnSubflow.graph.has(nodeId) && !AmbientStateName.is(name) || NodeId.isBuiltIn(nodeId)) {
					continue;
				}
				graph.addEdge(ingoing.nodeId, nodeId, EdgeType.DefinedByOnCall);
				graph.addEdge(id, nodeId, EdgeType.DefinesOnCall);
				if(envState !== undefined) {
					linkFieldWritesOnCall(graph, id, fnId, ingoing.nodeId, nodeId, envState, idMap);
					readEnvironmentContents(graph, id, def);
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
			const name = NodeId.recoverBareName(captured, idMap);
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
		applyForForcedArgs(graph, id, params, FunctionSemantics.call.match.onCallAndLink(info.args, fn.parameters, graph));
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

/**
 * Whether the call `info` may get its function from `target`, which it has the edge `e` to. An unnamed call reads
 * the expression that gives its function. A named call that only reads another call reads state that call wrote,
 * like the options, unless that call binds the name. No call binds a name that resolves to nothing (`unbound`),
 * and a call processed by default (`options()`, `par()`) binds no name at all. What lies within an argument the call
 * reads only when forcing it.
 */
function mayBeFunctionSource(graph: DataflowGraph, info: DataflowGraphVertexFunctionCall, target: NodeId, e: DfEdge, unbound = false): boolean {
	if(DfEdge.includesType(e, EdgeType.Calls | EdgeType.DefinedByOnCall)) {
		return true;
	} else if(isWithinArgumentOf(graph, info.id, target)) {
		return false;
	}
	const vertex = graph.getVertex(target);
	return DfgVertex.hasOrigin(info, BuiltInProcName.Unnamed) || !DfgVertex.isFunctionCall(vertex)
		|| (!unbound && (vertex.origin === 'unnamed' || vertex.origin.some(o => o !== BuiltInProcName.Default)));
}

/**
 * Whether `target` lies within an argument of `call`, which the call reads when it forces that argument, not to find its function.
 * It needs the id map of the graph and answers `false` without one, and it walks up the AST from `target`, so ask it
 * for the few reads a call has, not for every vertex.
 * @example
 * ```ts
 * // for `f(x)`, the read of `x` is within an argument of the call to `f`
 * isWithinArgumentOf(graph, callIdOfF, readIdOfX); // true
 * ```
 */
export function isWithinArgumentOf(graph: DataflowGraph, call: NodeId, target: NodeId): boolean {
	const idMap = graph.idMap;
	if(idMap === undefined) {
		return false;
	}
	for(let node = idMap.get(target); node !== undefined && node.info.id !== call; node = RNode.directParent(node, idMap)) {
		if(Dataflow.hasEdge(graph, call, node.info.id, EdgeType.Argument)) {
			return true;
		}
	}
	return false;
}

function linkFunctionCall(graph: DataflowGraph, id: NodeId, info: DataflowGraphVertexFunctionCall, idMap: AstIdMap, isRoot: boolean): CalledFunctions | undefined {
	const readIds = new Set<NodeId>();
	for(const [t, e] of graph.edgesFrom(id)) {
		if(!NodeId.isBuiltIn(t) && DfEdge.doesNotIncludeType(e, EdgeType.Argument) && DfEdge.includesType(e, FCallLinkReadBits) && mayBeFunctionSource(graph, info, t, e)) {
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
 * Over-approximates for calls through reads and aliases (all functions the read may evaluate to are returned).
 * @param resolver - shares the walk with the other calls it resolves targets for, as long as the graph does not change
 * @useInstead {@link Dataflow.callTargetsOf}
 */
export function getAllFunctionCallTargets(call: NodeId, graph: DataflowGraph, environment?: REnvironmentInformation, resolver?: LinkedFunctionResolver): NodeId[] {
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
	const unbound = known !== undefined && functionCallDefs.length === 0;
	for(const [target, edge] of graph.edgesFrom(call)) {
		if(DfEdge.includesType(edge, followBits) && DfEdge.doesNotIncludeType(edge, EdgeType.Argument) && (known !== undefined || !NodeId.isBuiltIn(target))
			&& mayBeFunctionSource(graph, info, target, edge, unbound)) {
			functionCallDefs.push(target);
		}
	}
	if(functionCallDefs.length === 0) {
		return [];
	}
	const reads = new Set(functionCallDefs);
	const [targets, builtIns] = resolver?.resolve(reads) ?? getAllLinkedFunctionDefinitions(reads, graph);
	return [...new Set([...targets.values().map(t => t.id), ...builtIns, ...functionCallDefs])];
}

/**
 * Finds all linked function definitions starting from the given read ids; expects the caller to already have resolved
 * the accessed objects (first layer of reads/returns/calls/...). For call targets, use {@link Dataflow.callTargetsOf} instead.
 * @see {@link LinkedFunctionResolver} - to find them for many sets of reads over the same graph
 */
export function getAllLinkedFunctionDefinitions(
	functionDefinitionReadIds: ReadonlySet<NodeId>,
	dataflowGraph: DataflowGraph
): [Set<Required<DataflowGraphVertexFunctionDefinition>>, Set<BuiltIn>] {
	const result = new Set<Required<DataflowGraphVertexFunctionDefinition>>();
	const builtIns = new Set<BuiltIn>();
	const potential: [NodeId, boolean, NodeId | undefined][] = Array.from(functionDefinitionReadIds, id => [id, false, undefined]);
	/* the calls each vertex was expanded under, by whether an access led to it */
	const expanded = [new Map<NodeId, Set<NodeId | undefined>>(), new Map<NodeId, Set<NodeId | undefined>>()] as const;
	const scopes: CallScopes = new Map();
	const next = (id: NodeId, viaAccess: boolean, call: NodeId | undefined) => {
		if(expanded[viaAccess ? 1 : 0].get(id)?.has(call) !== true) {
			potential.push([id, viaAccess, call]);
		}
	};

	while(potential.length !== 0) {
		const [cid, viaAccess, call] = potential.pop() as [NodeId, boolean, NodeId | undefined];
		const done = expanded[viaAccess ? 1 : 0];
		const calls = done.get(cid);
		/* without a call nothing restricts the walk, so that visit covers those under any call */
		if(calls === undefined) {
			done.set(cid, new Set([call]));
		} else if(calls.has(call) || calls.has(undefined)) {
			continue;
		} else {
			calls.add(call);
		}
		const end = walkLinkedDefinitions(dataflowGraph, cid, viaAccess, call, scopes, next);
		if(end === undefined) {
			continue;
		} else if(NodeId.isBuiltIn(end)) {
			builtIns.add(end);
		} else {
			result.add(dataflowGraph.getVertex(end) as Required<DataflowGraphVertexFunctionDefinition>);
		}
	}
	return [result, builtIns];
}

/**
 * One step of the walk for the function definitions that reads may evaluate to: hands each state the walk goes on to
 * from `id` to `next`, or returns `id` if the walk ends at it, being a built-in or a function definition.
 * `call` is the call whose return led into the current body, so a parameter it binds holds only what it passes.
 */
function walkLinkedDefinitions(graph: DataflowGraph, id: NodeId, viaAccess: boolean, call: NodeId | undefined, scopes: CallScopes, next: (id: NodeId, viaAccess: boolean, call: NodeId | undefined) => void): NodeId | undefined {
	if(NodeId.isBuiltIn(id)) {
		return id;
	}
	const vertex = graph.getVertex(id);
	if(vertex === undefined) {
		return undefined;
	} else if(vertex.subflow !== undefined) {
		return id;
	} else if(!viaAccess && DfgVertex.isValue(vertex)) {
		for(const named of functionsNamedBy(graph, id)) {
			next(named, false, undefined);
		}
	}
	const nextViaAccess = viaAccess || DfgVertex.hasOrigin(vertex, BuiltInProcName.Access);
	const isSkipType = DfgVertex.isFunctionCall(vertex) || (DfgVertex.isVariableDefinition(vertex) && vertex.par && !nextViaAccess);
	let hasReturnEdge = false;
	let followTargets: [NodeId, boolean][] | undefined;
	/* a list handed on as a whole (a loop, an apply) yields its entries, an access the entry it names */
	const handedBack = !viaAccess && DfgVertex.hasOrigin(vertex, BuiltInProcName.List) ? EdgeType.Returns | EdgeType.Argument : EdgeType.Returns;
	/* only a call into a body binds parameters, a built-in hands back what it is given in the same context */
	const returnedTo = DfgVertex.isFunctionCall(vertex) && !vertex.onlyBuiltin ? id : call;
	for(const [target, e] of graph.edgesFrom(id)) {
		if(DfEdge.includesType(e, handedBack)) {
			hasReturnEdge = true;
			next(target, nextViaAccess, returnedTo === call ? scopedTo(graph, scopes, call, target) : returnedTo);
		} else if(!isSkipType && !hasReturnEdge && DfEdge.includesType(e, ValueFlowBits) && DfEdge.doesNotIncludeType(e, EdgeType.SideEffectOnCall)) {
			(followTargets ??= []).push([target, DfEdge.includesType(e, EdgeType.DefinedByOnCall)]);
		}
	}
	if(!hasReturnEdge && followTargets) {
		/* a parameter the call binds holds only what that call passes, the walk then goes on in the caller */
		const passed = call === undefined ? undefined : new Set(Dataflow.targetsOf(graph, call, EdgeType.Argument));
		const bound = followTargets.some(([target, onCall]) => onCall && passed?.has(target));
		for(const [target, onCall] of followTargets) {
			if(!bound || !onCall || passed?.has(target)) {
				next(target, nextViaAccess, onCall ? undefined : scopedTo(graph, scopes, call, target));
			}
		}
	}
	return undefined;
}

/**
 * A string where a function is wanted names the function (`match.fun`, `do.call` and the apply family look it up),
 * which is resolved where the string is written, by the environment of the call it is passed to.
 */
function functionsNamedBy(graph: DataflowGraph, id: NodeId): NodeId[] {
	const idMap = graph.idMap;
	const node = idMap?.get(id);
	if(idMap === undefined || !RString.is(node)) {
		return [];
	}
	for(let at = RNode.directParent(node, idMap); at !== undefined; at = RNode.directParent(at, idMap)) {
		const call = graph.getVertex(at.info.id);
		if(DfgVertex.isFunctionCall(call) && call.environment !== undefined) {
			return Resolve.byNameAndType(node.content.str, call.environment, ReferenceType.Function)?.map(d => d.nodeId) ?? [];
		}
	}
	return [];
}

/** The function definitions each call (of the walk) runs, whose parameters it binds. */
type CallScopes = Map<NodeId, ReadonlySet<NodeId>>;

/**
 * The call that restricts what `target` may hold: a call binds only the parameters of the functions it runs, so once
 * the walk leaves their bodies (to a global, say), the call restricts nothing any more.
 */
function scopedTo(graph: DataflowGraph, scopes: CallScopes, call: NodeId | undefined, target: NodeId): NodeId | undefined {
	const idMap = graph.idMap;
	if(call === undefined || idMap === undefined) {
		return call;
	}
	let bodies = scopes.get(call);
	if(bodies === undefined) {
		bodies = new Set(Dataflow.targetsOf(graph, call, EdgeType.Calls | EdgeType.Returns).map(t => RNode.findEnclosing(t, idMap, RFunctionDefinition.is)).filter(isNotUndefined));
		scopes.set(call, bodies);
	}
	for(let node = idMap.get(target); node !== undefined; node = RNode.directParent(node, idMap)) {
		if(bodies.has(node.info.id)) {
			return call;
		}
	}
	return undefined;
}

/** What a state of {@link LinkedFunctionResolver} reaches, the ids of function definitions and built-ins. */
type Reached = ReadonlySet<NodeId>;
const ReachesNothing: Reached = new Set();

/**
 * Finds the function definitions and built-ins that reads may evaluate to (see {@link getAllLinkedFunctionDefinitions}).
 * It remembers what each state of the walk reaches, so the walks of many calls over the same, unchanged graph (those of
 * {@link CallGraph.compute}) share their work instead of walking the same bodies once per call.
 *
 * A state is a vertex, whether an access led to it, and the call whose return led into its body, as a parameter that
 * call binds holds only what the call passes. All states of a strongly connected component reach the same.
 *
 * Keep in mind that a resolver is only valid for the graph state it was created for (it caches what it found, and
 * adding edges afterwards makes its answers stale), that it trades memory for time (one entry per state it walked),
 * and that it is not needed for a single call, where {@link Dataflow.callTargetsOf} does without. Drop it once you are done.
 * @example
 * ```ts
 * const resolver = new LinkedFunctionResolver(graph);
 * const [definitions, builtIns] = resolver.resolve(new Set([readId]));
 * ```
 */
export class LinkedFunctionResolver {
	private readonly graph:     DataflowGraph;
	/** the number of each state, by whether an access led to it, its vertex, and its call */
	private readonly numbers:   readonly [Map<NodeId, Map<NodeId | undefined, number>>, Map<NodeId, Map<NodeId | undefined, number>>] = [new Map(), new Map()];
	private readonly states:    [id: NodeId, viaAccess: boolean, call: NodeId | undefined][] = [];
	/** the built-ins and function definitions the walk ends at, by their state */
	private readonly ends =     new Map<number, Reached>();
	private readonly scopes:    CallScopes = new Map();
	private readonly summaries: ReachSummaries<number, Reached>;

	constructor(graph: DataflowGraph) {
		this.graph = graph;
		this.summaries = new ReachSummaries(state => this.expand(state), state => this.ends.get(state), ReachesNothing, unionOfSets);
	}

	/**
	 * The function definitions and built-ins the reads with the given ids may evaluate to.
	 * Reads that lead to no function contribute nothing, and the result may hold the same definition for several reads.
	 */
	public resolve(reads: ReadonlySet<NodeId>): [Set<Required<DataflowGraphVertexFunctionDefinition>>, Set<BuiltIn>] {
		const definitions = new Set<Required<DataflowGraphVertexFunctionDefinition>>();
		const builtIns = new Set<BuiltIn>();
		for(const read of reads) {
			for(const id of this.summaries.of(this.state(read, false, undefined))) {
				if(NodeId.isBuiltIn(id)) {
					builtIns.add(id);
				} else {
					definitions.add(this.graph.getVertex(id) as Required<DataflowGraphVertexFunctionDefinition>);
				}
			}
		}
		return [definitions, builtIns];
	}

	private state(id: NodeId, viaAccess: boolean, call: NodeId | undefined): number {
		const byCall = this.numbers[viaAccess ? 1 : 0].get(id) ?? new Map<NodeId | undefined, number>();
		let state = byCall.get(call);
		if(state === undefined) {
			state = this.states.push([id, viaAccess, call]) - 1;
			if(byCall.size === 0) {
				this.numbers[viaAccess ? 1 : 0].set(id, byCall);
			}
			byCall.set(call, state);
		}
		return state;
	}

	/** The states the walk goes on to from `state`, none for a built-in or function definition it ends at. */
	private expand(state: number): readonly number[] {
		const [id, viaAccess, call] = this.states[state];
		const successors: number[] = [];
		const end = walkLinkedDefinitions(this.graph, id, viaAccess, call, this.scopes, (target, nextViaAccess, nextCall) => {
			successors.push(this.state(target, nextViaAccess, nextCall));
		});
		if(end !== undefined) {
			this.ends.set(state, new Set([end]));
		}
		return successors;
	}
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
		const probableTarget = bodyInput.name ? Resolve.byNameAndType(bodyInput.name, scopeOf(bodyInput, environmentInformation), bodyInput.type) : undefined;
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
		/* the state of the session (options, files, the working directory) may change before the next time the code runs, so it stays open */
		if(probableTarget.every(t => isReferenceType(t.type, ReferenceType.BuiltInConstant | ReferenceType.BuiltInFunction)) || AmbientStateName.is(bodyInput.name)) {
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

function addControlDependency(holder: { cds?: readonly ControlDependency[] | undefined }, cd: ControlDependency): boolean {
	if(holder.cds?.some(c => c.id === cd.id)) {
		return false;
	}
	holder.cds = [...holder.cds ?? [], cd];
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

/**
 * Links the access at `accessId` to the `fieldDefs` it reaches; a function held in a field is what the access returns,
 * and so may be a field of unknown kind, like the `read.csv` of `assign("f", read.csv, envir = e)`.
 */
export function linkFieldReads(graph: DataflowGraph, accessId: NodeId, fieldDefs: readonly IdentifierDefinition[] | undefined, returnsFunctions: boolean): void {
	for(const fd of fieldDefs ?? []) {
		graph.addEdge(accessId, fd.nodeId, EdgeType.Reads);
		if(fd.definedAt !== undefined && fd.definedAt !== fd.nodeId) {
			graph.addEdge(accessId, fd.definedAt, EdgeType.Reads);
		}
		if(returnsFunctions && (fd.type & (ReferenceType.Function | ReferenceType.Unknown)) !== 0) {
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
			locals.add(NodeId.recoverBareName(node, idMap) ?? '');
		}
	}
	for(const param of Object.keys(factory.params)) {
		locals.add(NodeId.recoverBareName(NodeId.normalize(param), idMap) ?? '');
	}
	return { factory: factory.id, locals };
}

/** The factory calls whose closure `call` may run, `undefined` if it may run one created any other way. */
function instancesOf(call: NodeId, closure: NodeId, factory: NodeId, graph: DataflowGraph): readonly NodeId[] | undefined {
	if(!Dataflow.hasEdge(graph, call, closure, EdgeType.Calls)) {
		return undefined;
	}
	const instances = ClosureFrames.instancesOf(graph, call);
	return instances?.every(created => {
		const callees = Dataflow.targetsOf(graph, created, EdgeType.Calls);
		return callees.length === 1 && callees[0] === factory;
	}) ? instances : undefined;
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
		const calls = new Map<NodeId, readonly NodeId[] | undefined>();
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
