import type { DataflowGraph } from '../graph/graph';
import { FunctionArgument, NoEdges } from '../graph/graph';
import { Dataflow } from '../graph/df-helper';
import { MatchArgs } from '../graph/match-args';
import { DfEdge, EdgeType } from '../graph/edge';
import type { DataflowGraphVertexFunctionCall, DataflowGraphVertexFunctionDefinition, DataflowGraphVertexInfo } from '../graph/vertex';
import { FunctionCallVertex, FunctionDefinitionVertex, UseVertex, VariableDefinitionVertex } from '../graph/vertex';
import type { ArgProps, BuiltInFnInfo, FnSig } from '../environments/built-in-props';
import { ArgProp } from '../environments/built-in-props';
import { BuiltInIndex, queryFnProps } from '../environments/query-fn-props';
import { Identifier } from '../environments/identifier';
import type { ReadOnlyFlowrAnalyzerContext } from '../../project/context/flowr-analyzer-context';
import { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { RSymbol } from '../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import { BuiltInProcName } from '../environments/built-in-proc-name';
import { happensInEveryBranch } from '../info';

/**
 * What a function does with its formals, as the {@link ArgProp} bitfield everything else states its arguments
 * with, keyed by the id of each formal's name. Only the formals carrying at least one bit appear, and an unset
 * bit means "nothing says so": a formal handed to a function flowR cannot resolve carries none at all.
 */
export type FunctionArgumentRoles = Record<NodeId, ArgProps>;

/** How far a value is followed back: enough for `y <- x; y`, not a whole slice. */
const DefaultDepth = 6;

/** What to ask for beyond the definitions themselves, see {@link ArgumentRoles.of}. */
export interface ArgumentRolesOptions {
	/** how to ask what a built-in states, so a configured or overwritten one answers */
	readonly ctx?:      ReadOnlyFlowrAnalyzerContext
	/** how far a value is followed back through names and calls (default {@link DefaultDepth}) */
	readonly maxDepth?: number
}

/**
 * What each definition in `ids` does with its formals, as {@link ArgProps}. Complements
 * {@link strictnessOfFunction}, which answers whether a formal is evaluated; this answers what for.
 *
 * A formal is an {@link ArgProp.Alias} only when the result is *always* that formal, which the walk over the
 * unconditional exit points answers by following identity-preserving steps alone (`return(x)` under an `if` is
 * not one). Every other bit is what the calls in the body state for what they are handed, so `missing(x)` gives
 * {@link ArgProp.Presence} and `lapply(xs, FUN)` gives `FUN` {@link ArgProp.Callee}; a formal reaching several
 * such calls carries the bits of all of them.
 * @useInstead {@link ArgumentRoles.of}
 */
function argumentRolesOfFunctions(this: void, ids: Iterable<NodeId>, graph: DataflowGraph, options: ArgumentRolesOptions = {}): Record<NodeId, FunctionArgumentRoles> {
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

/**
 * What the functions of a program do with the arguments they are handed.
 */
export const ArgumentRoles = {
	name:     'ArgumentRoles',
	/** The roles of several definitions, sharing the built-in lookups; see {@link argumentRolesOfFunctions}. */
	of:       argumentRolesOfFunctions,
	/** how far a value is followed back when nothing else is asked for */
	maxDepth: DefaultDepth
} as const;

/** What one run carries along, so the built-in lookups are shared between the definitions it answers. */
interface RoleState {
	readonly graph:    DataflowGraph
	/** what flowR states about a built-in, asked once per name */
	readonly known:    Map<string, BuiltInFnInfo | undefined>
	/** how to ask, so a configured built-in is the one that answers */
	readonly info:     (name: Identifier) => BuiltInFnInfo | undefined
	readonly maxDepth: number
}

function makeState(graph: DataflowGraph, { ctx, maxDepth = DefaultDepth }: ArgumentRolesOptions): RoleState {
	const environment = ctx?.env.makeCleanEnv();
	const info = environment === undefined
		? (name: Identifier) => BuiltInIndex.default().get(name)
		: (name: Identifier) => queryFnProps(name, { environment });
	return { graph, known: new Map(), info, maxDepth };
}

/** What flowR states about the built-in of that name, asked once per name. */
function infoOf(name: Identifier, state: RoleState): BuiltInFnInfo | undefined {
	const key = Identifier.getName(name);
	if(!state.known.has(key)) {
		state.known.set(key, state.info(name));
	}
	return state.known.get(key);
}

function rolesOf(id: NodeId, state: RoleState): FunctionArgumentRoles {
	const definition = state.graph.getVertex(id);
	if(!FunctionDefinitionVertex.is(definition)) {
		return {};
	}
	// an exit reached only on some path does not make the formal the result, so it is not followed
	const unconditional = definition.exitPoints.filter(e => happensInEveryBranch(e.cds)).map(e => e.nodeId);
	const returned = identityOf(unconditional, state);
	const stated = statedRoles(definition, state);
	const roles: FunctionArgumentRoles = {};
	for(const formal of Object.keys(definition.params)) {
		const at = NodeId.normalize(formal);
		const props = (stated.get(at) ?? 0) | (returned.has(at) ? ArgProp.Alias : 0);
		if(props !== 0) {
			roles[formal] = props;
		}
	}
	return roles;
}

/** The bits of a call that say nothing about the value: the alias walk and the parameter list answer these. */
const NotStatedByACall = ArgProp.Alias | ArgProp.NoDefault;

/**
 * What the result of `nodes` always is, following identity-preserving steps only. Where a node hands back one
 * of several values, only what *every* one of them yields counts: `if(c) x else x` is `x`, `if(c) x else y`
 * neither.
 */
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
	if(sets.length === 0) {
		return new Set();
	}
	const found = new Set(sets[0]);
	for(const other of sets.slice(1)) {
		for(const id of found) {
			if(!other.has(id)) {
				found.delete(id);
			}
		}
	}
	return found;
}

/**
 * The nodes the value of `node` may be, split into the branches it picks one of and the steps it always takes.
 * Several `Returns` edges, or a name several definitions reach, say the value is *one* of them. An access
 * (`x$a`, `pkg::name`) draws that edge too, but hands back a part, so nothing is followed through one.
 */
function sameValueAs(node: NodeId, state: RoleState): [branches: NodeId[], steps: NodeId[]] {
	const graph = state.graph;
	const vertex = graph.getVertex(node);
	const returns = takesApart(vertex) ? [] : [...graph.outgoingEdges(node) ?? NoEdges]
		.filter(([, edge]) => DfEdge.includesType(edge, EdgeType.Returns))
		.map(([target]) => target);
	if(FunctionCallVertex.is(vertex)) {
		const alias = argumentsWith(vertex, state, ArgProp.Alias);
		return returns.length > 1 ? [returns, alias] : [[], [...returns, ...alias]];
	} else if(returns.length > 0) {
		return returns.length > 1 ? [returns, []] : [[], returns];
	} else if(UseVertex.is(vertex)) {
		const origins = (Dataflow.origin(graph, node) ?? []).map(o => o.id).filter(other => other !== node);
		return origins.length > 1 ? [origins, []] : [[], origins];
	} else if(VariableDefinitionVertex.is(vertex)) {
		/* what the name was given, a call included: what that yields in turn is for the next step to say */
		return [[], [...graph.outgoingEdges(node) ?? NoEdges]
			.filter(([, edge]) => DfEdge.includesType(edge, EdgeType.DefinedBy))
			.map(([target]) => target)];
	}
	return [[], []];
}

/** Whether the call hands back a part of what it was given (`x$a`, `x[1]`, `pkg::name`) rather than the thing. */
function takesApart(vertex: DataflowGraphVertexInfo | undefined): boolean {
	return FunctionCallVertex.is(vertex)
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
	for(const node of definition.subflow.graph) {
		const vertex = state.graph.getVertex(node);
		if(!FunctionCallVertex.is(vertex)) {
			continue;
		}
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

/**
 * What the call reads to find the function it calls: everything it reads that it was not handed as an argument
 * and that is not a built-in, so `h()` after `h <- g` names `g` just as `g()` does.
 */
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
	return [...state.graph.outgoingEdges(id) ?? NoEdges]
		.filter(([target, edge]) => DfEdge.includesType(edge, EdgeType.Reads) && !handed.has(target) && !NodeId.isBuiltIn(target))
		.map(([target]) => target);
}

/**
 * Which definitions an argument stands for: what a name refers to, not what a value is. Unlike the alias walk
 * this collects what it *may* be, as a role holds as soon as one of them is meant. An argument a call never
 * evaluates has no origin to follow (`quote(x)`), so the name it is written as answers for it.
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

/**
 * What the call states about each of its arguments, paired with the node the argument is. R's own matching
 * binds them, so a named argument is answered by its formal and everything falling to `...` by that entry.
 */
function argumentProps(vertex: DataflowGraphVertexFunctionCall, state: RoleState): [props: ArgProps, argument: NodeId][] {
	const sig: FnSig | undefined = infoOf(vertex.name, state)?.sig;
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
