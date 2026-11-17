/**
 * The `FunctionSemantics` facade wires these together, so a sibling here has to call the backing function directly; going through `FunctionSemantics` would make `src/dataflow/fn/function-semantics.ts` import its own importers.
 * @lintIgnore use-instead
 */
import type { DataflowGraph } from '../graph/graph';
import { FunctionSemantics } from './function-semantics';
import { EdgeType } from '../graph/edge';
import { type DataflowGraphVertexFunctionCall, type DataflowGraphVertexFunctionDefinition, DfgVertex } from '../graph/vertex';
import { BuiltInProcName } from '../environments/built-in-proc-name';
import { NativeRoutines } from '../../project/sigdb/native-routines';
import type { SigNativeRoutineInfo } from '../../project/sigdb/schema';
import { type BuiltInFnInfo, type StatedProps, ArgProp, CallProp, DispatchCallees, PropagatedProps, PureCarriedProps } from '../environments/built-in-props';
import { builtInLookup } from '../environments/query-fn-props';
import { Identifier } from '../environments/identifier';
import { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { RSymbol } from '../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import { happensInEveryBranch } from '../info';
import { strictnessOfEach, type FunctionStrictness } from './strict-function';
import { argumentRolesOfFunctions, type ArgumentRolesOptions, type FunctionArgumentRoles, type LookupState } from './argument-roles';
import { bindsOutside } from './frame-reflection';
import { guardRoles, Steering } from './guards/function-guards';
import { Ternary } from '../../util/logic';
import { memoize } from '../../util/collections/defaultmap';
import { Dataflow } from '../graph/df-helper';
import { ReachSummaries } from '../../util/fixpoint';

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
 * What each of the `definitions` does, stated the way a built-in states it: {@link CallProp} bits for the function ({@link PropagatedProps} bits its callees carry over included) and {@link ArgProp} bits per formal, `Forced`/`Lazy` included.
 * @useInstead {@link FunctionSemantics.props}
 */
export function inferFunctions(this: void, definitions: readonly NodeId[], graph: DataflowGraph, options: FunctionPropsOptions = {}): InferredFunctions {
	const { ctx, only, natives = ctx === undefined ? [] : NativeRoutines.ofProject(ctx) } = options;
	const strict = strictnessOfEach(definitions, graph, { ctx });
	const info = builtInLookup(ctx);
	return {
		props: only === 'arguments' ? {} : callProps(definitions, { graph, info, routineOf: NativeRoutines.lookup(natives, graph, info, ctx) }, strict),
		roles: only === 'function' ? {} : rolesOfDefinitions(definitions, graph, strict, options)
	};
}

/** What {@link callProps} asks: what a built-in states, and which native routine a call runs. */
interface PropsState extends LookupState {
	readonly routineOf: (vertex: DataflowGraphVertexFunctionCall) => SigNativeRoutineInfo | undefined
}

/** The {@link CallProp} mask of each definition, `Strict` included, what its callees carry mixed in, and `Pure` if everything it reaches only computes. */
function callProps(definitions: readonly NodeId[], state: PropsState, strict: Record<NodeId, FunctionStrictness>): Record<NodeId, StatedProps> {
	const { join, filter, hasAny } = FunctionSemantics.call.props;
	/* a callee is asked about as well, whether or not it is one of the definitions to answer for */
	const own = memoize((id: NodeId) => {
		const of = propsOf(id, state);
		return { ...of, stated: strict[id]?.strict === Ternary.Always ? join(of.stated, { props: CallProp.Strict }) : of.stated };
	});
	/* what a function carries over to its callers: its own propagated props and those of everything it reaches */
	const carried = new ReachSummaries<NodeId, StatedProps>(id => own(id).callees, id => filter(own(id).stated, PropagatedProps), { empty: {}, concat: join });
	const impure = new ReachSummaries<NodeId, boolean>(id => own(id).callees, id => own(id).impure, { empty: false, concat: (a, b) => a || b });
	return Object.fromEntries(definitions.map(id => {
		const mine = own(id).stated;
		const grown = join(join(mine, carried.of(id)), impure.of(id) ? {} : { props: CallProp.Pure });
		return [id, sameProps(grown, mine) ? mine : grown] as const;
	}).filter(([, props]) => hasAny(props)));
}

/** Joining only ever adds, so the same bits and the same number of tags mean the same props. */
function sameProps(a: StatedProps, b: StatedProps): boolean {
	return (a.props ?? 0) === (b.props ?? 0) && (a.tags?.length ?? 0) === (b.tags?.length ?? 0);
}

/** The {@link ArgProp} mask of each formal, `Forced`/`Lazy` included. */
function rolesOfDefinitions(definitions: readonly NodeId[], graph: DataflowGraph, strict: Record<NodeId, FunctionStrictness>, options: ArgumentRolesOptions): Record<NodeId, FunctionArgumentRoles> {
	const all: Record<NodeId, FunctionArgumentRoles> = { ...argumentRolesOfFunctions(definitions, graph, options) };
	for(const [id, bits] of Object.entries(guardRoles(definitions, graph, options))) {
		const roles: FunctionArgumentRoles = { ...all[id] };
		for(const [formal, bit] of Object.entries(bits)) {
			roles[formal] = (roles[formal] ?? 0) | bit;
		}
		all[id] = roles;
	}
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

/** What one definition states about itself, together with the definitions its body calls. */
interface OwnProps {
	readonly stated:  StatedProps
	/** the definitions of the program its body calls, whose props it carries as well */
	readonly callees: readonly NodeId[]
	/** a call of the body does more than compute, or runs what flowR does not know */
	readonly impure:  boolean
}

/** Whether the call only computes its value, the definitions of the program it runs aside: a pure built-in or native routine, a binding in its own frame, or steering. */
function onlyComputes(vertex: DataflowGraphVertexFunctionCall, info: BuiltInFnInfo | undefined, state: PropsState): boolean {
	if(DfgVertex.hasOrigin(vertex, BuiltInProcName.Assignment)) {
		return !bindsOutside(vertex, info);
	}
	return Steering.some(proc => DfgVertex.hasOrigin(vertex, proc)) || FunctionSemantics.call.props.hasAny(info, CallProp.Pure) || state.routineOf(vertex)?.pure === true;
}

function propsOf(id: NodeId, state: PropsState): OwnProps {
	const { join, filter } = FunctionSemantics.call.props;
	const definition = state.graph.getVertex(id);
	if(!DfgVertex.isFunctionDefinition(definition)) {
		return { stated: {}, callees: [], impure: true };
	}
	let stated: StatedProps = {};
	let impure = false;
	const formals = new Set(Object.keys(definition.params).map(id => {
		const name = state.graph.idMap?.get(NodeId.normalize(id));
		return RSymbol.is(name) ? String(Identifier.getName(name.content)) : undefined;
	}));
	const callees: NodeId[] = [];
	for(const [node, vertex] of Dataflow.callsIn(definition, state.graph)) {
		const info = state.info(vertex.name);
		const routine = state.routineOf(vertex);
		/* a pure routine has no effect, one starting threads or forking runs concurrently */
		const carried = filter(info, routine?.pure ? PureCarriedProps : PropagatedProps);
		stated = join(stated, { props: (carried.props ?? 0) & (bindsOutside(vertex, info) ? ~0 : ~CallProp.Scope) | (NativeRoutines.concurrent(routine) ? CallProp.Concurrent : 0), tags: carried.tags });
		if(DispatchCallees.has(Identifier.getName(vertex.name))) {
			stated = join(stated, { props: CallProp.Generic });
		}
		const ran = Dataflow.calleeIdsOf(state.graph, node);
		/* calling a formal runs whatever a caller hands over, so it is pure only as far as that is, which the definition alone cannot tell */
		impure ||= formals.has(String(Identifier.getName(vertex.name))) || (ran.length === 0 && !onlyComputes(vertex, info, state));
		callees.push(...ran);
	}
	if(exitsInvisibly(definition, state)) {
		stated = join(stated, { props: CallProp.Invisible });
	}
	return { stated, callees, impure };
}

/** Whether every unconditional exit ends in a call returning invisibly; a bare value result (`function() 1`) never does. */
function exitsInvisibly(definition: DataflowGraphVertexFunctionDefinition, state: LookupState): boolean {
	const unconditional = definition.exitPoints.filter(e => happensInEveryBranch(e.cds)).map(e => e.nodeId);
	return unconditional.length > 0 && unconditional.every(node => yieldsInvisibly(node, state));
}

/** How far the result is followed through the blocks and `return`s wrapping it. */
const MaxDepth = 6;

function yieldsInvisibly(node: NodeId, state: LookupState, depth = 0): boolean {
	const vertex = state.graph.getVertex(node);
	if(DfgVertex.isFunctionCall(vertex) && ((state.info(vertex.name)?.props ?? 0) & CallProp.Invisible) !== 0) {
		return true;
	}
	if(depth >= MaxDepth) {
		return false;
	}
	/* a block hands back its last expression and `return(x)` what it was given, so what they yield decides */
	const returns = Dataflow.targetsOf(state.graph, node, EdgeType.Returns);
	return returns.length > 0 && returns.every(target => yieldsInvisibly(target, state, depth + 1));
}
