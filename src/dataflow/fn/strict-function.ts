/**
 * The `FunctionSemantics` facade wires these together, so a sibling here has to call the backing function
 * directly; going through `FunctionSemantics` would make `src/dataflow/fn/function-semantics.ts` import its own importers.
 * @lintIgnore use-instead
 */
import { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { FunctionSemantics } from './function-semantics';
import type { AstIdMap } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { RNode } from '../../r-bridge/lang-4.x/ast/model/model';
import { EmptyArgument, RFunctionCall } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { ControlDependency } from '../info';
import type { DataflowGraph } from '../graph/graph';
import { DfEdge, EdgeType } from '../graph/edge';
import type { DataflowGraphVertexFunctionCall, DataflowGraphVertexFunctionDefinition } from '../graph/vertex';
import { DfgVertex, VertexType } from '../graph/vertex';
import { BuiltInProcName } from '../environments/built-in-proc-name';
import type { ArgProps, BuiltInFnInfo, FnSig } from '../environments/built-in-props';
import { ArgProp, DispatchCallees, FnSig as Sig } from '../environments/built-in-props';
import type { BuiltInLookup } from './frame-reflection';
import { reflectiveRolesOf } from './frame-reflection';
import { BuiltInIndex, queryFnProps } from '../environments/query-fn-props';
import { Identifier } from '../environments/identifier';
import type { ReadOnlyFlowrAnalyzerContext } from '../../project/context/flowr-analyzer-context';
import { Ternary, TernaryLogic } from '../../util/logic';
import { RArgument } from '../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import { RFunctionDefinition } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-definition';
import { RParameter } from '../../r-bridge/lang-4.x/ast/model/nodes/r-parameter';

/**
 * How a function treats its parameters: R hands arguments over as promises, so a parameter is strict when
 * calling the function is enough to force it.
 */
export interface FunctionStrictness {
	/** whether every parameter is forced */
	readonly strict:     Ternary
	/** the same per parameter, keyed by the id of the parameter's name */
	readonly parameters: Record<NodeId, Ternary>
}

/**
 * What an argument is used for when the call never evaluates it: quoted or read in another frame
 * ({@link ArgProp.Nse}), or looked at only for having been supplied ({@link ArgProp.Presence}).
 */
const NotEvaluated = ArgProp.Nse | ArgProp.Presence;
/** What reflection has to reach for a parameter to be evaluated by it (`as.list(environment())`, not `match.call()`/`nargs()`). */
const MayEvaluate = ArgProp.Value | ArgProp.Forced;
/**
 * The processors whose calls reach their first argument and the rest only on the way the run happens to
 * take: `switch` picks one of its branches, and `try`/`tryCatch` reach a handler only when one is needed.
 */
const LazyAfterFirst: readonly BuiltInProcName[] = [BuiltInProcName.Switch, BuiltInProcName.Try];
/**
 * The processors putting off what they are given until a moment that may never come: a hook runs when the
 * function exits, and `Recall` starts the same function over rather than reading anything itself.
 */
const LazyThroughout: readonly BuiltInProcName[] = [BuiltInProcName.RegisterHook, BuiltInProcName.Recall];
/** The processors dispatching to a method chosen at run time. */
const DispatchProcessors: readonly BuiltInProcName[] = [
	BuiltInProcName.S3Dispatch, BuiltInProcName.S3DispatchNext, BuiltInProcName.S7Dispatch
];
/**
 * Whether the call hands the work to a method chosen at run time: flowR's own dispatch processors say so for
 * `UseMethod` and `NextMethod`, and {@link DispatchCallees} covers the ones it has no processor for.
 */
function isDispatch(vertex: DataflowGraphVertexFunctionCall): boolean {
	return hasProcessor(vertex, DispatchProcessors) || DispatchCallees.has(Identifier.getName(vertex.name));
}

/** Whether the call belongs to one of the given processors. */
function hasProcessor(vertex: DataflowGraphVertexFunctionCall, of: readonly BuiltInProcName[]): boolean {
	return vertex.origin !== 'unnamed' && of.some(p => vertex.origin.includes(p));
}

/** What a dispatching body does with the arguments it never mentions itself. */
interface DispatchInformation {
	/** whether the dispatch names the object itself, leaving the first parameter out of it */
	readonly named:   boolean
	/** whether the dispatch happens on every call, unlike one inside a branch */
	readonly certain: boolean
	/** the definitions a `NextMethod` hands the same arguments on to, this one excepted */
	readonly next:    readonly NodeId[]
}

/**
 * What one run of the analysis carries along: an argument handed to another function is only forced if that
 * function forces the parameter it binds to, so answering one definition regularly asks about others.
 */
interface StrictnessState {
	readonly graph:    DataflowGraph
	readonly idMap:    AstIdMap | undefined
	/** what flowR states about a built-in's parameters, asked once per name */
	readonly sigs:     Map<string, FnSig | undefined>
	/** how to ask, so a configured built-in is the one that answers */
	readonly props:    (name: Identifier) => FnSig | undefined
	/** the definition each parameter belongs to, to follow an argument into its callee */
	readonly owner:    Map<NodeId, NodeId>
	/** the definitions whose body dispatches */
	readonly dispatch: Map<NodeId, DispatchInformation>
	/** what flowR states about a built-in, see {@link BuiltInFnInfo} */
	readonly fnInfo:   BuiltInLookup
	readonly known:    Map<NodeId, FunctionStrictness>
	/** the definitions the current question rests on, so a cycle answers rather than loops */
	readonly asking:   Set<NodeId>
	/** whether a cycle was answered by assumption, which makes the result unfit to keep */
	assumed:           boolean
}

/** The definition a node sits in. */
function enclosingDefinition(id: NodeId, idMap: AstIdMap, graph: DataflowGraph): NodeId | undefined {
	return RNode.findEnclosing(id, idMap, node => DfgVertex.isFunctionDefinition(graph.getVertex(node.info.id)));
}

function makeState(graph: DataflowGraph, ctx: ReadOnlyFlowrAnalyzerContext | undefined): StrictnessState {
	const idMap = graph.idMap;
	const owner = new Map<NodeId, NodeId>();
	for(const [id, vertex] of graph.verticesOfType(VertexType.FunctionDefinition)) {
		for(const param of Object.keys(vertex.params)) {
			owner.set(NodeId.normalize(param), id);
		}
	}
	const environment = ctx?.env.makeCleanEnv();
	const info = environment === undefined
		? (name: Identifier) => BuiltInIndex.default().get(name)
		: (name: Identifier) => queryFnProps(name, { environment });
	const infos = new Map<string, BuiltInFnInfo | undefined>();
	const fnInfo = (name: Identifier): BuiltInFnInfo | undefined => {
		const key = Identifier.getName(name);
		if(!infos.has(key)) {
			infos.set(key, info(name));
		}
		return infos.get(key);
	};
	const dispatch = new Map<NodeId, DispatchInformation>();
	if(idMap !== undefined) {
		for(const [id, vertex] of graph.verticesOfType(VertexType.FunctionCall)) {
			if(!isDispatch(vertex) || typeof NodeId.normalize(id) !== 'number') {
				continue;
			}
			const within = enclosingDefinition(id, idMap, graph);
			if(within === undefined) {
				continue;
			}
			const node = idMap.get(id);
			const known = dispatch.get(within);
			const named = (RFunctionCall.is(node) && (node.arguments?.length ?? 0) > 1) || (known?.named ?? false);
			const certain = !underCondition(vertex.cds, graph.getVertex(within)?.cds) || (known?.certain ?? false);
			const next = [...known?.next ?? []];
			for(const [target, edge] of graph.edgesFrom(id)) {
				if(target !== within && DfEdge.includesType(edge, EdgeType.Calls) && DfgVertex.isFunctionDefinition(graph.getVertex(target))) {
					next.push(target);
				}
			}
			dispatch.set(within, { named, certain, next });
		}
	}
	return { graph, idMap, owner, dispatch, fnInfo, sigs: new Map(), props: name => fnInfo(name)?.sig, known: new Map(), asking: new Set(), assumed: false };
}

/** What is certain becomes a possibility once something may intervene. */
function weaken(value: Ternary): Ternary {
	return value === Ternary.Always ? Ternary.Maybe : value;
}

/** What several answers amount to when only one applies and nothing says which. */
function agree(values: readonly Ternary[]): Ternary {
	if(values.length === 0) {
		return Ternary.Never;
	}
	return values.every(v => v === values[0]) ? values[0] : Ternary.Maybe;
}

/** Whether the control dependencies exceed the ones the definition itself stands under. */
function underCondition(cds: readonly ControlDependency[] | undefined, definition: readonly ControlDependency[] | undefined): boolean {
	return cds?.some(c => !definition?.some(d => d.id === c.id && d.when === c.when)) ?? false;
}

/**
 * Built-ins force what they are given, and the ones that do not (`quote` and its relatives) leave no read of
 * the argument in the graph in the first place, so there is nothing to hold back here. A call of something
 * the code worked out for itself (`obj$method(...)`) is none of them, whichever way it was written.
 */
function isBuiltInCall(vertex: DataflowGraphVertexFunctionCall): boolean {
	return vertex.origin !== 'unnamed'
		&& !vertex.origin.includes(BuiltInProcName.Function)
		&& !vertex.origin.includes(BuiltInProcName.Unnamed);
}

/** The node whose value an argument stands for, carrying the link to the parameter it binds to. */
function argumentValue(id: NodeId, idMap: AstIdMap): NodeId {
	const node = idMap.get(id);
	return RArgument.is(node) ? node.value?.info.id ?? id : id;
}

/**
 * Where the given node stands in the call's arguments. The graph names an argument by the value it wraps,
 * while the walk arrives at the argument itself, so both count as a hit; `-1` when neither does, which a
 * call whose arguments flowR rewrote (`on.exit` and the other deferred ones) is enough to bring about.
 */
function argumentIndex(call: DataflowGraphVertexFunctionCall, child: NodeId, idMap: AstIdMap): number {
	const value = argumentValue(child, idMap);
	return call.args.findIndex(arg => arg !== EmptyArgument && (arg.nodeId === child || arg.nodeId === value));
}

/** Whether the node is the function a call is of rather than something handed to it. */
function isCallee(call: NodeId, child: NodeId, idMap: AstIdMap): boolean {
	const node = idMap.get(call);
	if(!RFunctionCall.is(node)) {
		return false;
	}
	return (RFunctionCall.isNamed(node) ? node.functionName.info.id : node.calledFunction.info.id) === child;
}

/**
 * What flowR states the argument at `index` of the call is used for. A `...` covers every position from
 * where it is declared, which {@link FunctionSemantics.call.signature.propAt} takes care of.
 */
function argProps(vertex: DataflowGraphVertexFunctionCall, index: number, state: StrictnessState): ArgProps {
	const name = Identifier.getName(vertex.name);
	let sig = state.sigs.get(name);
	if(sig === undefined && !state.sigs.has(name)) {
		state.sigs.set(name, sig = state.props(vertex.name));
	}
	return sig === undefined || index < 0 ? 0 : Sig.propAt(Sig.layout(sig), index);
}

/** The verdict a callee's parameter carries over to what is handed to it. */
function handedTo(param: NodeId, state: StrictnessState): Ternary {
	const owner = state.owner.get(param);
	return owner === undefined ? Ternary.Maybe : strictnessOf(owner, state).parameters[param] ?? Ternary.Maybe;
}

/**
 * Whether handing `argument` to `call` forces it. An argument the call passes on is forced exactly as the
 * function receiving it forces the parameter it binds to; a call flowR cannot resolve, and one whose argument
 * it cannot match to a parameter, leave the question open.
 */
function forcedByCallee(call: DataflowGraphVertexFunctionCall, argument: NodeId, idMap: AstIdMap, state: StrictnessState): Ternary {
	const resolved = [...state.graph.edgesFrom(call.id)]
		.some(([target, edge]) => DfEdge.includesType(edge, EdgeType.Calls) && DfgVertex.isFunctionDefinition(state.graph.getVertex(target)));
	if(!resolved) {
		return Ternary.Maybe;
	}
	const bound: Ternary[] = [];
	for(const from of new Set([argument, argumentValue(argument, idMap)])) {
		for(const [target, edge] of state.graph.edgesFrom(from)) {
			if(DfEdge.includesType(edge, EdgeType.DefinesOnCall)) {
				bound.push(handedTo(target, state));
			}
		}
	}
	return bound.length === 0 ? Ternary.Maybe : agree(bound);
}

/**
 * How far the given read of a parameter is unavoidable: it has to stand under no condition the definition
 * does not already stand under, must not sit in a function or a default of its own that may never be
 * reached, and must not merely be handed to something that leaves it alone.
 */
function forces(read: NodeId, definition: DataflowGraphVertexFunctionDefinition, state: StrictnessState): Ternary {
	const idMap = state.idMap;
	if(idMap === undefined) {
		return Ternary.Maybe;
	}
	let certain = true;
	let child = read;
	let node = idMap.get(read);
	while(node !== undefined && node.info.id !== definition.id) {
		const vertex = state.graph.getVertex(node.info.id);
		if(underCondition(vertex?.cds, definition.cds)) {
			certain = false;
		}
		if(node.info.id !== read) {
			if(DfgVertex.isFunctionDefinition(vertex)) {
				/* nothing says the nested definition is ever called */
				certain = false;
			} else if(RParameter.is(node)) {
				/* a default is evaluated only when the argument is left out */
				certain = false;
			} else if(DfgVertex.isFunctionCall(vertex) && !isDispatch(vertex) && !isCallee(node.info.id, child, idMap)) {
				if(!isBuiltInCall(vertex)) {
					const handed = forcedByCallee(vertex, child, idMap, state);
					return certain ? handed : weaken(handed);
				}
				const index = argumentIndex(vertex, child, idMap);
				const props = argProps(vertex, index, state);
				if((props & NotEvaluated) !== 0) {
					return Ternary.Never;
				} else if((props & ArgProp.Forced) === 0
					&& (hasProcessor(vertex, LazyThroughout) || (index !== 0 && hasProcessor(vertex, LazyAfterFirst)))) {
					certain = false;
				}
			}
		}
		child = node.info.id;
		node = node.info.parent === undefined ? undefined : idMap.get(node.info.parent);
	}
	if(node === undefined) {
		return Ternary.Never;
	}
	return certain ? Ternary.Always : Ternary.Maybe;
}

function strictnessOfParameter(param: NodeId, definition: DataflowGraphVertexFunctionDefinition, state: StrictnessState): Ternary {
	const reads: Ternary[] = [];
	for(const [read, edge] of state.graph.edgesTo(param)) {
		if(DfEdge.includesType(edge, EdgeType.Reads)) {
			reads.push(forces(read, definition, state));
		}
	}
	const dispatch = state.dispatch.get(definition.id);
	if(dispatch !== undefined) {
		const methods: Ternary[] = [];
		for(const [target, edge] of state.graph.edgesFrom(param)) {
			if(DfEdge.includesType(edge, EdgeType.DefinesOnCall)) {
				methods.push(handedTo(target, state));
			}
		}
		reads.push(dispatch.certain ? agree(methods) : weaken(agree(methods)));
		if(dispatch.next.length > 0) {
			const at = parameterIds(definition.id, state.idMap).indexOf(param);
			const along = at < 0 ? [] : dispatch.next.map(method => {
				const same = parameterIds(method, state.idMap)[at];
				return same === undefined ? Ternary.Maybe : strictnessOf(method, state).parameters[same] ?? Ternary.Maybe;
			});
			reads.push(dispatch.certain ? agree(along) : weaken(agree(along)));
		}
	}
	return TernaryLogic.or(...reads);
}

/** The parameters of a definition in the order they are written. */
function parameterIds(definition: NodeId, idMap: AstIdMap | undefined): readonly NodeId[] {
	const node = idMap?.get(definition);
	return RFunctionDefinition.is(node) ? node.parameters.map(p => p.name.info.id) : [];
}

function strictnessOf(id: NodeId, state: StrictnessState): FunctionStrictness {
	const known = state.known.get(id);
	if(known !== undefined) {
		return known;
	}
	const vertex = state.graph.getVertex(id);
	if(!DfgVertex.isFunctionDefinition(vertex)) {
		return { strict: Ternary.Never, parameters: {} };
	}
	const params = Object.keys(vertex.params);
	if(state.asking.has(id)) {
		/* the answer is the one still being worked out */
		state.assumed = true;
		return { strict: Ternary.Maybe, parameters: Object.fromEntries(params.map(param => [param, Ternary.Maybe])) };
	}
	state.asking.add(id);
	const parameters: Record<NodeId, Ternary> = {};
	for(const param of params) {
		parameters[param] = strictnessOfParameter(NodeId.normalize(param), vertex, state);
	}
	/* reflection flowR could not follow may read a parameter without any read of it showing in the code */
	if((reflectiveRolesOf(vertex, state.graph, { known: state.fnInfo }) & MayEvaluate) !== 0) {
		for(const param of params) {
			parameters[param] = TernaryLogic.or(parameters[param], Ternary.Maybe);
		}
	}
	const dispatch = state.dispatch.get(id);
	if(dispatch !== undefined) {
		for(const param of params) {
			parameters[param] = TernaryLogic.or(parameters[param], Ternary.Maybe);
		}
		const object = dispatch.named ? undefined : parameterIds(id, state.idMap)[0];
		if(object !== undefined && parameters[object] !== undefined) {
			parameters[object] = dispatch.certain ? Ternary.Always : TernaryLogic.or(parameters[object], Ternary.Maybe);
		}
	}
	state.asking.delete(id);
	const result: FunctionStrictness = { strict: TernaryLogic.and(...Object.values(parameters)), parameters };
	if(!state.assumed) {
		state.known.set(id, result);
	} else if(state.asking.size === 0) {
		state.assumed = false;
	}
	return result;
}

/**
 * Determines whether the function with the given id is strict, i.e., whether calling it forces its arguments.
 * {@link Ternary#Always} says every call forces every parameter, {@link Ternary#Never} that no call forces
 * all of them, and {@link Ternary#Maybe} that it depends on the path taken, on the caller, or on a function
 * flowR could not resolve. A definition without parameters has nothing to leave unforced and is strict.
 *
 * The analysis follows an argument that is handed on into the function receiving it, and treats a read in a
 * default, in a loop, in a branch, or in a nested definition as one that may not happen. What a built-in
 * does with an argument is not guessed from its name: an argument stated {@link ArgProp.Nse} or
 * {@link ArgProp.Presence} is never evaluated, one stated {@link ArgProp.Forced} always is, and the calls
 * reaching an argument only on the way the run takes are the ones flowR hands to the processor that says so
 * (`switch` picking a branch, `try` reaching a handler, a hook running at exit).
 * A body reading its own call or frame ({@link CallProp.Frame}: `match.call()`, `nargs()`,
 * `as.list(environment())`) reaches every parameter without naming one, so none of them is answered `Never`.
 * For a generic, the methods reached by S3 dispatch decide: they agree on a parameter or it is left open,
 * while the object the dispatch is on is forced by the dispatch itself. A `NextMethod` carries the same
 * question on to the methods it reaches, matched by the position the parameter is written in.
 * An argument in `...` is followed to the parameter it binds to, whereas the method of an object flowR
 * cannot resolve (`obj$m(x)`) is one more thing it cannot claim anything about.
 * Cyclic dependencies between functions and calls flowR cannot resolve answer {@link Ternary#Maybe}, so this
 * only claims certainty where the code gives it.
 * What a built-in does with an argument comes from the {@link ArgProp} bits its signature states, so a
 * configured or overwritten built-in is the one that answers when the analyzer context is handed along.
 * @useInstead {@link FunctionSemantics.strictness}
 */
export function strictnessOfEach(this: void, ids: Iterable<NodeId>, graph: DataflowGraph, { ctx }: FunctionStrictnessesOptions = {}): Record<NodeId, FunctionStrictness> {
	const state = makeState(graph, ctx);
	const result: Record<NodeId, FunctionStrictness> = {};
	for(const id of ids) {
		result[id] = strictnessOf(id, state);
	}
	return result;
}

/** What to ask for beyond the definitions themselves, see {@link strictnessOfEach}. */
export interface FunctionStrictnessesOptions {
	/** how to ask what a built-in states, so a configured or overwritten one answers */
	readonly ctx?: ReadOnlyFlowrAnalyzerContext
}


/**
 * Determines whether the function with the given id is strict, i.e., whether calling it forces its arguments.
 * {@link Ternary#Always} says every call forces every parameter, {@link Ternary#Never} that no call forces
 * all of them, and {@link Ternary#Maybe} that it depends on the path taken, on the caller, or on a function
 * flowR could not resolve. A definition without parameters has nothing to leave unforced and is strict.
 * @deprecated use {@link strictnessOfEach} instead
 */
export function strictnessOfFunction(id: NodeId, graph: DataflowGraph, ctx?: ReadOnlyFlowrAnalyzerContext): FunctionStrictness {
	return strictnessOfEach([id], graph, { ctx })[id];
}

