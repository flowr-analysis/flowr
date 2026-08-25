import { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { isReferenceType, ReferenceType } from '../environments/identifier';
import type { DataflowGraph } from '../graph/graph';
import {
	type DataflowGraphVertexArgument,
	type DataflowGraphVertexFunctionDefinition,
	FunctionCallVertex,
	FunctionDefinitionVertex
} from '../graph/vertex';
import { isNotUndefined } from '../../util/assert';
import { DfEdge, EdgeType } from '../graph/edge';
import { NodeValue } from '../eval/resolve/node-value';
import { VariableResolve } from '../../config';
import { EmptyArgument } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { ReadOnlyFlowrAnalyzerContext } from '../../project/context/flowr-analyzer-context';
import { Resolve } from '../environments/resolve-helper';
import { NoEdges } from '../graph/graph';
import type { FunctionArgumentRoles } from './argument-roles';
import { ArgumentRoles } from './argument-roles';
import { ArgProp } from '../environments/built-in-props';

function isAnyReturnAFunction(def: DataflowGraphVertexFunctionDefinition, graph: DataflowGraph): boolean {
	const workingQueue: DataflowGraphVertexArgument[] = def.exitPoints.map(d => graph.getVertex(d.nodeId)).filter(isNotUndefined);
	const seen = new Set<NodeId>();
	while(workingQueue.length > 0) {
		const current = workingQueue.pop() as DataflowGraphVertexArgument;
		if(seen.has(current.id)) {
			continue;
		}
		seen.add(current.id);
		if(FunctionDefinitionVertex.is(current)) {
			return true;
		}
		const next = graph.outgoingEdges(current.id) ?? NoEdges;
		const isCall = FunctionCallVertex.is(current);
		for(const [t, e] of next) {
			/* a call hands back what its callee returns, which its `returns` edges name, and never the callee itself */
			if(isCall && !DfEdge.includesType(e, EdgeType.Returns)) {
				continue;
			}
			/* a returned name is followed to what it holds, as `g <- function() 1; g` hands back that function */
			if(DfEdge.includesType(e, EdgeType.Returns | EdgeType.Reads | EdgeType.DefinedBy) && !NodeId.isBuiltIn(t)) {
				const v = graph.getVertex(t);
				if(v) {
					workingQueue.push(v);
				}
			}
		}
	}
	return false;
}

/** Whether the argument hands over a built-in function (`f(print)`) rather than calling one (`lapply(1:3, f)`, which hands over its result). */
function readsBuiltInFunction(id: NodeId, graph: DataflowGraph, ctx: ReadOnlyFlowrAnalyzerContext): boolean {
	for(const [target, edge] of graph.outgoingEdges(id) ?? NoEdges) {
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
function definitionsBehind(id: NodeId, graph: DataflowGraph): ReadonlySet<NodeId> {
	const found = new Set<NodeId>();
	const seen = new Set<NodeId>();
	const workingQueue: NodeId[] = [id];
	while(workingQueue.length > 0) {
		const current = workingQueue.pop() as NodeId;
		if(seen.has(current) || NodeId.isBuiltIn(current)) {
			continue;
		}
		seen.add(current);
		if(FunctionDefinitionVertex.is(graph.getVertex(current))) {
			found.add(current);
			continue;
		}
		for(const [t, e] of graph.outgoingEdges(current) ?? NoEdges) {
			if(DfEdge.includesType(e, EdgeType.Returns | EdgeType.Reads | EdgeType.DefinedBy)) {
				workingQueue.push(t);
			}
		}
	}
	return found;
}

function inspectCallSitesArgumentsFns(def: DataflowGraphVertexFunctionDefinition, graph: DataflowGraph, ctx: ReadOnlyFlowrAnalyzerContext, invertedGraph?: DataflowGraph): boolean {
	const callSites = invertedGraph?.outgoingEdges(def.id) ?? graph.ingoingEdges(def.id);

	for(const [callerId, e] of callSites ?? []) {
		if(!DfEdge.includesType(e, EdgeType.Calls)) {
			continue;
		}
		const caller = graph.getVertex(callerId);
		if(!caller || !FunctionCallVertex.is(caller)) {
			continue;
		}
		for(const arg of caller.args) {
			if(arg === EmptyArgument) {
				continue;
			}
			/* an apply-family call carries the callback among its arguments, which says nothing about the callback itself */
			const behind = definitionsBehind(arg.nodeId, graph);
			if(behind.size === 1 && behind.has(def.id)) {
				continue;
			}
			const value = NodeValue.inGraph.setOf(arg.nodeId, graph, ctx, { resolve: VariableResolve.Alias });
			if(value?.elements.some(e => e.type === 'function-definition') || readsBuiltInFunction(arg.nodeId, graph, ctx)) {
				return true;
			}
		}
	}
	return false;
}

/** Whether the body uses a formal as a function ({@link ArgProp.Callee}), which no call site has to show. */
function callsAFormal(id: NodeId, graph: DataflowGraph, ctx: ReadOnlyFlowrAnalyzerContext): boolean {
	const roles: FunctionArgumentRoles = ArgumentRoles.of([id], graph, { ctx })[id] ?? {};
	return Object.values(roles).some(props => (props & ArgProp.Callee) !== 0);
}

/** What to ask for beyond the definition itself, see {@link HigherOrderFunctions.of}. */
export interface HigherOrderFunctionsOptions {
	/** how to ask what a built-in states, and to resolve the value an argument carries */
	readonly ctx:            ReadOnlyFlowrAnalyzerContext
	/** the graph with edges reversed, to speed up repeat queries over the same call sites */
	readonly invertedGraph?: DataflowGraph
}

/**
 * Whether the function is higher-order: it takes a function argument, may return one, or calls one of its own
 * formals as a function. `function(x) x` alone is not higher-order.
 * @useInstead {@link HigherOrderFunctions.of}
 */
function isHigherOrder(this: void, id: NodeId, graph: DataflowGraph, { ctx, invertedGraph }: HigherOrderFunctionsOptions): boolean {
	const vert = graph.getVertex(id);
	if(!vert || !FunctionDefinitionVertex.is(vert)) {
		return false;
	}

	return isAnyReturnAFunction(vert, graph) || callsAFormal(id, graph, ctx) || inspectCallSitesArgumentsFns(vert, graph, ctx, invertedGraph);
}

/** Whether the functions of a program take, return, or call one of their own formals as a function. */
export const HigherOrderFunctions = {
	name: 'HigherOrderFunctions',
	/** Whether one definition is higher-order; see {@link isHigherOrder}. */
	of:   isHigherOrder
} as const;

/**
 * Whether the function is higher-order: it takes a function argument, may return one, or calls one of its own
 * formals as a function. `function(x) x` alone is not higher-order; pass an inverted graph to speed up repeat queries.
 * @deprecated use {@link HigherOrderFunctions.of} instead
 */
export function isFunctionHigherOrder(id: NodeId, graph: DataflowGraph, ctx: ReadOnlyFlowrAnalyzerContext, invertedGraph?: DataflowGraph): boolean {
	return HigherOrderFunctions.of(id, graph, { ctx, invertedGraph });
}