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
import type { ControlDependency, ExitPoint } from '../info';
import { happensInEveryBranch } from '../info';
import type { DataflowGraph } from '../graph/graph';
import { DfEdge, EdgeType } from '../graph/edge';
import { NodeValue } from '../eval/resolve/node-value';
import { Resolve } from '../environments/resolve-helper';
import { fallbackUntargetedCall } from '../graph/call-graph';
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
	readonly graph:      DataflowGraph
	readonly idMap:      AstIdMap | undefined
	/** what flowR states about a built-in's parameters, asked once per name */
	readonly sigs:       Map<string, FnSig | undefined>
	/** how to ask, so a configured built-in is the one that answers */
	readonly props:      (name: Identifier) => FnSig | undefined
	/** the definition each parameter belongs to, to follow an argument into its callee */
	readonly owner:      Map<NodeId, NodeId>
	/** the definitions whose body dispatches */
	readonly dispatch:   Map<NodeId, DispatchInformation>
	/** what flowR states about a built-in, see {@link BuiltInFnInfo} */
	readonly fnInfo:     BuiltInLookup
	/** to ask what a branch condition evaluates to, once the analysis is done */
	readonly ctx:        ReadOnlyFlowrAnalyzerContext | undefined
	/** the logical value each `if` condition asked about so far holds wherever it is reached, `undefined` if it may differ */
	readonly branches:   Map<NodeId, boolean | undefined>
	/** the definitions a call without a linked target leads back to, see {@link boundParameters} */
	readonly untargeted: Map<NodeId, readonly NodeId[]>
	readonly known:      Map<NodeId, FunctionStrictness>
	/** the definitions the current question rests on, so a cycle answers rather than loops */
	readonly asking:     Set<NodeId>
	/** whether a cycle was answered by assumption, which makes the result unfit to keep */
	assumed:             boolean

	/** results reached under an assumption, kept until the outermost question of their cycle is answered */
	readonly provisional: Map<NodeId, FunctionStrictness>
	/** what a cycle assumes of the definitions within it, the outcome of the round before */
	assumptions:          ReadonlyMap<NodeId, FunctionStrictness>
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
	return { graph, idMap, owner, dispatch, fnInfo, ctx, branches: new Map(), untargeted: new Map(), sigs: new Map(), props: name => fnInfo(name)?.sig, known: new Map(), provisional: new Map(), assumptions: new Map(), asking: new Set(), assumed: false };
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

/**
 * Whether the control dependencies exceed the ones the definition itself stands under. Running only once a
 * function forces it ({@link ControlFlow.withinPromise}) is no condition here, the walk up asks that function.
 */
function underCondition(cds: readonly ControlDependency[] | undefined, definition: readonly ControlDependency[] | undefined): boolean {
	return conditionsBeyond(cds, definition).length > 0;
}

/** The control dependencies beyond the ones the definition itself stands under, see {@link underCondition}. */
function conditionsBeyond(cds: readonly ControlDependency[] | undefined, definition: readonly ControlDependency[] | undefined): ControlDependency[] {
	return cds?.filter(c => !definition?.some(d => d.id === c.id && d.when === c.when) && c.byPromise !== true) ?? [];
}

/**
 * Whether the branch `cd` stands for is taken, when the condition of the `if` it belongs to evaluates to the
 * same logical value wherever the program reaches it (`cond <- TRUE` and nothing else assigning `cond`).
 */
function branchTaken(cd: ControlDependency, state: StrictnessState): boolean | undefined {
	if(state.ctx === undefined || cd.when === undefined) {
		return undefined;
	}
	let value = state.branches.get(cd.id);
	if(!state.branches.has(cd.id)) {
		const call = state.graph.getVertex(cd.id);
		const condition = DfgVertex.hasOrigin(call, BuiltInProcName.IfThenElse) && DfgVertex.isFunctionCall(call) ? call.args[0] : undefined;
		const values = condition === undefined || condition === EmptyArgument ? [] : NodeValue.setOf(condition.nodeId, Resolve.info(state.graph, state.ctx))?.elements ?? [];
		const outcomes = new Set(values.map(v => v.type === 'logical' && typeof v.value === 'boolean' ? v.value : undefined));
		value = outcomes.size === 1 && !outcomes.has(undefined) ? [...outcomes][0] : undefined;
		state.branches.set(cd.id, value);
	}
	return value === undefined ? undefined : value === cd.when;
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
 * The parameters an argument of `call` binds to: those the linked call binds it to, and for a call without a
 * linked target whose name leads back to function definitions only (a parameter the callers hand functions
 * to), the parameter at the argument's position in each of them. `undefined` when that cannot be told:
 * a named argument or `...` for such a call, or a name that may lead elsewhere.
 */
function boundParameters(call: DataflowGraphVertexFunctionCall, argument: NodeId, idMap: AstIdMap, graph: DataflowGraph, origins?: Map<NodeId, readonly NodeId[]>): NodeId[] | undefined {
	const linked = boundTo(argument, idMap, graph);
	if(linked.length > 0 || [...graph.edgesFrom(call.id)].some(([target, edge]) => DfEdge.includesType(edge, EdgeType.Calls) && DfgVertex.isFunctionDefinition(graph.getVertex(target)))) {
		return linked;
	}
	const index = argumentIndex(call, argument, idMap);
	const arg = call.args[index];
	/* only a name read from the program itself (a parameter, a variable) may lead to definitions */
	if(index < 0 || arg === EmptyArgument || arg.name !== undefined
		|| !graph.edgesFrom(call.id).entries().some(([target, e]) => DfEdge.includesType(e, EdgeType.Reads) && !DfEdge.includesType(e, EdgeType.Argument) && !NodeId.isBuiltIn(target))) {
		return undefined;
	}
	let found = origins?.get(call.id);
	if(found === undefined) {
		found = [...fallbackUntargetedCall(call, graph)];
		origins?.set(call.id, found);
	}
	if(found.length === 0 || !found.every(o => DfgVertex.isFunctionDefinition(graph.getVertex(o)))) {
		return undefined;
	}
	const params: NodeId[] = [];
	for(const definition of found) {
		const node = idMap.get(definition);
		const param = RFunctionDefinition.is(node) && !node.parameters.slice(0, index + 1).some(RParameter.isDotDotDotDot) ? node.parameters[index]?.name.info.id : undefined;
		if(param === undefined) {
			return undefined;
		}
		params.push(param);
	}
	return params;
}

/**
 * Whether handing `argument` to `call` forces it. An argument the call passes on is forced exactly as the
 * function receiving it forces the parameter it binds to; a call flowR cannot resolve, and one whose argument
 * it cannot match to a parameter, leave the question open.
 */
function forcedByCallee(call: DataflowGraphVertexFunctionCall, argument: NodeId, idMap: AstIdMap, state: StrictnessState): Ternary {
	const bound = boundParameters(call, argument, idMap, state.graph, state.untargeted);
	return bound === undefined || bound.length === 0 ? Ternary.Maybe : agree(bound.map(param => handedTo(param, state)));
}

/**
 * How surely a read forces its parameter, and, when it is only the branches it sits in that keep it from
 * being certain, those branches: reads that cover every branch between them force the parameter for sure.
 */
interface Forcing {
	readonly value:      Ternary
	readonly onlyUnder?: readonly ControlDependency[]
}

/**
 * How far the given read of a parameter is unavoidable: it has to stand under no condition the definition
 * does not already stand under, must not sit in a function or a default of its own that may never be
 * reached, and must not merely be handed to something that leaves it alone.
 */
function forces(read: NodeId, definition: DataflowGraphVertexFunctionDefinition, state: StrictnessState): Forcing {
	const idMap = state.idMap;
	if(idMap === undefined) {
		return { value: Ternary.Maybe };
	}
	/* the branches the read sits in, and whether anything else keeps it from being certain */
	const conditions: ControlDependency[] = [];
	let lazy = false;
	const verdict = (value: Ternary): Forcing => {
		if(value !== Ternary.Always || (!lazy && conditions.length === 0)) {
			return { value: lazy || conditions.length > 0 ? weaken(value) : value };
		}
		return lazy ? { value: Ternary.Maybe } : { value: Ternary.Maybe, onlyUnder: conditions };
	};
	let child = read;
	let node = idMap.get(read);
	while(node !== undefined && node.info.id !== definition.id) {
		const vertex = state.graph.getVertex(node.info.id);
		for(const cd of conditionsBeyond(vertex?.cds, definition.cds)) {
			const taken = branchTaken(cd, state);
			if(taken === false) {
				return { value: Ternary.Never };
			} else if(taken === undefined && !conditions.some(have => have.id === cd.id && have.when === cd.when)) {
				conditions.push(cd);
			}
		}
		if(node.info.id !== read) {
			if(DfgVertex.isFunctionDefinition(vertex)) {
				/* nothing says the nested definition is ever called */
				lazy = true;
			} else if(RParameter.is(node)) {
				/* a default is evaluated only when the argument is left out */
				lazy = true;
			} else if(DfgVertex.isFunctionCall(vertex) && !isDispatch(vertex) && !isCallee(node.info.id, child, idMap)) {
				if(!isBuiltInCall(vertex)) {
					return verdict(forcedByCallee(vertex, child, idMap, state));
				}
				const index = argumentIndex(vertex, child, idMap);
				const props = argProps(vertex, index, state);
				if((props & NotEvaluated) !== 0) {
					return { value: Ternary.Never };
				} else if((props & ArgProp.Forced) === 0
					&& (hasProcessor(vertex, LazyThroughout) || (index !== 0 && hasProcessor(vertex, LazyAfterFirst)))) {
					lazy = true;
				}
			}
		}
		child = node.info.id;
		node = node.info.parent === undefined ? undefined : idMap.get(node.info.parent);
	}
	return node === undefined ? { value: Ternary.Never } : verdict(Ternary.Always);
}

function strictnessOfParameter(param: NodeId, definition: DataflowGraphVertexFunctionDefinition, state: StrictnessState): Ternary {
	const reads: Ternary[] = [];
	/* the branches of the reads that would be certain but for them, which force the parameter once they cover every branch */
	const branches: ControlDependency[] = [];
	for(const [read, edge] of state.graph.edgesTo(param)) {
		/* a `NextMethod` hands the parameter on unforced, the methods it reaches decide below */
		if(DfEdge.includesType(edge, EdgeType.Reads) && !DfgVertex.hasOrigin(state.graph.getVertex(read), BuiltInProcName.S3DispatchNext)) {
			const forcing = forces(read, definition, state);
			reads.push(forcing.value);
			branches.push(...forcing.onlyUnder ?? []);
		}
	}
	if(branches.length > 0 && happensInEveryBranch(branches)) {
		reads.push(Ternary.Always);
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

/** How many rounds a cycle of definitions gets to settle before all of them answer {@link Ternary#Maybe}. */
const MaxCycleRounds = 8;

function strictnessOf(id: NodeId, state: StrictnessState): FunctionStrictness {
	const known = state.known.get(id) ?? state.provisional.get(id);
	if(known !== undefined) {
		return known;
	}
	const vertex = state.graph.getVertex(id);
	if(!DfgVertex.isFunctionDefinition(vertex)) {
		return { strict: Ternary.Never, parameters: {} };
	}
	const params = Object.keys(vertex.params);
	if(state.asking.has(id)) {
		/*
		 * The answer is the one still being worked out. A cycle starts out assuming every parameter is forced
		 * and is computed again until nothing changes: a run that keeps recursing never returns, so assuming
		 * it forces what it is handed claims nothing about a run that does.
		 */
		state.assumed = true;
		return state.assumptions.get(id) ?? { strict: Ternary.Always, parameters: Object.fromEntries(params.map(param => [param, Ternary.Always])) };
	}
	let result = computeStrictness(id, vertex, params, state);
	if(!state.assumed) {
		state.known.set(id, result);
	} else if(state.asking.size === 0) {
		/* the outermost question of a cycle: compute it again on what the last round gave until it is stable */
		let settled = false;
		for(let round = 0; round < MaxCycleRounds && !settled; round++) {
			const previous = new Map(state.provisional).set(id, result);
			state.assumptions = previous;
			state.provisional.clear();
			state.assumed = false;
			result = computeStrictness(id, vertex, params, state);
			settled = sameStrictness(result, previous.get(id)) && [...state.provisional].every(([other, r]) => sameStrictness(r, previous.get(other)));
		}
		if(settled) {
			/* the fixpoint holds for the whole cycle, so none of it has to be worked out again */
			for(const [other, r] of state.provisional) {
				state.known.set(other, r);
			}
		} else {
			result = { strict: Ternary.Maybe, parameters: Object.fromEntries(params.map(param => [param, Ternary.Maybe])) };
		}
		state.known.set(id, result);
		state.assumptions = new Map();
		state.assumed = false;
		state.provisional.clear();
	} else {
		state.provisional.set(id, result);
	}
	return result;
}

function sameStrictness(a: FunctionStrictness, b: FunctionStrictness | undefined): boolean {
	return b !== undefined && a.strict === b.strict && Object.entries(a.parameters).every(([param, value]) => b.parameters[param as NodeId] === value);
}

function computeStrictness(id: NodeId, vertex: DataflowGraphVertexFunctionDefinition, params: readonly string[], state: StrictnessState): FunctionStrictness {
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
	return { strict: TernaryLogic.and(...Object.values(parameters)), parameters };
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



/** The node directly below `ancestor` on the way up from `id`, if `ancestor` is one of its ancestors. */
function childBelow(id: NodeId, ancestor: NodeId, idMap: AstIdMap): NodeId | undefined {
	let node = idMap.get(id);
	while(node !== undefined && node.info.parent !== ancestor) {
		node = node.info.parent === undefined ? undefined : idMap.get(node.info.parent);
	}
	return node?.info.id;
}

/**
 * Where the promises bound to the parameters may be forced: each read of them, every call of a function nested
 * in the owner of a parameter that reads it (a closure capturing the promise), and, for a read that merely hands
 * the promise on to a function that is not a built-in, that call and where its callee forces it in turn.
 */
function forcingPointsOf(params: readonly NodeId[], graph: DataflowGraph, seen: Set<NodeId> = new Set()): NodeId[] {
	const idMap = graph.idMap;
	const found: NodeId[] = [];
	if(idMap === undefined) {
		return found;
	}
	for(const param of params) {
		if(seen.has(param)) {
			continue;
		}
		seen.add(param);
		const owner = idMap.get(idMap.get(param)?.info.parent ?? -1)?.info.parent;
		for(const [read, edge] of graph.edgesTo(param)) {
			if(!DfEdge.includesType(edge, EdgeType.Reads)) {
				continue;
			}
			found.push(read);
			for(let node = idMap.get(read); node !== undefined && node.info.id !== owner; node = node.info.parent === undefined ? undefined : idMap.get(node.info.parent)) {
				if(RFunctionDefinition.is(node)) {
					found.push(...[...graph.edgesTo(node.info.id)].filter(([, e]) => DfEdge.includesType(e, EdgeType.Calls)).map(([call]) => call));
				}
			}
			/* a read that is an argument hands the promise on */
			for(const [holder, argEdge] of graph.edgesTo(read)) {
				const call = DfEdge.includesType(argEdge, EdgeType.Argument) ? graph.getVertex(holder) : undefined;
				if(DfgVertex.isFunctionCall(call) && !isBuiltInCall(call)) {
					found.push(call.id, ...forcingPointsOf(boundParameters(call, read, idMap, graph) ?? [], graph, seen));
				}
			}
		}
	}
	return found;
}

/** The parameters an argument binds to. */
function boundTo(argument: NodeId, idMap: AstIdMap, graph: DataflowGraph): NodeId[] {
	return [...new Set([argument, argumentValue(argument, idMap)])].flatMap(from => [...graph.edgesFrom(from)]
		.filter(([, e]) => DfEdge.includesType(e, EdgeType.DefinesOnCall))
		.map(([param]) => param));
}

/**
 * What a node within promises depends on for running at all: each promise it sits in names its holder by a
 * `byPromise` control dependency (see {@link ControlFlow.withinPromise}), and the node depends on that holder and on
 * where the promise may be forced: for an argument where the callee forces the parameter it binds to, for a default
 * where its parameter is used.
 * @example
 * ```r
 * g(print(1))  # the print runs only when `g` forces its argument, so it depends on `g(...)` and on the reads of `g`'s parameter
 * ```
 */
export function promiseDependencies(this: void, id: NodeId, graph: DataflowGraph): NodeId[] {
	const idMap = graph.idMap;
	const found: NodeId[] = [];
	for(const cd of graph.getVertex(id)?.cds ?? []) {
		if(cd.byPromise !== true || idMap === undefined) {
			continue;
		}
		const call = graph.getVertex(cd.id);
		if(DfgVertex.isFunctionCall(call)) {
			const argument = childBelow(id, cd.id, idMap);
			found.push(cd.id, ...forcingPointsOf(argument === undefined ? [] : boundParameters(call, argument, idMap, graph) ?? [], graph));
		} else {
			found.push(...forcingPointsOf([cd.id], graph));
		}
	}
	return found;
}

/**
 * How surely the holder of a promise forces it, asked for a node `inner` within the promise: a parameter forces its
 * default as surely as the function forces the parameter, a call its argument as surely as the callee forces the
 * parameter it binds to. The returned function shares the work between its questions.
 */
export function promiseForcing(this: void, graph: DataflowGraph, { ctx }: FunctionStrictnessesOptions = {}): (holder: NodeId, inner: NodeId) => Ternary {
	const idMap = graph.idMap;
	let state: StrictnessState | undefined = undefined;
	return (holder, inner) => {
		if(idMap === undefined) {
			return Ternary.Maybe;
		}
		state ??= makeState(graph, ctx);
		const owner = state.owner.get(holder);
		if(owner !== undefined) {
			return strictnessOf(owner, state).parameters[holder] ?? Ternary.Maybe;
		}
		const call = graph.getVertex(holder);
		const argument = DfgVertex.isFunctionCall(call) && !isBuiltInCall(call) ? childBelow(inner, holder, idMap) : undefined;
		return DfgVertex.isFunctionCall(call) && argument !== undefined ? forcedByCallee(call, argument, idMap, state) : Ternary.Maybe;
	};
}

/**
 * Settles the jumps {@link ControlFlow.promise} left open once the calls are linked: a jump within a promise
 * (an argument handed to a function, or a default) stays an exit under a `byPromise` dependency on its holder and may
 * resume at the holder as well, which it no longer does when the receiver surely forces the promise.
 * Calls of built-ins are left alone, what they force is stated by their signature.
 * @param graph    - the linked dataflow graph, updated in place
 * @param topLevel - the exit points of the program, outside of any function definition
 */
export function settleJumpsInPromises(this: void, graph: DataflowGraph, topLevel: readonly ExitPoint[], { ctx }: FunctionStrictnessesOptions = {}): void {
	const idMap = graph.idMap;
	if(idMap === undefined) {
		return;
	}
	const forcing = promiseForcing(graph, { ctx });
	const settle = (exits: readonly ExitPoint[]) => {
		for(const exit of exits) {
			for(const cd of exit.cds ?? []) {
				if(cd.byPromise === true && forcing(cd.id, exit.nodeId) === Ternary.Always) {
					graph.removeEdgeType(exit.nodeId, cd.id, EdgeType.FlowEdge);
				}
			}
		}
	};
	settle(topLevel);
	for(const [, definition] of graph.verticesOfType(VertexType.FunctionDefinition)) {
		settle(definition.exitPoints);
	}
}
