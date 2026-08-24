import type { DataflowGraph } from '../graph/graph';
import { NoEdges } from '../graph/graph';
import { DfEdge, EdgeType } from '../graph/edge';
import type { DataflowGraphVertexFunctionCall, DataflowGraphVertexFunctionDefinition } from '../graph/vertex';
import { FunctionCallVertex, FunctionDefinitionVertex } from '../graph/vertex';
import type { BuiltInFnInfo, CallProps } from '../environments/built-in-props';
import { ArgProp, CallProp, DispatchCallees, FnSig as Sig, PropagatedProps } from '../environments/built-in-props';
import { builtInLookup } from '../environments/query-fn-props';
import { Identifier } from '../environments/identifier';
import type { ReadOnlyFlowrAnalyzerContext } from '../../project/context/flowr-analyzer-context';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { happensInEveryBranch } from '../info';
import { strictnessOfFunctions } from './strict-function';
import { ArgumentRoles, type ArgumentRolesOptions, type FunctionArgumentRoles, type LookupState } from './argument-roles';
import type { FunctionStrictness } from './strict-function';
import { Ternary } from '../../util/logic';
import { DefaultMap } from '../../util/collections/defaultmap';

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
 * function ({@link PropagatedProps} bits its callees carry over included) and {@link ArgProp} bits per formal,
 * `Forced`/`Lazy` included. An unset bit reads as "nothing says so", never as "no".
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

/** The {@link CallProp} mask of each definition, `Strict` included and what its callees carry mixed in. */
function callProps(definitions: readonly NodeId[], graph: DataflowGraph, strict: Record<NodeId, FunctionStrictness>, ctx: ReadOnlyFlowrAnalyzerContext | undefined): Record<NodeId, CallProps> {
	const state = makeState(graph, ctx);
	const props = new Map<NodeId, CallProps>();
	const callees = new Map<NodeId, readonly NodeId[]>();
	/* a callee is asked about as well, whether or not it is one of the definitions to answer for */
	const toVisit = [...definitions];
	while(toVisit.length > 0) {
		const id = toVisit.pop() as NodeId;
		if(props.has(id)) {
			continue;
		}
		const own = propsOf(id, state);
		props.set(id, own.props | (strict[id]?.strict === Ternary.Always ? CallProp.Strict : 0));
		callees.set(id, own.callees);
		toVisit.push(...own.callees);
	}
	propagateOverCalls(props, callees);
	const all: Record<NodeId, CallProps> = {};
	for(const id of definitions) {
		const found = props.get(id) ?? 0;
		if(found !== 0) {
			all[id] = found;
		}
	}
	return all;
}

/** Hands {@link PropagatedProps} on to callers until nothing changes, so a chain of calls carries them however long it is. */
function propagateOverCalls(props: Map<NodeId, CallProps>, callees: ReadonlyMap<NodeId, readonly NodeId[]>): void {
	propagateToFixpoint(callees.keys(), callees, id => {
		const before = props.get(id) ?? 0;
		let grown = before;
		for(const callee of callees.get(id) ?? []) {
			grown |= (props.get(callee) ?? 0) & PropagatedProps;
		}
		if(grown === before) {
			return false;
		}
		props.set(id, grown);
		return true;
	});
}

/**
 * Recomputes `recompute(id)` for every node reachable from `seed` along the reverse of `successors`, so a
 * change at a node is carried on to whatever points at it, until nothing grows anymore. `recompute` updates
 * its node's value itself and reports whether it grew; shared by {@link propagateOverCalls} and
 * {@link calculateExceptionsOfFunction}, which differ only in what "grew" means for the value they carry.
 */
export function propagateToFixpoint(seed: Iterable<NodeId>, successors: ReadonlyMap<NodeId, readonly NodeId[]>, recompute: (id: NodeId) => boolean): void {
	const callers = new DefaultMap<NodeId, NodeId[]>(() => []);
	for(const [id, next] of successors) {
		for(const to of next) {
			callers.get(to).push(id);
		}
	}
	const pending = [...seed];
	const queued = new Set<NodeId>(pending);
	while(pending.length > 0) {
		const id = pending.pop() as NodeId;
		queued.delete(id);
		if(!recompute(id)) {
			continue;
		}
		for(const caller of callers.get(id)) {
			if(!queued.has(caller)) {
				queued.add(caller);
				pending.push(caller);
			}
		}
	}
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

/** What the functions of a program do, inferred from what their bodies show. */
export const FunctionProps = {
	name: 'FunctionProps',
	/** What several definitions and their formals do; see {@link inferFunctions}. */
	of:   inferFunctions
} as const;

/** @see {@link LookupState} */
type PropsState = LookupState;

function makeState(graph: DataflowGraph, ctx: ReadOnlyFlowrAnalyzerContext | undefined): PropsState {
	return { graph, info: builtInLookup(ctx) };
}

/** What one definition states about itself, together with the definitions its body calls. */
interface OwnProps {
	readonly props:   CallProps
	/** the definitions of the program its body calls, whose props it carries as well */
	readonly callees: readonly NodeId[]
}

function propsOf(id: NodeId, state: PropsState): OwnProps {
	const definition = state.graph.getVertex(id);
	if(!FunctionDefinitionVertex.is(definition)) {
		return { props: 0, callees: [] };
	}
	let props = 0;
	const callees: NodeId[] = [];
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
		callees.push(...calledDefinitions(node, state));
	}
	return { props: props | (returnsInvisibly(definition, state) ? CallProp.Invisible : 0), callees };
}

/** The definitions of the program the call resolved to, which are the ones stating what the call does. */
function calledDefinitions(node: NodeId, state: PropsState): NodeId[] {
	const called: NodeId[] = [];
	for(const [target, edge] of state.graph.outgoingEdges(node) ?? NoEdges) {
		if(DfEdge.includesType(edge, EdgeType.Calls) && FunctionDefinitionVertex.is(state.graph.getVertex(target))) {
			called.push(target);
		}
	}
	return called;
}

/** the assignments binding in the frame they run in, which is a scope of the function's own */
const FrameLocalBinders: ReadonlySet<string> = new Set(['<-', '=', '->', ':=', 'assign']);

/** Whether the name is a replacement function binding in its own frame (`names(x) <- v`); the `<<-` twin does not. */
function isFrameLocalReplacement(name: string): boolean {
	return name.endsWith('<-') && !name.endsWith('<<-');
}

/** Whether the call binds a name beyond its own frame ({@link CallProp.Scope}): `y <<- 1`, `library(x)`, `assign` to an env do; `y <- 1` does not. */
function bindsOutside(vertex: DataflowGraphVertexFunctionCall, info: BuiltInFnInfo | undefined): boolean {
	const name = Identifier.getName(vertex.name);
	if(!FrameLocalBinders.has(name) && !isFrameLocalReplacement(name)) {
		return true;
	}
	const layout = info?.sig === undefined ? undefined : Sig.layout(info.sig);
	return layout !== undefined && Sig.posWith(layout, vertex.args.length, ArgProp.Written).length > 0;
}

/** Whether every unconditional exit ends in a call returning invisibly; a bare value result (`function() 1`) never does. */
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
