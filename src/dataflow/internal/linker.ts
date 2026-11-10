import type { ParameterOfArgument } from '../graph/match-args';
import { RArgument } from '../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import { uniqueArrayMerge } from '../../util/collections/arrays';
import { DefaultMap } from '../../util/collections/defaultmap';
import { RFunctionCall } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { FunctionSemantics } from '../fn/function-semantics';
import { RLoopConstructs, RNode } from '../../r-bridge/lang-4.x/ast/model/model';
import { isNotUndefined } from '../../util/assert';
import { expensiveTrace } from '../../util/log';
import type { BuiltIn } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { type BrandedIdentifier, type InGraphIdentifierDefinition, hasEnvState, Identifier, type IdentifierDefinition, type IdentifierReference, isReferenceType, ReferenceType } from '../environments/identifier';
import type { DataflowFunctionFlowInformation, DataflowGraph } from '../graph/graph';
import type { AstIdMap, ParentInformation } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { dataflowLogger } from '../logger';
import { ControlFlowEdgeTypes, DfEdge, EdgeType } from '../graph/edge';
import { type DataflowGraphVertexFunctionCall, type DataflowGraphVertexFunctionDefinition, type DataflowGraphVertexInfo, type DeferredEnvOp, EnvOpKind, VertexType, FunctionDispatch } from '../graph/vertex';
import { type Environment, REnvironment, type REnvironmentInformation } from '../environments/environment';
import type { ExitPoint } from '../info';
import { ControlDependency, negateControlDependency, doesExitPointPropagateCalls } from '../info';
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
import { RExpressionList } from '../../r-bridge/lang-4.x/ast/model/nodes/r-expression-list';
import { RIfThenElse } from '../../r-bridge/lang-4.x/ast/model/nodes/r-if-then-else';
import { RWhileLoop } from '../../r-bridge/lang-4.x/ast/model/nodes/r-while-loop';
import { RForLoop } from '../../r-bridge/lang-4.x/ast/model/nodes/r-for-loop';
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

/** Find all reads within the graph that do not reference a local definition in the graph. */
export function findNonLocalReads(graph: DataflowGraph, ignores: ReadonlySet<NodeId> = new Set()): IdentifierReference[] {
	const defs = new Set<NodeId>();
	for(const tag of [VertexType.VariableDefinition, VertexType.FunctionDefinition]) {
		for(const [id] of graph.verticesOfType(tag)) {
			defs.add(id);
		}
	}
	const nonLocalReads: IdentifierReference[] = [];
	/* the tag already says what the reference is, so no vertex has to be fetched to decide; the target of a replacement (`x$a <- v`) reads the binding it replaces as well */
	for(const [tag, type] of [[VertexType.Use, ReferenceType.Variable], [VertexType.FunctionCall, ReferenceType.Function], [VertexType.VariableDefinition, ReferenceType.Unknown]] as const) {
		for(const [nodeId, vertex] of graph.verticesOfType(tag)) {
			if(ignores.has(nodeId) || (DfgVertex.isVariableDefinition(vertex) && !vertex.par)) {
				continue;
			}
			/* control flow edges say nothing about what a name resolves to, so they do not count as a link */
			let linked = false;
			let nonLocal = false;
			for(const [target, e] of graph.edgesFrom(nodeId)) {
				/* a replacement target is defined by its call, it reads only the binding it replaces */
				if(DfEdge.isOnlyControlFlow(e) || (tag === VertexType.VariableDefinition && DfEdge.includesType(e, EdgeType.DefinedBy))) {
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

/** Produces a map from names to all identifier references sharing that name. */
export function produceNameSharedIdMap(references: IdentifierReference[]): NameIdMap {
	const nameIdShares = new DefaultMap<Identifier, IdentifierReference[]>(() => []);
	for(const reference of references) {
		if(reference.name) {
			nameIdShares.get(reference.name).push(reference);
		}
	}
	return nameIdShares;
}

/** how many vertices the walk for the holders of an instance visits before it settles for what it found */
const MaxInstanceFlow = 64;

/** The definitions holding the instance a method call `receiver$m(...)` runs a method on: every variable the value of the receiver flows through (aliases, the parameters it is bound to, what called functions return) and the containers it is a field of, as the environment of the call knows them, with the tracked state they carry. */
function instanceHolders(receiver: NodeId, graph: DataflowGraph, environment: REnvironmentInformation, idMap: AstIdMap): IdentifierDefinition[] {
	const holders: IdentifierDefinition[] = [];
	const seen = new Set<NodeId>();
	const todo = [receiver];
	for(let id = todo.pop(); id !== undefined && seen.size < MaxInstanceFlow; id = todo.pop()) {
		if(seen.has(id)) {
			continue;
		}
		seen.add(id);
		const node = idMap.get(id);
		if(RArgument.is(node)) {
			todo.push(...node.value ? [node.value.info.id] : []);
			continue;
		}
		const vertex = graph.getVertex(id);
		if(DfgVertex.isUse(vertex)) {
			/* a `self` a method hands back is bound on the call to the instance */
			todo.push(...Dataflow.targetsOf(graph, id, EdgeType.Reads | EdgeType.DefinedByOnCall).filter(t => !NodeId.isBuiltIn(t)));
		} else if(DfgVertex.isFunctionCall(vertex)) {
			/* an access hands back a field of what it accesses, a function what it returns */
			todo.push(...Dataflow.targetsOf(graph, id, EdgeType.Returns));
		} else if(DfgVertex.isVariableDefinition(vertex)) {
			const name = NodeId.recoverName(id, idMap);
			const known = name === undefined ? undefined : Resolve.byNameAndType(name, environment, ReferenceType.Variable)?.find(d => d.nodeId === id);
			holders.push(known ?? { nodeId: id, name, type: ReferenceType.Variable, definedAt: id, cds: undefined });
			const value = Dataflow.assignedValueOf(id, graph);
			todo.push(...value === undefined ? Dataflow.targetsOf(graph, id, EdgeType.DefinedByOnCall) : [value]);
		}
	}
	return holders;
}

/** Links the reads of the names a method sees its instance by (`self`, `private`, `.self`) to the definitions holding the instance the call runs the method on. */
export function linkInstanceReads(graph: DataflowGraph, info: DataflowGraphVertexFunctionCall, fn: Pick<DataflowGraphVertexFunctionDefinition, 'id' | 'subflow'>, environment: REnvironmentInformation, idMap: AstIdMap): void {
	const bindings = fn.subflow.in.length === 0 ? undefined : instanceBindingsOfMethod(fn.id, graph, idMap);
	const reads = bindings === undefined ? [] : fn.subflow.in.filter(r => r.name !== undefined && bindings.includes(Identifier.getName(r.name)));
	if(reads.length === 0) {
		return;
	}
	const call = idMap.get(info.id);
	/* a method taken out of its instance first, `f <- o$m; f()`, still runs on that instance */
	const accesses = RFunctionCall.isUnnamed(call) ? [call.calledFunction] : Dataflow.targetsOf(graph, info.id, EdgeType.Reads).map(d => idMap.get(Dataflow.assignedValueOf(d, graph) ?? d));
	const holders = accesses.flatMap(a => RAccess.is(a) ? instanceHolders(a.accessed.info.id, graph, environment, idMap) : []);
	for(const read of reads) {
		for(const holder of holders as readonly InGraphIdentifierDefinition[]) {
			if(fn.subflow.graph.has(holder.nodeId) || NodeId.isBuiltIn(holder.nodeId)) {
				continue;
			}
			graph.addEdge(read.nodeId, holder.nodeId, EdgeType.DefinedByOnCall);
			graph.addEdge(info.id, holder.nodeId, EdgeType.DefinesOnCall);
			linkFieldWritesOnCall(graph, info.id, fn.id, read.nodeId, holder.nodeId, holder.envState, idMap);
			readEnvironmentContents(graph, info.id, holder);
		}
	}
}

/** The function definition directly within `fn` that holds `id`, `undefined` if `id` is in the body of `fn` itself. */
function outermostClosureOf(id: NodeId, fn: NodeId, idMap: AstIdMap): NodeId | undefined {
	let closure: NodeId | undefined;
	for(const parent of RNode.iterateParents(idMap.get(id), idMap)) {
		if(parent.info.id === fn) {
			return closure;
		} else if(RFunctionDefinition.is(parent)) {
			closure = parent.info.id;
		}
	}
	return undefined;
}

/** Which free reads of the function `fn` are in a closure it makes without calling it: such a closure reads its free variables where it is called, which links them there (or, if nothing calls it, at the end of its scope), so a call of `fn` does not read them. */
export function readsOfUncalledClosures(fn: NodeId, subflow: DataflowFunctionFlowInformation, graph: DataflowGraph, idMap: AstIdMap): (read: NodeId) => boolean {
	let called: Set<NodeId> | undefined;
	return read => {
		const closure = subflow.graph.has(read) ? undefined : outermostClosureOf(read, fn, idMap);
		if(closure === undefined) {
			return false;
		}
		if(called === undefined) {
			called = new Set();
			for(const node of subflow.graph) {
				if(DfgVertex.isFunctionCall(graph.getVertex(node))) {
					Dataflow.targetsOf(graph, node, EdgeType.Calls).forEach(t => called?.add(t));
				}
			}
		}
		return !called.has(closure);
	};
}

/** Links the free variables of the function `fnId` the call `info` runs to their definitions where the function was defined, as the environment of the call sees them. */
function linkFreeReads(graph: DataflowGraph, fnSubflow: DataflowGraphVertexFunctionDefinition['subflow'], fnId: NodeId, info: DataflowGraphVertexFunctionCall, idMap: AstIdMap): void {
	const id = info.id;
	const environment = info.environment;
	if(environment !== undefined) {
		let callee: readonly REnvironmentInformation[] | undefined;
		let lexical: REnvironmentInformation | undefined;
		const instance = fnSubflow.in.length === 0 ? undefined : instanceBindingsOfMethod(fnId, graph, idMap);
		const readWhereCalled = readsOfUncalledClosures(fnId, fnSubflow, graph, idMap);
		/* for each open ingoing reference, try to resolve it here, and if so, add a read edge from the call to signal that it reads it */
		for(const ingoing of fnSubflow.in) {
			const name = ingoing.name;
			if(name === undefined || instance?.includes(Identifier.getName(name)) || readWhereCalled(ingoing.nodeId)) {
				continue;
			}
			/* a variable is looked up where the function was defined, global state (options, files, the working directory) is what it is where it is called */
			const inCallee = AmbientStateName.is(name) ? undefined : (callee ??= (info.name === undefined ? [] : Resolve.byName(info.name, environment) ?? []).filter(hasEnvState).map(d => d.envState)).values().map(env => Resolve.byNameAndType(name, env, ingoing.type)).find(isNotUndefined);
			let defs = inCallee ?? Resolve.byNameAndType(name, AmbientStateName.is(name) ? environment : lexical ??= REnvironment.visibleTo(fnSubflow.environment.level, environment), ingoing.type) ?? [];
			/* R looks the methods of a dispatch up where the generic is called first */
			if(ingoing.type === ReferenceType.S3MethodPrefix && inCallee === undefined) {
				defs = uniqueArrayMerge(defs, Resolve.byNameAndType(name, environment, ingoing.type) ?? []);
			}
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
						if(DfgVertex.isFunctionDefinition(vInfo) && !vInfo.mode?.includes(FunctionDispatch.S7)) {
							(vInfo.mode ??= []).push(FunctionDispatch.S7);
						}
					}
				}
			}
		}
	}
}

/** Links a function call with a single target function definition. */
export function linkFunctionCallWithSingleTarget(graph: DataflowGraph, { subflow: fnSubflow, exitPoints, id: fnId, params, envOps }: DataflowGraphVertexFunctionDefinition, info: DataflowGraphVertexFunctionCall, idMap: AstIdMap): ExitPoint[] {
	const id = info.id;
	const environment = info.environment;
	linkFreeReads(graph, fnSubflow, fnId, info, idMap);

	if(environment !== undefined) {
		linkInstanceReads(graph, info, { subflow: fnSubflow, id: fnId }, environment, idMap);
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
		const argToParam = FunctionSemantics.call.match.onCallAndLink(info.args, fn.parameters, graph);
		applyForForcedArgs(graph, id, params, argToParam);
		if(environment !== undefined) {
			readArgumentContents(graph, info.id, environment, argToParam, envOps, idMap);
		}
	}
	return exitPoints.filter(e => doesExitPointPropagateCalls(e.type));
}

/** A call reads everything written into an environment it hands to a parameter (see {@link readEnvironmentContents}), unless the body only writes into what the parameter holds, by writes each call replays (see {@link DeferredEnvOp}): `register <- function(env, f) env$h <- f` reads nothing of `env`, so one call does not read what another stored. */
function readArgumentContents(graph: DataflowGraph, call: NodeId, environment: REnvironmentInformation, argToParam: ParameterOfArgument, envOps: readonly DeferredEnvOp[] | undefined, idMap: AstIdMap): void {
	const written = new Set(envOps?.filter(o => o.kind === EnvOpKind.Define || o.kind === EnvOpKind.Replace).map(o => o.envir));
	for(const [arg, param] of argToParam) {
		const value = RArgument.valueOf(idMap.get(arg)) ?? idMap.get(arg);
		if(!RSymbol.is(value) || Dataflow.sourcesOf(graph, param, EdgeType.Reads).every(r => written.has(r))) {
			continue;
		}
		for(const holder of Resolve.byName(value.content, environment) ?? []) {
			readEnvironmentContents(graph, call, holder);
		}
	}
}

/** for each parameter that we link that gets forced, add a reads edge from the call to argument to show that it reads it */
function applyForForcedArgs(graph: DataflowGraph, callId: NodeId, readParams: Record<NodeId, boolean>, argToParam: ParameterOfArgument): void {
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
function linkFieldWritesOnCall(graph: DataflowGraph, id: NodeId, fnId: NodeId, start: NodeId, binding: NodeId, envState: REnvironmentInformation | undefined, idMap: AstIdMap): void {
	const aliases = new Set<NodeId>([start]);
	for(const alias of aliases) {
		for(const from of Dataflow.sourcesOf(graph, alias, ValueFlowBits)) {
			aliases.add(from);
		}
	}
	for(const read of aliases) {
		if(envState !== undefined) {
			bindAccessedField(graph, read, envState, idMap, id);
		}
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

/** Whether an error raised by the call `from` still leaves the expression it is written in: redoes what a `stop` written at that spot would have done, since we only learn a callee always throws after linking it here. */
export function errorEscapes(from: NodeId, expression: NodeId, idMap: AstIdMap, graph: DataflowGraph): boolean {
	for(let node = idMap.get(from); node !== undefined && node.info.id !== expression;) {
		const parent = RNode.directParent(node, idMap);
		if(parent === undefined) {
			return true;
		}
		if(!errorPassesThrough(parent, node.info.id, graph)) {
			return false;
		}
		node = parent;
	}
	return true;
}

/** Whether an error raised within the child `child` of `parent` is sure to be raised by `parent` as well. */
function errorPassesThrough(parent: RNode<ParentInformation>, child: NodeId, graph: DataflowGraph): boolean {
	if(RArgument.is(parent) || RExpressionList.is(parent)) {
		return true;
	} else if(RFunctionCall.is(parent)) {
		/* a handler catches the error instead of passing it on */
		return !DfgVertex.hasOrigin(graph.getVertex(parent.info.id), BuiltInProcName.Try);
	} else if(RIfThenElse.is(parent) || RWhileLoop.is(parent)) {
		/* only the condition is guaranteed to be evaluated */
		return parent.condition.info.id === child;
	} else if(RForLoop.is(parent)) {
		return parent.vector.info.id === child;
	}
	return false;
}

/** What {@link linkFunctionCalls} reports for a call it linked. */
export type CalledFunctions = {
	functionCall:        NodeId,
	called:              readonly DataflowGraphVertexInfo[],
	propagateExitPoints: readonly ExitPoint[],
	calledBuiltIns?:     readonly NodeId[],
	/** the call runs one of `called`, as a dispatch picks one method, so each only may write what it writes */
	alternatives?:       boolean
};

/** Whether the call `info` may get its function from `target`, which it has the edge `e` to. */
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

/** Whether `target` lies within an argument of `call`, which the call reads when it forces that argument, not to find its function. */
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
			const exits = linkFunctionCallWithSingleTarget(graph, def, info, idMap);
			if(exits.length > 0 && escapesAnonymousFunction(graph, id, def.id, idMap)) {
				propagateExitPoints.push(...exits);
			}
		}
	}
	if(!isRoot || (functionDefs.size === 0 && builtIns.size === 0)) {
		return undefined;
	}
	/* a built-in reached through a variable (`p <- par; p(...)`) was not processed as that built-in */
	const calledBuiltIns = builtIns.size > 0 ? [...builtIns] : undefined;
	return { functionCall: id, called: [...functionDefs], propagateExitPoints, calledBuiltIns };
}

/** An anonymous function the call `id` runs calls the free function `fnId` it reads: whether what `fnId` raises leaves the anonymous function, which a handler around the call within it prevents. */
function escapesAnonymousFunction(graph: DataflowGraph, id: NodeId, fnId: NodeId, idMap: AstIdMap): boolean {
	const anonymous = NodeId.isAnonymousCall(id) ? NodeId.nodeOf(id, idMap) : undefined;
	if(!RFunctionDefinition.is(anonymous) || anonymous.info.id === fnId) {
		return true;
	}
	const within = Dataflow.sourcesOf(graph, fnId, EdgeType.Calls).filter(c => RNode.findEnclosing(c, idMap, RFunctionDefinition.is) === anonymous.info.id);
	return within.length === 0 || within.some(c => errorEscapes(c, anonymous.body.info.id, idMap, graph));
}

/** Returns the called functions within `graph` (ideally a superset of `thisGraph`, the graph searched for calls), which can be used to merge the environments with the call; also links the corresponding arguments. */
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
 * convenience function returning all known call targets, as well as the name source which defines them Over-approximates for calls through reads and aliases (all functions the read may evaluate to are returned).
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
	const shared = resolver ?? graph.sharedTargetWalks(g => new LinkedFunctionResolver(g));
	const [targets, builtIns] = shared?.resolve(reads) ?? getAllLinkedFunctionDefinitions(reads, graph);
	const all = new Set([...targets.values().map(t => t.id), ...builtIns, ...functionCallDefs]);
	/* the methods its dispatch rules out are still found by the name */
	info.ruledOut?.forEach(e => all.delete(e));
	return [...all];
}

/** Finds all linked function definitions starting from the given read ids; expects the caller to already have resolved the accessed objects (first layer of reads/returns/calls/...). */
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

	for(let item = potential.pop(); item !== undefined; item = potential.pop()) {
		const [cid, viaAccess, call] = item;
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

/** One step of the walk for the function definitions that reads may evaluate to: hands each state the walk goes on to from `id` to `next`, or returns `id` if the walk ends at it, being a built-in or a function definition. */
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
	const isSkipType = DfgVertex.isFunctionCall(vertex);
	/* a replacement keeps its target what it was (`environment(f) <- e` leaves `f` the same function), unless the call is to what it put into a part of it, so the walk goes on to the binding it replaces only */
	const replaces = DfgVertex.isVariableDefinition(vertex) && vertex.par && !nextViaAccess;
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
		} else if(!isSkipType && !hasReturnEdge && DfEdge.includesType(e, ValueFlowBits) && DfEdge.doesNotIncludeType(e, replaces ? EdgeType.SideEffectOnCall | EdgeType.DefinedBy : EdgeType.SideEffectOnCall)) {
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

/** A string where a function is wanted names the function (`match.fun`, `do.call` and the apply family look it up), which is resolved where the string is written, by the environment of the call it is passed to. */
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

/** The call that restricts what `target` may hold: a call binds only the parameters of the functions it runs, so once the walk leaves their bodies (to a global, say), the call restricts nothing any more. */
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

/** Finds the function definitions and built-ins that reads may evaluate to (see {@link getAllLinkedFunctionDefinitions}). */
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
		this.summaries = new ReachSummaries(state => this.expand(state), state => this.ends.get(state), { empty: ReachesNothing, concat: unionOfSets });
	}

	/** The function definitions and built-ins the reads with the given ids may evaluate to. */
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
 * Links every name in the expression rooted at `expr` against `environment`, as if it were written there, and hands back what stays unresolved.
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
		linkCallToDefinitions(graph, call.nodeId, Resolve.byNameAndType(call.name, environment, ReferenceType.Function)?.map(d => d.nodeId) ?? [], idMap);
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

/** Links a set of read variables to definitions in `environmentInformation`; each reference that cannot be linked (or links to built-ins only) is added to `givenInputs` (marked maybe if `maybeForRemaining`), and the extended list is returned. */
export function linkInputs(referencesToLinkAgainstEnvironment: readonly IdentifierReference[], environmentInformation: REnvironmentInformation, givenInputs: IdentifierReference[], graph: DataflowGraph, maybeForRemaining: boolean, alsoFrom?: NodeId): IdentifierReference[] {
	for(const bodyInput of referencesToLinkAgainstEnvironment) {
		const probableTarget = bodyInput.name ? Resolve.byNameAndType(Identifier.boundAs(bodyInput.name), scopeOf(bodyInput, environmentInformation), bodyInput.type) : undefined;
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

/** A loop variable read before its within-loop redefinition gets a maybe marker to that def (e.g. `x_2` may read the prior iteration's `x_1` in `for(...) { x_1 <- x_2 + 1 }`); with `environment`, this uses all defs live at loop exit, which the calls in the loop see as well (see {@link linkLoopCarriedCalls}). */
export function linkCircularRedefinitionsWithinALoop(graph: DataflowGraph, openIns: NameIdMap, outgoing: readonly IdentifierReference[], environment?: REnvironmentInformation): void {
	if(environment !== undefined) {
		const outgoingIds = new Set(outgoing.map(o => o.nodeId));
		for(const [name, targets] of openIns.entries()) {
			for(const def of environment.current.memory.get(Identifier.getName(name)) ?? []) {
				/* a definition within an argument of a call (`f(x <- x + 1)`) is made in the loop as well, if it is made at all */
				if(outgoingIds.has(def.nodeId) || DfgVertex.isVariableDefinition(graph.getVertex(def.nodeId))) {
					for(const target of targets) {
						graph.addEdge(target.nodeId, def.nodeId, EdgeType.Reads);
					}
				}
			}
		}
		linkLoopCarriedCalls(graph, environment, outgoingIds, new Set(outgoing.map(o => Identifier.getName(o.name))));
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

/** A call in a loop runs again after the rest of the body ran, so it sees what the body leaves behind as well (`environment`), and so do the free variables of the closures it calls: in `f <- function() x; for(i in 1:2) { y <- f(); x <- 2 }` the second call of `f` reads `x <- 2`. */
function linkLoopCarriedCalls(graph: DataflowGraph, environment: REnvironmentInformation, made: ReadonlySet<NodeId>, names: ReadonlySet<BrandedIdentifier | undefined>): void {
	const idMap = graph.idMap;
	for(const [id, info] of graph.verticesOfType(VertexType.FunctionCall)) {
		if(info.onlyBuiltin || info.environment?.level !== environment.level) {
			continue;
		}
		info.environment = REnvironment.append(info.environment, idMap === undefined ? environment : carriedTo(graph, info, info.environment, environment, made, names, idMap));
		for(const target of idMap === undefined ? [] : Dataflow.targetsOf(graph, id, EdgeType.Calls)) {
			const fn = graph.getVertex(target);
			if(DfgVertex.isFunctionDefinition(fn)) {
				linkFreeReads(graph, fn.subflow, target, info, idMap as AstIdMap);
			}
		}
	}
}

/** What `exit` carries into the next run for the call `info`, without the `names` the body (`made`) surely binds anew before the call: a binding the call sees that the body makes in an earlier statement, under no condition the call is not under as well. */
function carriedTo(graph: DataflowGraph, info: DataflowGraphVertexFunctionCall, atCall: REnvironmentInformation, exit: REnvironmentInformation, made: ReadonlySet<NodeId>, names: ReadonlySet<BrandedIdentifier | undefined>, idMap: AstIdMap): REnvironmentInformation {
	let carried: Environment | undefined;
	const call = idMap.get(info.id);
	for(const name of names) {
		const defs = name === undefined || exit.current.memory.get(name) === undefined ? undefined : atCall.current.memory.get(name);
		if(defs?.some(d => made.has(d.nodeId) && ControlDependency.minus(graph.getVertex(d.nodeId)?.cds ?? [], info.cds ?? []).length === 0 && RNode.precedesInBlock(idMap.get(d.nodeId), call, idMap))) {
			carried ??= exit.current.clone(false);
			carried.writableMemory.delete(name as BrandedIdentifier);
		}
	}
	return carried === undefined ? exit : { current: carried, level: exit.level };
}

/** A call in a loop runs again, so what its callee writes reaches the reads of the loop before the call as well: in `ch <- function() g <<- 2; for(i in 1:2) { s <- g; ch() }` the second `s <- g` reads `g <<- 2`. */
export function linkWritesCarriedByLoop(graph: DataflowGraph, call: NodeId, written: readonly IdentifierDefinition[], idMap: AstIdMap): void {
	let loop: RNode<ParentInformation> | undefined;
	for(let node = idMap.get(call); node !== undefined && !RFunctionDefinition.is(node); node = RNode.directParent(node, idMap)) {
		if(RLoopConstructs.is(node)) {
			loop = node;
		}
	}
	if(loop === undefined || written.length === 0) {
		return;
	}
	const byName = new Map<BrandedIdentifier, IdentifierDefinition[]>();
	for(const def of written) {
		if(def.name !== undefined) {
			const name = Identifier.getName(def.name);
			byName.set(name, [...byName.get(name) ?? [], def]);
		}
	}
	const writtenAs = (name: Identifier | undefined) => name === undefined ? undefined : byName.get(Identifier.getName(name));
	for(const id of RNode.collectAllIdsWithStop(loop, RFunctionDefinition.is)) {
		const vertex = graph.getVertex(id);
		if(!DfgVertex.isUse(vertex) && !DfgVertex.isFunctionCall(vertex)) {
			continue;
		}
		for(const def of writtenAs(DfgVertex.isFunctionCall(vertex) ? vertex.name : NodeId.recoverBareName(id, idMap)) ?? []) {
			graph.addEdge(id, def.nodeId, EdgeType.Reads);
			if(DfgVertex.isFunctionCall(vertex)) {
				getAllLinkedFunctionDefinitions(new Set([def.nodeId]), graph)[0].forEach(fn => graph.addEdge(id, fn.id, EdgeType.Calls));
			}
		}
		for(const target of DfgVertex.isFunctionCall(vertex) ? Dataflow.targetsOf(graph, id, EdgeType.Calls) : []) {
			const fn = graph.getVertex(target);
			for(const ingoing of DfgVertex.isFunctionDefinition(fn) ? fn.subflow.in : []) {
				for(const def of writtenAs(ingoing.name) ?? []) {
					graph.addEdge(ingoing.nodeId, def.nodeId, EdgeType.DefinedByOnCall);
					graph.addEdge(id, def.nodeId, EdgeType.DefinesOnCall);
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

/** Reapplies the loop exit points' control dependencies to the given identifier references. */
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
	/** Resolves the open ingoing references of a definition called anonymously at `callId` against `environment`, links what resolves, and leaves only the references that stay open. */
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

/** Adds the definitions `found` to what the lookup `lookup` finds where it is written, or when `call` runs it, see {@link DataflowGraphVertexFunctionCall#found} and {@link DataflowGraphVertexFunctionCall#foundOnCall}. */
export function recordFound(graph: DataflowGraph, lookup: NodeId, found: readonly NodeId[], call?: NodeId): void {
	const vertex = graph.getVertex(lookup);
	if(found.length === 0 || !DfgVertex.isFunctionCall(vertex)) {
		return;
	} else if(call === undefined) {
		vertex.found = vertex.found === undefined ? found : uniqueArrayMerge(vertex.found, found);
		return;
	}
	const known = vertex.foundOnCall?.find(f => f.call === call);
	const entry = { call, found: known === undefined ? found : uniqueArrayMerge(known.found, found) };
	vertex.foundOnCall = [...vertex.foundOnCall?.filter(f => f !== known) ?? [], entry];
}

/** Links the access at `accessId` to the `fieldDefs` it reaches; a function held in a field is what the access returns, and so may be a field of unknown kind, like the `read.csv` of `assign("f", read.csv, envir = e)`. */
export function linkFieldReads(graph: DataflowGraph, accessId: NodeId, fieldDefs: readonly IdentifierDefinition[] | undefined, returnsFunctions: boolean, call?: NodeId): void {
	recordFound(graph, accessId, fieldDefs?.map(d => d.nodeId).filter(d => !NodeId.isBuiltIn(d)) ?? [], call);
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

const AssignFormals: readonly BrandedIdentifier[] = ['x', 'value', 'pos', 'envir', 'inherits', 'immediate'];

/** The call writing a field into the environment the symbol `readId` holds: `x$f <- v` (its replacement call) or `assign("f", v, envir = x)`. */
function fieldAssignmentOf(readId: NodeId, idMap: AstIdMap): NodeId | undefined {
	const read = idMap.get(readId);
	const access = read === undefined ? undefined : RNode.directParent(read, idMap);
	/* `assign("f", v, envir = x)` writes into `x` as well */
	const call = access === undefined ? undefined : RNode.directParent(access, idMap);
	if(RFunctionCall.isNamed(call, 'assign')) {
		const bound = FunctionSemantics.call.match.toNames(call.arguments, AssignFormals);
		if(access === bound.get('envir') || access === bound.get('pos')) {
			return call.info.id;
		}
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

/** An access `x$f` written where `x` was still open reads the field of whatever `x` is bound to once that binding is known, so binding the read at `readId` to a definition holding `envState` links the access to that field. */
export function bindAccessedField(graph: DataflowGraph, readId: NodeId, envState: REnvironmentInformation, idMap: AstIdMap, call?: NodeId): void {
	const read = idMap.get(readId);
	const access = read === undefined ? undefined : RNode.directParent(read, idMap);
	if(!RAccess.is(access) || access.accessed.info.id !== readId) {
		return;
	}
	const fieldName = accessedFieldName(RArgument.valueOf(access.access[0]), RAccess.isNamed(access));
	linkFieldReads(graph, access.info.id, fieldName ? envState.current.memory.get(fieldName) : undefined, true, call);
}

/** The factory that creates and returns only `closure`, calling only known built-ins and not reflecting on its frame, with the names its frame binds. */
function factoryOf(closure: DataflowGraphVertexFunctionDefinition, graph: DataflowGraph, known: BuiltInLookup, idMap: AstIdMap): { readonly factory: NodeId, readonly locals: ReadonlySet<BrandedIdentifier> } | undefined {
	const id = RNode.strictlyEnclosingFunction(closure.id, idMap);
	const factory = id === undefined ? undefined : graph.getVertex(id);
	if(!DfgVertex.isFunctionDefinition(factory) || factory.exitPoints.length === 0 || !factory.exitPoints.every(e => e.nodeId === closure.id)
		|| FunctionSemantics.frameReflection(factory, graph, { known }) !== 0) {
		return undefined;
	}
	const locals = new Set<BrandedIdentifier>();
	for(const node of factory.subflow.graph) {
		const vertex = graph.getVertex(node);
		if(node === closure.id || closure.subflow.graph.has(node)) {
			continue;
		} else if(DfgVertex.isFunctionDefinition(vertex) || (DfgVertex.isFunctionCall(vertex) && (!vertex.onlyBuiltin || graph.unknownSideEffects.has(NodeId.normalize(node))))
			|| Dataflow.superAssigns(graph, node)) {
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
		const superAssignments = vertex.subflow.graph.values().filter(id => Dataflow.superAssigns(graph, id)).toArray();
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
