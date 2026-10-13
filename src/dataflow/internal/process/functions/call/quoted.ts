/**
 * `FunctionSemantics.call` is the entry point these members are reached through, and it is built on this file, so the backing
 * functions are called directly here; going through `FunctionSemantics` would make `src/dataflow/fn/function-semantics.ts` import its own
 * importers.
 * @lintIgnore use-instead
 */
import { RNode } from '../../../../../r-bridge/lang-4.x/ast/model/model';
import type { ControlFlowGraph } from '../../../../../control-flow/control-flow-graph';
import { RFunctionCall } from '../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { MatchArgs } from '../../../../graph/match-args';
import type { AstIdMap, ParentInformation } from '../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { NodeId } from '../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { IdentifierReference } from '../../../../environments/identifier';
import { hasEnvState, Identifier, ReferenceType } from '../../../../environments/identifier';
import { Resolve } from '../../../../environments/resolve-helper';
import { ProgramOrder } from '../../../program-order';
import { RSymbol } from '../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import { BuiltInProcName } from '../../../../environments/built-in-proc-name';
import { ControlFlowEdgeTypes, DfEdge, EdgeType } from '../../../../graph/edge';
import { Dataflow } from '../../../../graph/df-helper';
import type { DataflowGraph } from '../../../../graph/graph';
import { FunctionArgument, UnknownSideEffect } from '../../../../graph/graph';
import { type DataflowGraphVertexFunctionCall, DfgVertex, VertexType } from '../../../../graph/vertex';
import { linkExpressionIn, linkInputs } from '../../../linker';
import { type MaskingCall, Nse } from './nse';
import { Deferred, type ForceSites, verticesByName } from './deferred';
import { RArgument } from '../../../../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import { reachableTo } from '../../../../../control-flow/happens-before';
import type { REnvironmentInformation } from '../../../../environments/environment';
import { callFnProps } from '../../../../environments/query-fn-props';
import { CallProp, CallProps, SemanticCallTag } from '../../../../environments/built-in-props';
import { edgeSources, edgeTargets, hasEdgeOfType } from '../../../../fn/frame-reflection';
import { DefaultMap } from '../../../../../util/collections/defaultmap';

type Reach = NonNullable<ForceSites['reach']>;

/** Calls whose result is a language object although they read their arguments like any other call. */
const CapturingCalls: ReadonlySet<string> = new Set(['expression']);
/** Calls capturing an expression as a promise, forced at some later read of the variable they bind. */
const DelayingCalls: ReadonlySet<string> = new Set(['delayedAssign']);
const DelayedAssignFormals = ['x', 'value', 'eval.env', 'assign.env'];
/** Calls evaluating their own unevaluated argument, in a frame of their own. */
const EvaluatingElsewhereCalls: ReadonlySet<string> = new Set(['evalq']);
/**
 * How a value reaches its use: `DefinedByOnCall` is the hop from a parameter to its argument, and an argument
 * counts because a call handing back one of them, a container included, must not hide the capture inside.
 */
const ValueFlow: EdgeType = EdgeType.Reads | EdgeType.DefinedBy | EdgeType.DefinedByOnCall | EdgeType.Returns | EdgeType.Argument;

/**
 * A language object reads nothing where it is written and everything where it reaches `eval`, with the bindings
 * in effect there. Working on the finished graph makes assignments, branches, loops, and calls one traversal.
 * @example
 * ```ts
 * Quoted.capturedBy(graph, id); // the expression a `quote(...)` holds on to
 * Quoted.sourcesOf(graph, id);  // every expression the value at `id` may hold
 * ```
 */
export const Quoted = {
	/** The expressions a capturing call holds on to. */
	capturedBy(this: void, graph: DataflowGraph, id: NodeId): readonly NodeId[] {
		const vertex = graph.getVertex(id);
		if(!DfgVertex.isFunctionCall(vertex)) {
			return [];
		}
		const marked = DfgVertex.hasOrigin(vertex, BuiltInProcName.Quote);
		return marked || CapturingCalls.has(Identifier.getName(vertex.name)) ? capturedArgumentsOf(graph, id, marked) : [];
	},

	/** Every expression the value at `id` may hold, with the call that captured it. Several is normal. */
	sourcesOf(this: void, graph: DataflowGraph, id: NodeId): readonly CapturedExpression[] {
		const found: CapturedExpression[] = [];
		Dataflow.reachable(graph, id, { follow: ValueFlow, stopAt: at => {
			const captured = Quoted.capturedBy(graph, at);
			for(const expr of captured) {
				found.push({ expr, at });
			}
			return captured.length > 0;
		} });
		return found;
	},

	/**
	 * What the node `id` within captured code depends on for running at all: the call capturing the code, and
	 * every call that evaluates it, be it an `eval` or a function whose body it became (`body(f) <- quote(...)`).
	 */
	evaluationDependencies(this: void, graph: DataflowGraph, id: NodeId): NodeId[] {
		const idMap = graph.idMap;
		for(let parent = idMap?.get(id)?.info.parent; parent !== undefined; parent = idMap?.get(parent)?.info.parent) {
			const captured = Quoted.capturedBy(graph, parent);
			if(captured.length > 0) {
				const evaluating = captured.flatMap(expr => edgeSources(graph, expr, EdgeType.Returns | EdgeType.Reads | EdgeType.Calls));
				return [parent, ...evaluating.filter(from => from !== parent)];
			}
		}
		return [];
	},

	/** Links every name in `expr` against `environment` and hands back what stays unresolved. */
	evaluateIn: linkExpressionIn,

	/**
	 * The finishing pass over a complete graph: it settles what a call really evaluates, which the call itself
	 * could not know. A capture reaches the `eval` that forces it, a promise reaches the bindings it may be
	 * forced against, and a masked name the caller binds after all loses its mark.
	 */
	finalize<Info>(this: void, graph: DataflowGraph, environment: REnvironmentInformation, idMap: AstIdMap<Info & ParentInformation>, controlFlow: () => ControlFlowGraph | undefined): void {
		/* lets the forces of a parameter be reused without counting its reads again while nothing touched them (see `forcesOf`) */
		graph.trackIncomingReads(true);
		let names: ReturnType<typeof Deferred.indexOf> | undefined;
		const namesOnce = () => names ??= Deferred.indexOf(graph, idMap);
		let bindings: ReadonlyMap<string, NodeId[]> | undefined;
		let cfg: ControlFlowGraph | undefined | null = null;
		const cfgOnce = () => (cfg === null ? (cfg = controlFlow()) : cfg);
		const masking: MaskingCall[] = [];
		const evaluated: NodeId[] = [];
		let sideEffects: ReadonlySet<NodeId> | undefined;
		let installers: ReadonlySet<NodeId> | undefined;
		const installersOnce = () => installers ??= languageInstallersOf(graph, environment);
		/* every call of a function forces its parameters at the same sites, so this pass works them out once */
		const forcing = new Map<NodeId, { readonly version: number, readonly reads: number, readonly forces: ForceSites | undefined }>();
		/* evaluations within one function and forces of one parameter share their sites, and with them what reaches them */
		const reaches = new DefaultMap<string, Reach>(() => ({}));
		const reachOf = (sites: readonly NodeId[]): Reach => reaches.get(sites.join('\0'));
		let enclosing: ReadonlyMap<NodeId, readonly NodeId[]> | undefined;
		for(const [id, vertex] of graph.verticesOfType(VertexType.FunctionCall)) {
			const masks = Nse.dropResolvedMask(graph, id, vertex.name);
			if(masks !== undefined) {
				masking.push(masks);
			}
			for(const installed of installedLanguageOf(graph, id, installersOnce)) {
				Deferred.link(graph, installed, namesOnce(), idMap);
				graph.addEdge(id, installed, EdgeType.Returns);
			}
			if(DelayingCalls.has(Identifier.getName(vertex.name))) {
				const promise = capturedArgumentsOf(graph, id, true)[0];
				if(promise === undefined) {
					continue;
				}
				const promised = namesOnce();
				const binding = boundBy(graph, id);
				const flow = binding === undefined ? undefined : cfgOnce();
				const sites = flow === undefined || binding === undefined ? undefined : Deferred.forcedAt(graph, binding, flow, true);
				/* the promise runs in `eval.env`, so whatever that environment holds may be what it reads */
				const call = idMap.get(id);
				const evalEnv = RFunctionCall.is(call) ? MatchArgs.toNames(call.arguments, DelayedAssignFormals).get('eval.env')?.value : undefined;
				const tracked = trackedEnvOf(vertex, evalEnv);
				/* a tracked `eval.env` that binds every name the promise reads leaves no other binding in play, its writes still reach later reads */
				const bound = tracked !== undefined && Quoted.evaluateIn(graph, promise, tracked, idMap).length === 0;
				const candidates = bound ? { definitions: new Map(), uses: promised.uses } : promised;
				const forces = flow !== undefined && sites?.length && binding !== undefined ? { cfg: flow, sites, binding } : undefined;
				Deferred.link(graph, promise, candidates, idMap, forces);
				if(binding !== undefined) {
					linkForcesToPromise(graph, binding, promise);
				}
				if(evalEnv !== undefined) {
					graph.addEdge(promise, evalEnv.info.id, EdgeType.Reads);
				}
			} else if(DfgVertex.hasOrigin(vertex, BuiltInProcName.Eval) || EvaluatingElsewhereCalls.has(Identifier.getName(vertex.name))) {
				bindings ??= verticesByName(graph, VertexType.VariableDefinition, idMap);
				resolveEvaluation(graph, vertex, idMap, namesOnce(), bindings, cfgOnce(), reachOf, enclosing ??= enclosingDefinitions(graph), evaluated);
			} else {
				for(const [escaped, closure] of escapingArguments(graph, id)) {
					Deferred.link(graph, escaped, namesOnce(), idMap);
					readAtForcingCalls(graph, id, escaped, closure, idMap);
				}
				sideEffects ??= callsWithSideEffects(graph);
				const flow = sideEffects.has(id) ? cfgOnce() : undefined;
				if(flow === undefined) {
					continue;
				}
				for(const parameter of Dataflow.calleesOf(graph, id).flatMap(Dataflow.parametersOf)) {
					for(const argument of Dataflow.argumentsBoundTo(graph, parameter)) {
						const index = namesOnce();
						const forces = forcesOf(graph, parameter, flow, forcing, reachOf);
						if(forces !== undefined) {
							Deferred.link(graph, argument, index, idMap, forces);
						}
					}
				}
			}
		}
		for(const at of evaluated) {
			Nse.unmark(graph, at);
		}
		graph.trackIncomingReads(false);
		/* only once every mark has settled: the read a column gets makes it look bound from here on */
		Nse.linkMasksToData(graph, masking);
	}
} as const;

export
interface CapturedExpression {
	readonly expr: NodeId
	/** the capturing call, whose scope encloses `expr` */
	readonly at:   NodeId
}

/** Where `parameter` is forced, shared by all calls handing it an argument; only reused while its reads are unchanged. */
function forcesOf(graph: DataflowGraph, parameter: NodeId, cfg: ControlFlowGraph, forcing: Map<NodeId, { readonly version: number, readonly reads: number, readonly forces: ForceSites | undefined }>, reachOf: (sites: readonly NodeId[]) => Reach): ForceSites | undefined {
	const version = graph.incomingReadsVersion(parameter);
	const known = forcing.get(parameter);
	if(known?.version === version) {
		return known.forces;
	}
	/* counting is only needed once something touched the reads, and the same count still means the same forces */
	const reads = edgeSources(graph, parameter, EdgeType.Reads).length;
	if(known?.reads === reads) {
		forcing.set(parameter, { ...known, version });
		return known.forces;
	}
	const sites = Deferred.forcedAt(graph, parameter, cfg);
	const forces = sites.length > 0 ? { cfg, sites, binding: parameter, reach: reachOf(sites) } : undefined;
	forcing.set(parameter, { version, reads, forces });
	return forces;
}

/** The name a delaying call binds, which is the definition its reads have to go through. */
function boundBy(graph: DataflowGraph, id: NodeId): NodeId | undefined {
	return edgeSources(graph, id, EdgeType.DefinedBy).find(target => DfgVertex.isVariableDefinition(graph.getVertex(target)));
}

/** Every read of the delayed name takes the promised expression's value, so all of them get the link, not just whichever forces it first. */
function linkForcesToPromise(graph: DataflowGraph, binding: NodeId, promise: NodeId): void {
	for(const reader of edgeSources(graph, binding, EdgeType.Reads | EdgeType.DefinedByOnCall)) {
		if(reader !== promise) {
			graph.addEdge(reader, promise, EdgeType.Reads);
		}
	}
}

/** The tracked custom environment `evalEnv` names, if it is a single one. */
function trackedEnvOf(call: DataflowGraphVertexFunctionCall, evalEnv: RNode<ParentInformation> | undefined): REnvironmentInformation | undefined {
	const defs = RSymbol.is(evalEnv) && call.environment !== undefined ? Resolve.byNameAndType(evalEnv.content, call.environment, ReferenceType.Variable) : undefined;
	const env = defs?.length === 1 && hasEnvState(defs[0]) ? defs[0].envState : undefined;
	return env?.current.globalEnv || env?.current.builtInEnv ? undefined : env;
}

function* installedLanguageOf(graph: DataflowGraph, id: NodeId, installers: () => ReadonlySet<NodeId>): Generator<NodeId> {
	for(const definition of edgeTargets(graph, id, EdgeType.Reads)) {
		if(!DfgVertex.isVariableDefinition(graph.getVertex(definition))) {
			continue;
		}
		let installs = false;
		const captured: NodeId[] = [];
		for(const by of edgeTargets(graph, definition, EdgeType.DefinedBy)) {
			const captures = capturedArgumentsOf(graph, by, true);
			if(captures.length > 0) {
				captured.push(...captures);
			} else if(DfgVertex.hasOrigin(graph.getVertex(by), BuiltInProcName.Replacement) && installers().has(by)) {
				installs = true;
			}
		}
		if(installs) {
			yield* captured;
		}
	}
}

function languageInstallersOf(graph: DataflowGraph, environment: REnvironmentInformation): ReadonlySet<NodeId> {
	const installers = new Set<NodeId>();
	for(const [id, vertex] of graph.verticesOfType(VertexType.FunctionCall)) {
		if(DfgVertex.hasOrigin(vertex, BuiltInProcName.Replacement)
			&& CallProps.hasAny(callFnProps(id, { graph, environment }), CallProp.Lang)) {
			installers.add(id);
		}
	}
	return installers;
}

/**
 * The arguments a call captures: the ones it marked as unevaluated, or, for a call that reads its arguments
 * and still hands back the language object they form, all of them.
 */
function capturedArgumentsOf(graph: DataflowGraph, id: NodeId, marked: boolean): readonly NodeId[] {
	return [...graph.edgesFrom(id)]
		.filter(([, edge]) => DfEdge.includesType(edge, EdgeType.Argument) && (!marked || DfEdge.includesType(edge, EdgeType.NonStandardEvaluation)))
		.map(([target]) => target);
}

/**
 * Where the evaluation happens: the call itself, or, for one inside a closure, every call of that closure (those
 * are the points whose bindings the evaluation sees). `undefined` if a nesting closure is never seen called.
 */
function evaluationSites(graph: DataflowGraph, id: NodeId, enclosing: ReadonlyMap<NodeId, readonly NodeId[]>): readonly NodeId[] | undefined {
	if((enclosing.get(id) ?? []).length === 0) {
		return [id];
	}
	const sites = new Set<NodeId>();
	const todo = [id];
	for(let at = todo.pop(); at !== undefined; at = todo.pop()) {
		for(const definition of enclosing.get(at) ?? []) {
			for(const caller of edgeSources(graph, definition, EdgeType.Calls)) {
				if(!sites.has(caller)) {
					sites.add(caller);
					todo.push(caller);
				}
			}
		}
	}
	return sites.size > 0 ? [...sites] : undefined;
}

/** the function definitions each vertex sits in, built once per pass instead of searching them for every evaluation */
function enclosingDefinitions(graph: DataflowGraph): ReadonlyMap<NodeId, readonly NodeId[]> {
	const enclosing = new Map<NodeId, NodeId[]>();
	for(const [definition, vertex] of graph.verticesOfType(VertexType.FunctionDefinition)) {
		for(const id of vertex.subflow.graph) {
			const known = enclosing.get(id);
			if(known === undefined) {
				enclosing.set(id, [definition]);
			} else {
				known.push(definition);
			}
		}
	}
	return enclosing;
}

/** Whether some point the evaluation may run at is reached with a definition in effect; the same for every definition, so walked once. */
function mayReachFrom(sites: readonly NodeId[] | undefined, cfg: ControlFlowGraph | undefined, reach: Reach): (definition: NodeId) => boolean {
	if(cfg === undefined || sites === undefined) {
		return () => true;
	}
	return definition => (reach.before ??= reachableTo(cfg, sites)).has(definition);
}

/**
 * The names the frames we know do not bind: a capture forced inside a closure may see bindings the caller made
 * after the closure was written, so every reachable definition of the name stays a candidate.
 */
function linkAgainstAnyBinding(graph: DataflowGraph, open: readonly IdentifierReference[], bindings: ReadonlyMap<string, NodeId[]>, sites: readonly NodeId[] | undefined, cfg: ControlFlowGraph | undefined, reach: Reach): void {
	const mayReach = mayReachFrom(sites, cfg, reach);
	for(const reference of open) {
		if(reference.name === undefined) {
			continue;
		}
		for(const definition of bindings.get(Identifier.getName(reference.name)) ?? []) {
			if(definition !== reference.nodeId && mayReach(definition)) {
				graph.addEdge(reference.nodeId, definition, EdgeType.Reads);
			}
		}
	}
}

function callsWithSideEffects(graph: DataflowGraph): ReadonlySet<NodeId> {
	return new Set(graph.vertices(true).flatMap(([from]) => edgeTargets(graph, from, EdgeType.SideEffectOnCall)));
}

/** Links a capture handed to an evaluating call, in that call's scope. */
function resolveEvaluation<Info>(graph: DataflowGraph, call: DataflowGraphVertexFunctionCall, idMap: AstIdMap<Info & ParentInformation>, names: ReturnType<typeof Deferred.indexOf>, bindings: ReadonlyMap<string, NodeId[]>, cfg: ControlFlowGraph | undefined, reachOf: (sites: readonly NodeId[]) => Reach, enclosing: ReadonlyMap<NodeId, readonly NodeId[]>, evaluated: NodeId[]): void {
	const id = call.id;
	const own = EvaluatingElsewhereCalls.has(Identifier.getName(call.name));
	const sources = own ? capturedArgumentsOf(graph, id, true).map(expr => ({ expr, at: id })) : sourcesHandedTo(graph, call, idMap);
	const environment = call.environment;
	const node = idMap.get(id);
	/* a frame of its own (`eval(expr, envir)` runs in the one it is given) says nothing about the bindings here,
	   so every one of them stays possible */
	const elsewhere = own || environment === undefined || (RFunctionCall.isNamed(node) && node.arguments.length > 1);
	const sites = sources.length > 0 ? evaluationSites(graph, id, enclosing) : undefined;
	const reach = sites === undefined ? {} : reachOf(sites);
	for(const { expr, at } of sources) {
		if(elsewhere) {
			const forces = cfg === undefined || sites === undefined ? undefined : { cfg, sites, binding: id, reach };
			Deferred.link(graph, expr, { definitions: bindings, uses: names.uses }, idMap, forces);
			Deferred.publish(graph, expr, names, idMap, id, sites ?? []);
		} else {
			const open = linkExpressionIn(graph, expr, environment, idMap);
			/* R falls through to the enclosing scope for names the evaluating frame does not bind */
			const enclosing = open.length > 0 ? graph.getVertex(at)?.environment : undefined;
			const unbound = enclosing === undefined ? open : linkInputs(open, enclosing, [], graph, false);
			linkAgainstAnyBinding(graph, unbound, bindings, sites, cfg, reach);
			Deferred.publish(graph, expr, names, idMap, id, sites ?? [], cfg);
		}
		graph.addEdge(id, expr, EdgeType.Returns);
		/* the captured code only runs because this call evaluates it */
		graph.addEdge(expr, id, EdgeType.Reads);
		if(!elsewhere) {
			/* the capture said "not evaluated here", and being handed to `eval` settles that it is */
			evaluated.push(at);
		}
	}
	if(sources.length > 0 && !elsewhere) {
		forgetUnknownSideEffect(graph, id);
	}
	if(sources.length > 0 && environment !== undefined && !sources.some(({ expr }) => mayConfigure(graph, expr, environment))) {
		forgetStateWrites(graph, id, new Set(sources.filter(({ at }) => RNode.findEnclosing(at, idMap, n => n.info.id === id) === undefined).map(({ expr }) => expr)));
	}
}

/** Whether evaluating `expr` may change the options, graphics, or RNG state: a call states {@link CallProp.Configures} or {@link SemanticCallTag.Random}, or is opaque. */
function mayConfigure(graph: DataflowGraph, expr: NodeId, environment: REnvironmentInformation): boolean {
	const seen = new Set<NodeId>();
	const todo = [expr];
	while(todo.length > 0) {
		const id = todo.pop() as NodeId;
		if(seen.has(id) || NodeId.isBuiltIn(id)) {
			continue;
		}
		seen.add(id);
		const vertex = graph.getVertex(id);
		if(DfgVertex.isFunctionCall(vertex)) {
			const builtIn = Array.isArray(vertex.origin) && vertex.origin.every(o => String(o).startsWith('builtin:') && o !== BuiltInProcName.Function && o !== BuiltInProcName.Eval);
			if(!builtIn || CallProps.hasAny(callFnProps(id, { graph, environment }), [CallProp.Configures, SemanticCallTag.Random])) {
				return true;
			}
		}
		for(const [target, edge] of graph.edgesFrom(id)) {
			if(DfEdge.includesType(edge, EdgeType.Argument | EdgeType.Returns) || (DfgVertex.isUse(vertex) && DfEdge.includesType(edge, EdgeType.Reads))) {
				todo.push(target);
			}
		}
	}
	return false;
}

/**
 * An evaluation is assumed to write the options and graphics state until we know what it evaluates (see `evaluatesCapturedCode`);
 * a captured call then no longer needs the evaluation either, `eval(quote(x <- 1))` slices to `x <- 1`.
 */
function forgetStateWrites(graph: DataflowGraph, id: NodeId, evaluatedElsewhere: ReadonlySet<NodeId>): void {
	for(const [from, edge] of graph.edgesTo(id)) {
		if(DfEdge.isOnlyType(edge, EdgeType.Reads) && DfgVertex.isFunctionCall(graph.getVertex(from)) && !evaluatedElsewhere.has(from)) {
			graph.removeEdgeType(from, id, EdgeType.Reads);
		}
	}
}

/** The captures the first argument of an evaluating call may carry. */
function sourcesHandedTo<Info>(graph: DataflowGraph, call: DataflowGraphVertexFunctionCall, idMap: AstIdMap<Info & ParentInformation>): readonly CapturedExpression[] {
	const argument = call.args.find(a => !FunctionArgument.isEmpty(a));
	const reference = argument === undefined ? undefined : FunctionArgument.getReference(argument);
	const node = reference === undefined ? undefined : idMap.get(reference);
	const value = RArgument.is(node) ? node.value?.info.id : reference;
	return value === undefined ? [] : Quoted.sourcesOf(graph, value);
}

/**
 * The arguments of `id` whose promise outlives the call: the callee hands back a closure and never reads the
 * parameter outside it, so R forces them wherever that closure is called, not here. A parameter read in the
 * body itself (what `force` is for) is settled during the call and stays where it is.
 */
function* escapingArguments(graph: DataflowGraph, id: NodeId): Generator<readonly [argument: NodeId, closure: NodeId]> {
	for(const callee of Dataflow.calleesOf(graph, id)) {
		for(const exit of callee.exitPoints) {
			const closure = graph.getVertex(exit.nodeId);
			if(!DfgVertex.isFunctionDefinition(closure)) {
				continue;
			}
			for(const parameter of Dataflow.parametersOf(callee)) {
				if(edgeSources(graph, parameter, EdgeType.Reads).some(reader => !closure.subflow.graph.has(reader))) {
					continue;
				}
				for(const argument of Dataflow.argumentsBoundTo(graph, parameter)) {
					yield [argument, closure.id];
				}
			}
		}
	}
}

/**
 * A promise only the closure `closure` forces (see {@link escapingArguments}) sees what is bound where the closure
 * is called. When the closure the factory call `factoryCall` hands back is only ever bound by assignments and
 * called through them, and each of these calls runs once in program order, a definition none of them sees does
 * not reach the promise.
 */
function readAtForcingCalls<Info>(graph: DataflowGraph, factoryCall: NodeId, argument: NodeId, closure: NodeId, idMap: AstIdMap<Info & ParentInformation>): void {
	const environments: REnvironmentInformation[] = [];
	for(const [binding, edge] of graph.edgesTo(factoryCall)) {
		const via = graph.getVertex(binding);
		if(!DfEdge.includesType(edge, ~ControlFlowEdgeTypes) || DfgVertex.hasOrigin(via, BuiltInProcName.Assignment)) {
			continue;
		} else if(!DfgVertex.isVariableDefinition(via) || !DfEdge.includesType(edge, EdgeType.DefinedBy)) {
			return;
		}
		for(const reader of edgeSources(graph, binding, EdgeType.Reads)) {
			const call = graph.getVertex(reader);
			if(!DfgVertex.isFunctionCall(call) || !hasEdgeOfType(graph, reader, closure, EdgeType.Calls)
				|| call.environment === undefined || ProgramOrder.runsOnceAt(reader, graph) === undefined) {
				return;
			}
			environments.push(call.environment);
		}
	}
	if(environments.length === 0 || ProgramOrder.runsOnceAt(factoryCall, graph) === undefined) {
		return;
	}
	RNode.visitAst(idMap.get(argument), node => {
		/* what a function within the argument reads is read when that function runs, not when the promise is forced */
		if(graph.hasVertex(node.info.id) && !graph.isRoot(node.info.id)) {
			return true;
		}
		if(RSymbol.is(node)) {
			const visible = new Set(environments.flatMap(env => Resolve.byName(node.content, env) ?? []).map(d => d.nodeId));
			for(const target of edgeTargets(graph, node.info.id, EdgeType.Reads)) {
				if(DfgVertex.isVariableDefinition(graph.getVertex(target)) && !visible.has(target)) {
					graph.removeEdgeType(node.info.id, target, EdgeType.Reads);
				}
			}
		}
		return false;
	});
}

/** Drops the marker the call carries while we cannot say what it evaluates. */
function forgetUnknownSideEffect(graph: DataflowGraph, id: NodeId): void {
	for(const unknown of graph.unknownSideEffects) {
		if(UnknownSideEffect.id(unknown) === id) {
			graph.unknownSideEffects.delete(unknown);
		}
	}
}
