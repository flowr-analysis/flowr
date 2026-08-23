import type { DataflowGraph } from '../graph/graph';
import { NoEdges } from '../graph/graph';
import { DfEdge, EdgeType } from '../graph/edge';
import type { DataflowGraphVertexFunctionCall, DataflowGraphVertexFunctionDefinition } from '../graph/vertex';
import { FunctionCallVertex, FunctionDefinitionVertex } from '../graph/vertex';
import type { BuiltInFnInfo, CallProps } from '../environments/built-in-props';
import type { BuiltInLookup } from './frame-reflection';
import { ArgProp, CallProp, DispatchCallees, FnSig as Sig, PropagatedProps } from '../environments/built-in-props';
import { builtInLookup } from '../environments/query-fn-props';
import { Identifier } from '../environments/identifier';
import type { ReadOnlyFlowrAnalyzerContext } from '../../project/context/flowr-analyzer-context';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { happensInEveryBranch } from '../info';
import { strictnessOfFunctions } from './strict-function';
import { ArgumentRoles, type ArgumentRolesOptions, type FunctionArgumentRoles } from './argument-roles';
import type { FunctionStrictness } from './strict-function';
import { Ternary } from '../../util/logic';

/** What flowR infers about a set of definitions, see {@link FunctionProps.of}. */
export interface InferredFunctions {
	/** per definition, the {@link CallProp} mask its body states about the function itself */
	readonly props: Record<NodeId, CallProps>
	/** per definition, the {@link ArgProp} mask of each formal that carries one */
	readonly roles: Record<NodeId, FunctionArgumentRoles>
}

/** What to ask for beyond the definitions themselves, see {@link FunctionProps.of}. */
export interface FunctionPropsOptions extends ArgumentRolesOptions {
	/** infer only what the formals do, or only what the function does; both when left out */
	readonly only?: 'arguments' | 'function'
}

/**
 * What each of the `definitions` does, stated the way a built-in states it: {@link CallProp} bits for the
 * function, {@link ArgProp} bits for each of its formals. Only what the body shows is claimed, so an unset bit
 * reads as "nothing says so" rather than "no": nothing here says a function is {@link CallProp.Pure}, as that
 * would take knowing every call it makes.
 *
 * What its calls do it does too, for the bits that carry over ({@link PropagatedProps}): a body calling `runif`
 * is {@link CallProp.Random}, one calling `read.csv` reads a file, and one binding only its own locals changes
 * no scope (see {@link bindsOutside}). A body that dispatches is a {@link CallProp.Generic}, and one whose
 * result always comes from a call returning invisibly is {@link CallProp.Invisible} in turn.
 *
 * The formals carry the roles {@link ArgumentRoles.of} reads off the body, plus whether they are evaluated at
 * all: {@link ArgProp.Forced} when every call does, {@link ArgProp.Lazy} when none can, neither when it depends
 * on the path taken, on the caller, or on a function flowR cannot resolve. A function forcing every one of them
 * is {@link CallProp.Strict}. Asking for one half alone skips the other walk, but never the strictness both
 * rest on.
 * @useInstead {@link FunctionProps.of}
 */
function inferFunctions(this: void, definitions: readonly NodeId[], graph: DataflowGraph, options: FunctionPropsOptions = {}): InferredFunctions {
	const { ctx, only } = options;
	const strict = strictnessOfFunctions(definitions, graph, ctx);
	return {
		props: only === 'arguments' ? {} : callProps(definitions, graph, strict, ctx),
		roles: only === 'function' ? {} : argumentProps(definitions, graph, strict, options)
	};
}

/** The {@link CallProp} mask of each definition, `Strict` included. */
function callProps(definitions: readonly NodeId[], graph: DataflowGraph, strict: Record<NodeId, FunctionStrictness>, ctx: ReadOnlyFlowrAnalyzerContext | undefined): Record<NodeId, CallProps> {
	const state = makeState(graph, ctx);
	const all: Record<NodeId, CallProps> = {};
	for(const id of definitions) {
		const props = propsOf(id, state) | (strict[id]?.strict === Ternary.Always ? CallProp.Strict : 0);
		if(props !== 0) {
			all[id] = props;
		}
	}
	return all;
}

/** The {@link ArgProp} mask of each formal, `Forced`/`Lazy` included. */
function argumentProps(definitions: readonly NodeId[], graph: DataflowGraph, strict: Record<NodeId, FunctionStrictness>, options: ArgumentRolesOptions): Record<NodeId, FunctionArgumentRoles> {
	const all: Record<NodeId, FunctionArgumentRoles> = { ...ArgumentRoles.of(definitions, graph, options) };
	for(const [id, { parameters }] of Object.entries(strict)) {
		const roles: FunctionArgumentRoles = { ...all[id] };
		for(const [formal, forced] of Object.entries(parameters)) {
			const bit = forced === Ternary.Always ? ArgProp.Forced : forced === Ternary.Never ? ArgProp.Lazy : 0;
			if(bit !== 0) {
				roles[formal] = (roles[formal] ?? 0) | bit;
			}
		}
		if(Object.keys(roles).length > 0) {
			all[id] = roles;
		}
	}
	return all;
}

/**
 * What the functions of a program do, inferred from what their bodies show.
 */
export const FunctionProps = {
	name: 'FunctionProps',
	/** What several definitions and their formals do; see {@link inferFunctions}. */
	of:   inferFunctions
} as const;

/** What one run carries along, so the built-in lookups are shared between the definitions it answers. */
interface PropsState {
	readonly graph: DataflowGraph
	/** what flowR states about a built-in, answered once per name */
	readonly info:  BuiltInLookup
}

function makeState(graph: DataflowGraph, ctx: ReadOnlyFlowrAnalyzerContext | undefined): PropsState {
	return { graph, info: builtInLookup(ctx) };
}

function propsOf(id: NodeId, state: PropsState): CallProps {
	const definition = state.graph.getVertex(id);
	if(!FunctionDefinitionVertex.is(definition)) {
		return 0;
	}
	let props = 0;
	for(const node of definition.subflow.graph) {
		const vertex = state.graph.getVertex(node);
		if(!FunctionCallVertex.is(vertex)) {
			continue;
		}
		const info = state.info(vertex.name);
		props |= (info?.props ?? 0) & PropagatedProps & (bindsOutside(vertex, info) ? ~0 : ~CallProp.Scope);
		if(DispatchCallees.has(Identifier.getName(vertex.name))) {
			props |= CallProp.Generic;
		}
	}
	return props | (returnsInvisibly(definition, state) ? CallProp.Invisible : 0);
}

/** the assignments binding in the frame they run in, which is a scope of the function's own */
const FrameLocalBinders: ReadonlySet<string> = new Set(['<-', '=', '->', ':=', 'assign']);

/**
 * Whether the call binds a name beyond the frame it runs in, which is what makes it a {@link CallProp.Scope}
 * for the function around it. `y <- 1` binds a local and changes no scope of anyone else, while `y <<- 1`,
 * `library(x)` and an `assign` handed an environment ({@link ArgProp.Written}) do.
 */
function bindsOutside(vertex: DataflowGraphVertexFunctionCall, info: BuiltInFnInfo | undefined): boolean {
	if(!FrameLocalBinders.has(Identifier.getName(vertex.name))) {
		return true;
	}
	const layout = info?.sig === undefined ? undefined : Sig.layout(info.sig);
	return layout !== undefined && Sig.posWith(layout, vertex.args.length, ArgProp.Written).length > 0;
}

/**
 * Whether every path out of the definition ends in a call that returns invisibly. An exit only some path takes
 * says nothing about what the function hands back, so those are not counted, and a definition whose result is a
 * value of its own (`function() 1`) has no such call to speak for it.
 */
function returnsInvisibly(definition: DataflowGraphVertexFunctionDefinition, state: PropsState): boolean {
	const unconditional = definition.exitPoints.filter(e => happensInEveryBranch(e.cds)).map(e => e.nodeId);
	return unconditional.length > 0 && unconditional.every(node => yieldsInvisibly(node, state, 0));
}

/** How far the result is followed through the blocks and `return`s wrapping it. */
const MaxDepth = 6;

function yieldsInvisibly(node: NodeId, state: PropsState, depth: number): boolean {
	const vertex = state.graph.getVertex(node);
	if(FunctionCallVertex.is(vertex) && ((state.info(vertex.name)?.props ?? 0) & CallProp.Invisible) !== 0) {
		return true;
	}
	if(depth >= MaxDepth) {
		return false;
	}
	/* a block hands back its last expression and `return(x)` what it was given, so what they yield decides */
	const returns = [...state.graph.outgoingEdges(node) ?? NoEdges]
		.filter(([, edge]) => DfEdge.includesType(edge, EdgeType.Returns))
		.map(([target]) => target);
	return returns.length > 0 && returns.every(target => yieldsInvisibly(target, state, depth + 1));
}
