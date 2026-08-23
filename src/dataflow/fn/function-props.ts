import type { DataflowGraph } from '../graph/graph';
import { NoEdges } from '../graph/graph';
import { DfEdge, EdgeType } from '../graph/edge';
import type { DataflowGraphVertexFunctionCall, DataflowGraphVertexFunctionDefinition } from '../graph/vertex';
import { FunctionCallVertex, FunctionDefinitionVertex } from '../graph/vertex';
import type { BuiltInFnInfo, CallProps } from '../environments/built-in-props';
import { ArgProp, CallProp, DispatchCallees, FnSig as Sig, PropagatedProps } from '../environments/built-in-props';
import { BuiltInIndex, queryFnProps } from '../environments/query-fn-props';
import { Identifier } from '../environments/identifier';
import type { ReadOnlyFlowrAnalyzerContext } from '../../project/context/flowr-analyzer-context';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { happensInEveryBranch } from '../info';

/**
 * What each definition in `ids` does, stated the way a built-in states it. Only what the body shows is claimed,
 * so an unset bit reads as "nothing says so" rather than "no": nothing here says a function is
 * {@link CallProp.Pure}, as that would take knowing every call it makes.
 *
 * Three things are read off the body. What its calls do it does too, for the bits that carry over
 * ({@link PropagatedProps}): a body calling `runif` is {@link CallProp.Random}, one calling `read.csv` reads a
 * file, and one binding only its own locals changes no scope (see {@link bindsOutside}). A body that dispatches
 * (`UseMethod`, `standardGeneric`) is a {@link CallProp.Generic}. And a body whose result always comes from a
 * call returning invisibly is {@link CallProp.Invisible} in turn, which is what makes
 * `f <- function(x) invisible(x)` print nothing at the top level.
 * @useInstead {@link FunctionProps.of}
 */
function propsOfFunctions(this: void, ids: Iterable<NodeId>, graph: DataflowGraph, ctx?: ReadOnlyFlowrAnalyzerContext): Record<NodeId, CallProps> {
	const state = makeState(graph, ctx);
	const all: Record<NodeId, CallProps> = {};
	for(const id of ids) {
		const props = propsOf(id, state);
		if(props !== 0) {
			all[id] = props;
		}
	}
	return all;
}

/**
 * What the functions of a program do, inferred from what their bodies show.
 */
export const FunctionProps = {
	name: 'FunctionProps',
	/** What several definitions do, sharing the built-in lookups; see {@link propsOfFunctions}. */
	of:   propsOfFunctions
} as const;

/** What one run carries along, so the built-in lookups are shared between the definitions it answers. */
interface PropsState {
	readonly graph: DataflowGraph
	readonly known: Map<string, BuiltInFnInfo | undefined>
	readonly info:  (name: Identifier) => BuiltInFnInfo | undefined
}

function makeState(graph: DataflowGraph, ctx: ReadOnlyFlowrAnalyzerContext | undefined): PropsState {
	const environment = ctx?.env.makeCleanEnv();
	const info = environment === undefined
		? (name: Identifier) => BuiltInIndex.default().get(name)
		: (name: Identifier) => queryFnProps(name, { environment });
	return { graph, known: new Map(), info };
}

/** What flowR states about the built-in of that name, asked once per name. */
function infoOf(name: Identifier, state: PropsState): BuiltInFnInfo | undefined {
	const key = Identifier.getName(name);
	if(!state.known.has(key)) {
		state.known.set(key, state.info(name));
	}
	return state.known.get(key);
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
		const info = infoOf(vertex.name, state);
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
	if(FunctionCallVertex.is(vertex) && ((infoOf(vertex.name, state)?.props ?? 0) & CallProp.Invisible) !== 0) {
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
