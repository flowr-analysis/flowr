/**
 * The `Fn` facade wires these together, so a sibling here has to call the backing function
 * directly; going through `Fn` would make `src/dataflow/fn/fn.ts` import its own importers.
 * @lintIgnore use-instead
 */
import type { DataflowGraph } from '../graph/graph';
import { EdgeType } from '../graph/edge';
import type { DataflowGraphVertexFunctionCall, DataflowGraphVertexFunctionDefinition } from '../graph/vertex';
import { Vertex } from '../graph/vertex';
import type { BuiltInFnInfo, StatedProps } from '../environments/built-in-props';
import { ArgProp, CallProp, CallProps, DispatchCallees, FnSig as Sig, PropagatedProps } from '../environments/built-in-props';
import { builtInLookup } from '../environments/query-fn-props';
import { Identifier } from '../environments/identifier';
import type { ReadOnlyFlowrAnalyzerContext } from '../../project/context/flowr-analyzer-context';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { happensInEveryBranch } from '../info';
import { strictnessOfEach } from './strict-function';
import { argumentRolesOfFunctions, type ArgumentRolesOptions, type FunctionArgumentRoles, type LookupState } from './argument-roles';
import { callsIn, edgeTargets, propagateToFixpoint } from './frame-reflection';
import type { FunctionStrictness } from './strict-function';
import { Ternary } from '../../util/logic';

/** @see {@link propagateToFixpoint}, re-exported from where it lives so nothing importing it from here needs to change. */
export { propagateToFixpoint };

/** What flowR infers about a set of definitions, see {@link inferFunctions}. */
export interface InferredFunctions {
	/** per definition, what its body states about the function itself */
	readonly props: Record<NodeId, StatedProps>
	/** per definition, the {@link ArgProp} mask of each formal that carries one */
	readonly roles: Record<NodeId, FunctionArgumentRoles>
}

/** What to ask for beyond the definitions themselves, see {@link inferFunctions}. */
export interface FunctionPropsOptions extends ArgumentRolesOptions {
	/** infer only what the formals do, or only what the function does; both when left out */
	readonly only?: 'arguments' | 'function'
}

/**
 * What each of the `definitions` does, stated the way a built-in states it: {@link CallProp} bits for the
 * function ({@link PropagatedProps} bits its callees carry over included) and {@link ArgProp} bits per formal,
 * `Forced`/`Lazy` included. An unset bit reads as "nothing says so", never as "no".
 * @useInstead {@link Fn.props}
 */
export function inferFunctions(this: void, definitions: readonly NodeId[], graph: DataflowGraph, options: FunctionPropsOptions = {}): InferredFunctions {
	const { ctx, only } = options;
	const strict = strictnessOfEach(definitions, graph, { ctx });
	return {
		props: only === 'arguments' ? {} : callProps(definitions, graph, strict, ctx),
		roles: only === 'function' ? {} : argumentProps(definitions, graph, strict, options)
	};
}

/** The {@link CallProp} mask of each definition, `Strict` included and what its callees carry mixed in. */
function callProps(definitions: readonly NodeId[], graph: DataflowGraph, strict: Record<NodeId, FunctionStrictness>, ctx: ReadOnlyFlowrAnalyzerContext | undefined): Record<NodeId, StatedProps> {
	const state = makeState(graph, ctx);
	const props = new Map<NodeId, StatedProps>();
	const callees = new Map<NodeId, readonly NodeId[]>();
	/* a callee is asked about as well, whether or not it is one of the definitions to answer for */
	const toVisit = [...definitions];
	while(toVisit.length > 0) {
		const id = toVisit.pop() as NodeId;
		if(props.has(id)) {
			continue;
		}
		const own = propsOf(id, state);
		props.set(id, strict[id]?.strict === Ternary.Always ? CallProps.join(own.stated, { props: CallProp.Strict }) : own.stated);
		callees.set(id, own.callees);
		toVisit.push(...own.callees);
	}
	propagateOverCalls(props, callees);
	const all: Record<NodeId, StatedProps> = {};
	for(const id of definitions) {
		const found = props.get(id);
		if(CallProps.hasAny(found)) {
			all[id] = found as StatedProps;
		}
	}
	return all;
}

/** Hands {@link PropagatedProps} on to callers until nothing changes, so a chain of calls carries them however long it is. */
function propagateOverCalls(props: Map<NodeId, StatedProps>, callees: ReadonlyMap<NodeId, readonly NodeId[]>): void {
	propagateToFixpoint(callees.keys(), callees, id => {
		const before = props.get(id);
		let grown = before ?? {};
		for(const callee of callees.get(id) ?? []) {
			grown = CallProps.join(grown, CallProps.filter(props.get(callee), PropagatedProps));
		}
		/* joining only ever adds, so nothing new means the same bits and the same number of tags */
		if((grown.props ?? 0) === (before?.props ?? 0) && (grown.tags?.length ?? 0) === (before?.tags?.length ?? 0)) {
			return false;
		}
		props.set(id, grown);
		return true;
	});
}

/** The {@link ArgProp} mask of each formal, `Forced`/`Lazy` included. */
function argumentProps(definitions: readonly NodeId[], graph: DataflowGraph, strict: Record<NodeId, FunctionStrictness>, options: ArgumentRolesOptions): Record<NodeId, FunctionArgumentRoles> {
	const all: Record<NodeId, FunctionArgumentRoles> = { ...argumentRolesOfFunctions(definitions, graph, options) };
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


function makeState(graph: DataflowGraph, ctx: ReadOnlyFlowrAnalyzerContext | undefined): LookupState {
	return { graph, info: builtInLookup(ctx) };
}

/** What one definition states about itself, together with the definitions its body calls. */
interface OwnProps {
	readonly stated:  StatedProps
	/** the definitions of the program its body calls, whose props it carries as well */
	readonly callees: readonly NodeId[]
}

function propsOf(id: NodeId, state: LookupState): OwnProps {
	const definition = state.graph.getVertex(id);
	if(!Vertex.isFunctionDefinition(definition)) {
		return { stated: {}, callees: [] };
	}
	let stated: StatedProps = {};
	const callees: NodeId[] = [];
	for(const [node, vertex] of callsIn(definition, state.graph)) {
		const info = state.info(vertex.name);
		const carried = CallProps.filter(info, PropagatedProps);
		stated = CallProps.join(stated, {
			props: (carried.props ?? 0) & (bindsOutside(vertex, info) ? ~0 : ~CallProp.Scope),
			tags:  carried.tags
		});
		if(DispatchCallees.has(Identifier.getName(vertex.name))) {
			stated = CallProps.join(stated, { props: CallProp.Generic });
		}
		callees.push(...calledDefinitions(node, state));
	}
	if(returnsInvisibly(definition, state)) {
		stated = CallProps.join(stated, { props: CallProp.Invisible });
	}
	return { stated, callees };
}

/** The definitions of the program the call resolved to, which are the ones stating what the call does. */
function calledDefinitions(node: NodeId, state: LookupState): NodeId[] {
	return edgeTargets(state.graph, node, EdgeType.Calls).filter(target => Vertex.isFunctionDefinition(state.graph.getVertex(target)));
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
function returnsInvisibly(definition: DataflowGraphVertexFunctionDefinition, state: LookupState): boolean {
	const unconditional = definition.exitPoints.filter(e => happensInEveryBranch(e.cds)).map(e => e.nodeId);
	return unconditional.length > 0 && unconditional.every(node => yieldsInvisibly(node, state, 0));
}

/** How far the result is followed through the blocks and `return`s wrapping it. */
const MaxDepth = 6;

function yieldsInvisibly(node: NodeId, state: LookupState, depth: number): boolean {
	const vertex = state.graph.getVertex(node);
	if(Vertex.isFunctionCall(vertex) && ((state.info(vertex.name)?.props ?? 0) & CallProp.Invisible) !== 0) {
		return true;
	}
	if(depth >= MaxDepth) {
		return false;
	}
	/* a block hands back its last expression and `return(x)` what it was given, so what they yield decides */
	const returns = edgeTargets(state.graph, node, EdgeType.Returns);
	return returns.length > 0 && returns.every(target => yieldsInvisibly(target, state, depth + 1));
}
