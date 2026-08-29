/**
 * The `Fn` facade wires these together, so a sibling here has to call the backing function
 * directly; going through `Fn` would make `src/dataflow/fn/fn.ts` import its own importers.
 * @lintIgnore use-instead
 */
import type { DataflowGraph } from '../graph/graph';
import { FunctionArgument } from '../graph/graph';
import { Dataflow } from '../graph/df-helper';
import { MatchArgs } from '../graph/match-args';
import { DfEdge, EdgeType } from '../graph/edge';
import type { DataflowGraphVertexFunctionCall, DataflowGraphVertexFunctionDefinition, DataflowGraphVertexInfo } from '../graph/vertex';
import { Vertex } from '../graph/vertex';
import type { ArgProps, FnSig } from '../environments/built-in-props';
import { ArgProp } from '../environments/built-in-props';
import { callsIn, edgeTargets, reflectiveRolesOf, type BuiltInLookup } from './frame-reflection';
import { builtInLookup } from '../environments/query-fn-props';
import type { ReadOnlyFlowrAnalyzerContext } from '../../project/context/flowr-analyzer-context';
import { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { RSymbol } from '../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import { Identifier } from '../environments/identifier';
import { RLogical } from '../../r-bridge/lang-4.x/ast/model/nodes/r-logical';
import { BuiltInProcName } from '../environments/built-in-proc-name';
import { happensInEveryBranch } from '../info';

/** What a call states about one of its arguments, paired with the node that argument is. */
type ArgumentProps = readonly (readonly [props: ArgProps, argument: NodeId])[];

/** What a function does with its formals, as an {@link ArgProp} bitfield keyed by the id of each formal's name. */
export type FunctionArgumentRoles = Record<NodeId, ArgProps>;

/** How far a value is followed back: enough for `y <- x; y`, not a whole slice. */
export const DefaultDepth = 6;

/** What to ask for beyond the definitions themselves, see {@link argumentRolesOfFunctions}. */
export interface ArgumentRolesOptions {
	/** how to ask what a built-in states, so a configured or overwritten one answers */
	readonly ctx?:      ReadOnlyFlowrAnalyzerContext
	/** how far a value is followed back through names and calls (default {@link DefaultDepth}) */
	readonly maxDepth?: number
}

/**
 * What each definition in `ids` does with its formals, as {@link ArgProps}. A formal is {@link ArgProp.Alias}
 * only when the result is *always* that formal; every other bit is what the calls in the body state for it.
 * @useInstead {@link Fn.argumentRoles}
 */
export function argumentRolesOfFunctions(this: void, ids: Iterable<NodeId>, graph: DataflowGraph, options: ArgumentRolesOptions = {}): Record<NodeId, FunctionArgumentRoles> {
	const state = makeState(graph, options);
	const all: Record<NodeId, FunctionArgumentRoles> = {};
	for(const id of ids) {
		const roles = rolesOf(id, state);
		if(Object.keys(roles).length > 0) {
			all[id] = roles;
		}
	}
	return all;
}


/** What one run carries along, so the built-in lookups are shared between the definitions it answers. */
export interface LookupState {
	readonly graph: DataflowGraph
	/** what flowR states about a built-in, answered once per name */
	readonly info:  BuiltInLookup
}

/** @see {@link LookupState}; also how far a value is followed back, for the walks that need to know. */
interface RoleState extends LookupState {
	readonly maxDepth: number
	/**
	 * What {@link argumentProps} answered for a call, as the walks ask the same calls over and over and matching
	 * arguments to formals is the expensive part. Lives for the one run and is dropped with it.
	 */
	readonly args:     Map<NodeId, ArgumentProps>
}

function makeState(graph: DataflowGraph, { ctx, maxDepth = DefaultDepth }: ArgumentRolesOptions): RoleState {
	return { graph, info: builtInLookup(ctx), maxDepth, args: new Map() };
}

function rolesOf(id: NodeId, state: RoleState): FunctionArgumentRoles {
	const definition = state.graph.getVertex(id);
	if(!Vertex.isFunctionDefinition(definition)) {
		return {};
	}
	// an exit reached only on some path does not make the formal the result, so it is not followed
	const unconditional = definition.exitPoints.filter(e => happensInEveryBranch(e.cds)).map(e => e.nodeId);
	const returned = identityOf(unconditional, state);
	const stated = statedRoles(definition, state);
	/* reflection flowR could not follow reaches every formal alike */
	const reflective = reflectiveRolesOf(definition, state.graph, { known: state.info });
	const roles: FunctionArgumentRoles = {};
	for(const formal of Object.keys(definition.params)) {
		const at = NodeId.normalize(formal);
		const props = (stated.get(at) ?? 0) | (returned.has(at) ? ArgProp.Alias : 0) | reflective;
		if(props !== 0) {
			roles[formal] = props;
		}
	}
	return roles;
}

/** The bits of a call that say nothing about the value: the alias walk and the parameter list answer these. */
const NotStatedByACall = ArgProp.Alias | ArgProp.NoDefault;

/** What `nodes` always yield, following identity-preserving steps only: `if(c) x else x` is `x`, `if(c) x else y` neither. */
function identityOf(nodes: readonly NodeId[], state: RoleState): Set<NodeId> {
	return intersect(nodes.map(node => identityFrom(node, state, 0, new Set())));
}

function identityFrom(node: NodeId, state: RoleState, depth: number, open: Set<NodeId>): Set<NodeId> {
	const found = new Set<NodeId>([node]);
	if(depth > state.maxDepth || open.has(node)) {
		return found;
	}
	open.add(node);
	const [branches, steps] = sameValueAs(node, state);
	for(const step of steps) {
		for(const id of identityFrom(step, state, depth + 1, open)) {
			found.add(id);
		}
	}
	if(branches.length > 0) {
		for(const id of intersect(branches.map(branch => identityFrom(branch, state, depth + 1, open)))) {
			found.add(id);
		}
	}
	open.delete(node);
	return found;
}

/** What every one of the sets holds; nothing at all when there is not a single set. */
function intersect(sets: readonly ReadonlySet<NodeId>[]): Set<NodeId> {
	return sets.length === 0 ? new Set() : sets.slice(1).reduce<Set<NodeId>>((acc, s) => acc.intersection(s), new Set(sets[0]));
}

/**
 * The nodes the value of `node` may be, split into the branches it picks one of and the steps it always takes.
 * An access (`x$a`, `pkg::name`) draws a `Returns` edge too, but hands back a part, so nothing follows through one.
 */
function sameValueAs(node: NodeId, state: RoleState): [branches: NodeId[], steps: NodeId[]] {
	const graph = state.graph;
	const vertex = graph.getVertex(node);
	const returns = takesApart(vertex) ? [] : edgeTargets(graph, node, EdgeType.Returns);
	if(Vertex.isFunctionCall(vertex)) {
		const alias = argumentsWith(vertex, state, ArgProp.Alias);
		if(missesItsElse(vertex, state)) {
			/* the other path hands back an invisible `NULL`, so what the branch yields is not what the call does */
			return [[], []];
		}
		return returns.length > 1 ? [returns, alias] : [[], [...returns, ...alias]];
	} else if(returns.length > 0) {
		return returns.length > 1 ? [returns, []] : [[], returns];
	} else if(Vertex.isUse(vertex)) {
		const origins = (Dataflow.origin(graph, node) ?? []).map(o => o.id).filter(other => other !== node);
		return origins.length > 1 ? [origins, []] : [[], origins];
	} else if(Vertex.isVariableDefinition(vertex)) {
		/* what the name was given, a call included: what that yields in turn is for the next step to say */
		return [[], edgeTargets(graph, node, EdgeType.DefinedBy)];
	}
	return [[], []];
}

/** Whether the call is an `if` that may skip its branch: no `else` was written and the condition is no `TRUE`. */
function missesItsElse(vertex: DataflowGraphVertexFunctionCall, state: RoleState): boolean {
	if(!vertex.origin.includes(BuiltInProcName.IfThenElse) || FunctionArgument.isNotEmpty(vertex.args[2])) {
		return false;
	}
	const condition = vertex.args[0];
	return !FunctionArgument.isNotEmpty(condition) || !RLogical.isTrue(state.graph.idMap?.get(condition.nodeId));
}

/** Whether the call hands back a part of what it was given (`x$a`, `x[1]`, `pkg::name`) rather than the thing. */
function takesApart(vertex: DataflowGraphVertexInfo | undefined): boolean {
	return Vertex.isFunctionCall(vertex)
		&& (vertex.origin.includes(BuiltInProcName.Access) || vertex.origin.includes(BuiltInProcName.NamespaceAccess));
}

/** The roles the calls inside a definition give to what they are handed, as one mask per node reached. */
function statedRoles(definition: DataflowGraphVertexFunctionDefinition, state: RoleState): Map<NodeId, ArgProps> {
	const byName = formalsByName(definition, state);
	const roles = new Map<NodeId, ArgProps>();
	const add = (node: NodeId, props: ArgProps): void => {
		for(const formal of resolvesTo(node, byName, state)) {
			roles.set(formal, (roles.get(formal) ?? 0) | props);
		}
	};
	for(const [node, vertex] of callsIn(definition, state.graph)) {
		/* a formal the body calls is what it is used as, whether or not any built-in says so */
		for(const callee of calledNames(node, vertex, state)) {
			add(callee, ArgProp.Callee);
		}
		for(const [props, argument] of argumentProps(vertex, state)) {
			const stated = props & ~NotStatedByACall;
			if(stated !== 0) {
				add(argument, stated);
			}
		}
	}
	return roles;
}

/** What the call reads to find the function it calls: the name it is written with, so `h()` after `h <- g` names `g`. */
function calledNames(id: NodeId, vertex: DataflowGraphVertexFunctionCall, state: RoleState): NodeId[] {
	const handed = new Set<NodeId>();
	for(const argument of vertex.args) {
		if(FunctionArgument.isNotEmpty(argument)) {
			handed.add(argument.nodeId);
			if(FunctionArgument.isNamed(argument) && argument.valueId !== undefined) {
				handed.add(argument.valueId);
			}
		}
	}
	const called = Identifier.getName(vertex.name);
	return [...state.graph.edgesFrom(id)]
		.filter(([target, edge]) => DfEdge.includesType(edge, EdgeType.Reads) && !handed.has(target) && !NodeId.isBuiltIn(target)
			&& state.graph.idMap?.get(target)?.lexeme === called)
		.map(([target]) => target);
}

/**
 * Which definitions an argument stands for: what a name refers to, not what a value is (collects *may*, not
 * identity). An argument a call never evaluates has no origin to follow (`quote(x)`), so its written name answers.
 */
function resolvesTo(node: NodeId, byName: ReadonlyMap<string, NodeId>, state: RoleState): Set<NodeId> {
	const found = new Set<NodeId>([node]);
	const queue: [NodeId, number][] = [[node, 0]];
	for(let at = 0; at < queue.length; at++) {
		const [current, depth] = queue[at];
		if(depth > state.maxDepth) {
			continue;
		}
		const [branches, steps] = sameValueAs(current, state);
		for(const next of [...branches, ...steps]) {
			if(!found.has(next)) {
				found.add(next);
				queue.push([next, depth + 1]);
			}
		}
	}
	const written = state.graph.idMap?.get(node);
	const formal = RSymbol.is(written) ? byName.get(written.lexeme) : undefined;
	if(formal !== undefined) {
		found.add(formal);
	}
	return found;
}

/** The formals of the definition by the name they are written as, to answer for an argument nothing links. */
function formalsByName(definition: DataflowGraphVertexFunctionDefinition, state: RoleState): Map<string, NodeId> {
	const byName = new Map<string, NodeId>();
	for(const formal of Object.keys(definition.params)) {
		const name = state.graph.idMap?.get(NodeId.normalize(formal))?.lexeme;
		if(name !== undefined) {
			byName.set(name, NodeId.normalize(formal));
		}
	}
	return byName;
}

/** The arguments of a call carrying any of `props`, as the nodes they are. */
function argumentsWith(vertex: DataflowGraphVertexFunctionCall, state: RoleState, props: ArgProps): NodeId[] {
	return argumentProps(vertex, state).filter(([had]) => (had & props) !== 0).map(([, argument]) => argument);
}

/** What the call states about each of its arguments, paired with the node the argument is (`...` bound by R's own matching). */
function argumentProps(vertex: DataflowGraphVertexFunctionCall, state: RoleState): ArgumentProps {
	const known = state.args.get(vertex.id);
	if(known !== undefined) {
		return known;
	}
	const found = matchArgumentProps(vertex, state);
	state.args.set(vertex.id, found);
	return found;
}

/** @see {@link argumentProps}, which answers from what this worked out once per call. */
function matchArgumentProps(vertex: DataflowGraphVertexFunctionCall, state: RoleState): ArgumentProps {
	const sig: FnSig | undefined = state.info(vertex.name)?.sig;
	if(sig === undefined) {
		return [];
	}
	const bound = MatchArgs.toSpec(vertex.args, Object.fromEntries(sig.map(([formal]) => [formal, formal])));
	/* a named argument is bound by the node naming it, while what the call was handed is the value below it */
	const values = new Map(vertex.args.filter(FunctionArgument.isNamed).map(a => [a.nodeId, a.valueId]));
	const found: [ArgProps, NodeId][] = [];
	for(const [formal, props] of sig) {
		if(props === 0) {
			continue;
		}
		for(const argument of bound.get(formal) ?? []) {
			found.push([props, values.get(argument) ?? argument]);
		}
	}
	return found;
}
