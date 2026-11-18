/**
 * The `FunctionSemantics` facade wires these together, so a sibling here has to call the backing function
 * directly; going through `FunctionSemantics` would make `src/dataflow/fn/function-semantics.ts` import its own importers.
 * @lintIgnore use-instead
 */
import { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { isReferenceType, ReferenceType } from '../environments/identifier';
import type { DataflowGraph } from '../graph/graph';
import { type DataflowGraphVertexArgument, type DataflowGraphVertexFunctionDefinition, DfgVertex } from '../graph/vertex';
import { isNotUndefined } from '../../util/assert';
import { DfEdge, EdgeType } from '../graph/edge';
import { NodeValue } from '../eval/resolve/node-value';
import { VariableResolve } from '../../config';
import { EmptyArgument } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { ReadOnlyFlowrAnalyzerContext } from '../../project/context/flowr-analyzer-context';
import { Resolve } from '../environments/resolve-helper';
import { argumentRolesOfFunctions } from './argument-roles';
import { ReachSummaries } from '../../util/fixpoint';
import { ArgProp } from '../environments/built-in-props';

function isAnyReturnAFunction(def: DataflowGraphVertexFunctionDefinition, graph: DataflowGraph): boolean {
	const workingQueue: DataflowGraphVertexArgument[] = def.exitPoints.map(d => graph.getVertex(d.nodeId)).filter(isNotUndefined);
	const seen = new Set<NodeId>();
	for(let current = workingQueue.pop(); current !== undefined; current = workingQueue.pop()) {
		if(seen.has(current.id)) {
			continue;
		}
		seen.add(current.id);
		if(DfgVertex.isFunctionDefinition(current)) {
			return true;
		}
		/* a call hands back what its callee returns, never the callee; a returned name is followed to what it holds */
		const follow = DfgVertex.isFunctionCall(current) ? EdgeType.Returns : EdgeType.Returns | EdgeType.Reads | EdgeType.DefinedBy;
		for(const [t, e] of graph.edgesFrom(current.id)) {
			const v = DfEdge.includesType(e, follow) && !NodeId.isBuiltIn(t) ? graph.getVertex(t) : undefined;
			if(v) {
				workingQueue.push(v);
			}
		}
	}
	return false;
}

/** Whether the argument hands over a built-in function (`f(print)`) rather than calling one (`lapply(1:3, f)`, which hands over its result). */
function readsBuiltInFunction(id: NodeId, graph: DataflowGraph, ctx: ReadOnlyFlowrAnalyzerContext): boolean {
	for(const [target, edge] of graph.edgesFrom(id)) {
		if(!DfEdge.includesType(edge, EdgeType.Reads) || DfEdge.includesType(edge, EdgeType.Calls) || !NodeId.isBuiltIn(target)) {
			continue;
		}
		const defs = Resolve.byNameAndType(NodeId.fromBuiltIn(target), ctx.env.makeCleanEnv(), ReferenceType.Function);
		if(defs?.some(d => isReferenceType(d.type, ReferenceType.BuiltInFunction))) {
			return true;
		}
	}
	return false;
}

/** The definitions the given node can hand over, to tell an argument being the definition under inspection from one holding another. */
export function definitionsBehind(id: NodeId, graph: DataflowGraph): ReadonlySet<NodeId> {
	const found = new Set<NodeId>();
	const seen = new Set<NodeId>();
	const workingQueue: NodeId[] = [id];
	for(let current = workingQueue.pop(); current !== undefined; current = workingQueue.pop()) {
		if(seen.has(current) || NodeId.isBuiltIn(current)) {
			continue;
		}
		seen.add(current);
		const vertex = graph.getVertex(current);
		if(DfgVertex.isFunctionDefinition(vertex)) {
			found.add(current);
			continue;
		}
		/* what a call reads beyond its arguments (state it depends on, writes it follows) is no value it hands back */
		workingQueue.push(...behindSuccessors(current, graph));
	}
	return found;
}

/** The edges {@link definitionsBehind} follows out of `current`, a vertex that is no function definition. */
function behindSuccessors(current: NodeId, graph: DataflowGraph): NodeId[] {
	const isCall = DfgVertex.isFunctionCall(graph.getVertex(current));
	const out: NodeId[] = [];
	for(const [t, e] of graph.edgesFrom(current)) {
		if(DfEdge.includesType(e, EdgeType.Returns | EdgeType.DefinedBy) || (DfEdge.includesType(e, EdgeType.Reads) && (!isCall || DfEdge.includesType(e, EdgeType.Argument)))) {
			out.push(t);
		}
	}
	return out;
}

/**
 * {@link definitionsBehind} for many nodes of one graph that does not change in between: every node's answer
 * is worked out once, a strongly connected component at a time, so arguments that lead into the same chain of
 * reads share the walk instead of repeating it. An answer holds at most `cap` definitions, which is enough to
 * tell none, one and several apart.
 */
export class DefinitionsBehind {
	private readonly summaries: ReachSummaries<NodeId, ReadonlySet<NodeId>>;

	constructor(graph: DataflowGraph, cap = 2) {
		const none: ReadonlySet<NodeId> = new Set();
		const leaf = (id: NodeId) => NodeId.isBuiltIn(id) || DfgVertex.isFunctionDefinition(graph.getVertex(id));
		this.summaries = new ReachSummaries<NodeId, ReadonlySet<NodeId>>(
			id => leaf(id) ? [] : behindSuccessors(id, graph),
			id => !NodeId.isBuiltIn(id) && DfgVertex.isFunctionDefinition(graph.getVertex(id)) ? new Set([id]) : undefined,
			{ empty: none, concat: (a, b) => cappedUnion(a, b, cap) }
		);
	}

	/** the definitions `id` can hand over, at most `cap` of them */
	public of(id: NodeId): ReadonlySet<NodeId> {
		return this.summaries.of(id);
	}
}

/** The union of both sets, but no more than `cap` elements of it; one of them where it already is the answer. */
function cappedUnion(a: ReadonlySet<NodeId>, b: ReadonlySet<NodeId>, cap: number): ReadonlySet<NodeId> {
	if(a.size >= cap || b.size === 0 || b.isSubsetOf(a)) {
		return a;
	} else if(b.size >= cap || a.size === 0 || a.isSubsetOf(b)) {
		return b;
	}
	const union = new Set(a);
	for(const x of b) {
		if(union.size >= cap) {
			break;
		}
		union.add(x);
	}
	return union;
}

/** What an argument is, which no definition it is looked at for changes. */
export interface ArgumentFacts {
	readonly behind:  ReadonlySet<NodeId>
	/** whether it hands over a function, only worked out once something asks */
	carriesFunction?: boolean
}

function inspectCallSitesArgumentsFns(def: DataflowGraphVertexFunctionDefinition, graph: DataflowGraph, ctx: ReadOnlyFlowrAnalyzerContext, invertedGraph?: DataflowGraph, facts?: Map<NodeId, ArgumentFacts>, behind?: DefinitionsBehind): boolean {
	const callSites = invertedGraph?.outgoingEdges(def.id) ?? graph.ingoingEdges(def.id);
	for(const [callerId, e] of callSites ?? []) {
		if(!DfEdge.includesType(e, EdgeType.Calls)) {
			continue;
		}
		const caller = graph.getVertex(callerId);
		if(!DfgVertex.isFunctionCall(caller)) {
			continue;
		}
		for(const arg of caller.args) {
			if(arg === EmptyArgument) {
				continue;
			}
			/* an apply-family call carries the callback among its arguments, which says nothing about the callback itself */
			let known = facts?.get(arg.nodeId);
			if(known === undefined) {
				known = { behind: behind?.of(arg.nodeId) ?? definitionsBehind(arg.nodeId, graph) };
				facts?.set(arg.nodeId, known);
			}
			if(known.behind.size === 1 && known.behind.has(def.id)) {
				continue;
			}
			if(known.carriesFunction === undefined) {
				const value = NodeValue.setOf(arg.nodeId, Resolve.info(graph, ctx), { resolve: VariableResolve.Alias });
				known.carriesFunction = value?.elements.some(e => e.type === 'function-definition') || readsBuiltInFunction(arg.nodeId, graph, ctx);
			}
			if(known.carriesFunction) {
				return true;
			}
		}
	}
	return false;
}

/** Whether the body uses a formal as a function ({@link ArgProp.Callee}), which no call site has to show. */
function callsAFormal(id: NodeId, graph: DataflowGraph, ctx: ReadOnlyFlowrAnalyzerContext): boolean {
	const roles = argumentRolesOfFunctions([id], graph, { ctx })[id] ?? {};
	return Object.values(roles).some(props => (props & ArgProp.Callee) !== 0);
}

/** What to ask for beyond the definition itself, see {@link isHigherOrder}. */
export interface HigherOrderFunctionsOptions {
	/** how to ask what a built-in states, and to resolve the value an argument carries */
	readonly ctx:                ReadOnlyFlowrAnalyzerContext
	/** the graph with edges reversed, to speed up repeat queries over the same call sites */
	readonly invertedGraph?:     DataflowGraph
	/** what is known about the arguments, to share between the definitions asked about in one go; a call site reaching several of them resolves its arguments once */
	readonly argumentFacts?:     Map<NodeId, ArgumentFacts>
	/** the definitions behind each argument, worked out once for the whole graph (see {@link DefinitionsBehind}) */
	readonly definitionsBehind?: DefinitionsBehind
}

/**
 * Whether the function is higher-order: it takes a function argument, may return one, or calls one of its own
 * formals as a function. `function(x) x` alone is not higher-order.
 * @useInstead {@link FunctionSemantics.isHigherOrder}
 */
export function isHigherOrder(this: void, id: NodeId, graph: DataflowGraph, { ctx, invertedGraph, argumentFacts, definitionsBehind: behind }: HigherOrderFunctionsOptions): boolean {
	const vert = graph.getVertex(id);
	if(!DfgVertex.isFunctionDefinition(vert)) {
		return false;
	}
	return isAnyReturnAFunction(vert, graph) || callsAFormal(id, graph, ctx) || inspectCallSitesArgumentsFns(vert, graph, ctx, invertedGraph, argumentFacts, behind);
}

