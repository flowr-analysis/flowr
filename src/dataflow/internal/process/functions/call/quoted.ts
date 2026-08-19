import type { RNode } from '../../../../../r-bridge/lang-4.x/ast/model/model';
import type { ControlFlowGraph } from '../../../../../control-flow/control-flow-graph';
import { RFunctionCall } from '../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { RType } from '../../../../../r-bridge/lang-4.x/ast/model/type';
import type { AstIdMap, ParentInformation } from '../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { NodeId } from '../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { Identifier } from '../../../../environments/identifier';
import { BuiltInProcName } from '../../../../environments/built-in-proc-name';
import { DfEdge, EdgeType } from '../../../../graph/edge';
import type { REnvironmentInformation } from '../../../../environments/environment';
import type { DataflowGraph } from '../../../../graph/graph';
import { NoEdges, FunctionArgument, UnknownSideEffect } from '../../../../graph/graph';
import { type DataflowGraphVertexFunctionCall, FunctionCallVertex, VariableDefinitionVertex, VertexType } from '../../../../graph/vertex';
import { linkExpressionIn, linkInputs } from '../../../linker';
import { type MaskingCall, Nse } from './nse';
import { Deferred } from './deferred';
import { FunctionDefinitionVertex } from '../../../../graph/vertex';

/** Calls capturing a language object. */
const CapturingProcessors: readonly BuiltInProcName[] = [BuiltInProcName.Quote];
/** Calls capturing an expression as a promise, forced at some later read of the variable they bind. */
const DelayingCalls: ReadonlySet<string> = new Set(['delayedAssign']);
/** Calls evaluating one. */
const EvaluatingProcessors: readonly BuiltInProcName[] = [BuiltInProcName.Eval];
/** How a value reaches its use, `DefinedByOnCall` being the hop from a parameter to its argument. */
const ValueFlow: EdgeType = EdgeType.Reads | EdgeType.DefinedBy | EdgeType.DefinedByOnCall | EdgeType.Returns;

function hasOrigin(vertex: { readonly origin: readonly string[] | 'unnamed' }, of: readonly BuiltInProcName[]): boolean {
	return vertex.origin !== 'unnamed' && vertex.origin.some(o => of.includes(o as BuiltInProcName));
}

/**
 * A language object reads nothing where it is written and everything where it reaches `eval`, with the bindings
 * in effect there. Working on the finished graph makes assignments, branches, loops, and calls one traversal.
 * @example
 * ```ts
 * Quoted.capturedBy(graph, id); // the expression a `quote(...)` holds on to
 * Quoted.sourcesOf(graph, id);  // every expression the value at `id` may hold
 * ```
 */
export const Quoted = {
	name: 'Quoted',
	/** The expression a capturing call holds on to. */
	capturedBy(this: void, graph: DataflowGraph, id: NodeId): NodeId | undefined {
		const vertex = graph.getVertex(id);
		return FunctionCallVertex.is(vertex) && hasOrigin(vertex, CapturingProcessors) ? capturedArgumentOf(graph, id) : undefined;
	},

	/** Every expression the value at `id` may hold, with the call that captured it. Several is normal. */
	sourcesOf(this: void, graph: DataflowGraph, id: NodeId): readonly CapturedExpression[] {
		const found: CapturedExpression[] = [];
		const seen = new Set<NodeId>([id]);
		const pending: NodeId[] = [id];
		while(pending.length > 0) {
			const current = pending.pop() as NodeId;
			const captured = Quoted.capturedBy(graph, current);
			if(captured !== undefined) {
				found.push({ expr: captured, at: current });
				continue;
			}
			for(const [target, edge] of graph.outgoingEdges(current) ?? NoEdges) {
				if(DfEdge.includesType(edge, ValueFlow) && !seen.has(target)) {
					seen.add(target);
					pending.push(target);
				}
			}
		}
		return found;
	},

	/** Links every name in `expr` against `environment` and hands back what stays unresolved. */
	evaluateIn: linkExpressionIn,

	/**
	 * The finishing pass over a complete graph: it settles what a call really evaluates, which the call itself
	 * could not know. A capture reaches the `eval` that forces it, a promise reaches the bindings it may be
	 * forced against, and a masked name the caller binds after all loses its mark.
	 */
	finalize<Info>(this: void, graph: DataflowGraph, idMap: AstIdMap<Info & ParentInformation>, controlFlow: () => ControlFlowGraph | undefined): void {
		let names: ReturnType<typeof Deferred.indexOf> | undefined = undefined;
		let cfg: ControlFlowGraph | undefined | null = null;
		const cfgOnce = () => (cfg === null ? (cfg = controlFlow()) : cfg);
		const masking: MaskingCall[] = [];
		for(const [id, vertex] of graph.verticesOfType(VertexType.FunctionCall)) {
			const masks = Nse.dropResolvedMask(graph, id, vertex.name);
			if(masks !== undefined) {
				masking.push(masks);
			}
			if(DelayingCalls.has(Identifier.getName(vertex.name))) {
				const promise = capturedArgumentOf(graph, id);
				const binding = promise === undefined ? undefined : boundBy(graph, id);
				if(promise !== undefined) {
					names ??= Deferred.indexOf(graph, idMap);
					const flow = binding === undefined ? undefined : cfgOnce();
					const sites = flow === undefined || binding === undefined ? undefined : Deferred.forcedAt(graph, binding, flow);
					Deferred.link(graph, promise, names, idMap, flow !== undefined && sites?.length && binding !== undefined ? { cfg: flow, sites, binding } : undefined);
				}
			} else if(vertex.environment !== undefined && hasOrigin(vertex, EvaluatingProcessors) && !evaluatesElsewhere(idMap.get(id))) {
				names ??= Deferred.indexOf(graph, idMap);
				resolveEvaluation(graph, vertex, vertex.environment, idMap, names, cfgOnce());
			} else {
				for(const escaped of escapingArguments(graph, id)) {
					names ??= Deferred.indexOf(graph, idMap);
					Deferred.link(graph, escaped, names, idMap);
				}
			}
		}
		/* only once every mark has settled: the read a column gets makes it look bound from here on */
		Nse.linkMasksToData(graph, masking);
	}
} as const;

interface CapturedExpression {
	readonly expr: NodeId
	/** the capturing call, whose scope encloses `expr` */
	readonly at:   NodeId
}

/** The name a delaying call binds, which is the definition its reads have to go through. */
function boundBy(graph: DataflowGraph, id: NodeId): NodeId | undefined {
	for(const [target, edge] of graph.ingoingEdges(id) ?? NoEdges) {
		if(DfEdge.includesType(edge, EdgeType.DefinedBy) && VariableDefinitionVertex.is(graph.getVertex(target))) {
			return target;
		}
	}
	return undefined;
}

/** The argument a call takes but does not evaluate, which is the one it captured. */
function capturedArgumentOf(graph: DataflowGraph, id: NodeId): NodeId | undefined {
	for(const [target, edge] of graph.outgoingEdges(id) ?? NoEdges) {
		if(DfEdge.includesType(edge, EdgeType.Argument) && DfEdge.includesType(edge, EdgeType.NonStandardEvaluation)) {
			return target;
		}
	}
	return undefined;
}



/** Links a capture handed to an evaluating call, in that call's scope. */
function resolveEvaluation<Info>(graph: DataflowGraph, call: DataflowGraphVertexFunctionCall, environment: REnvironmentInformation, idMap: AstIdMap<Info & ParentInformation>, names: ReturnType<typeof Deferred.indexOf>, cfg: ControlFlowGraph | undefined): void {
	const id = call.id;
	const argument = call.args.find(a => !FunctionArgument.isEmpty(a));
	const reference = argument === undefined ? undefined : unwrapArgument(FunctionArgument.getReference(argument), idMap);
	const sources = reference === undefined ? [] : Quoted.sourcesOf(graph, reference);
	for(const { expr, at } of sources) {
		const open = linkExpressionIn(graph, expr, environment, idMap);
		/* R falls through to the enclosing scope for names the evaluating frame does not bind */
		const enclosing = open.length > 0 ? graph.getVertex(at)?.environment : undefined;
		if(enclosing !== undefined) {
			linkInputs(open, enclosing, [], graph, false);
		}
		graph.addEdge(id, expr, EdgeType.Returns);
		Deferred.publish(graph, expr, names, idMap, id, cfg);
		/* the capture said "not evaluated here", and being handed to `eval` settles that it is */
		Nse.unmark(graph, at);
	}
	if(sources.length > 0) {
		forgetUnknownSideEffect(graph, id);
	}
}


/**
 * The arguments of `id` whose promise outlives the call: the callee hands back a closure and never reads the
 * parameter outside it, so R forces them wherever that closure is called, not here. A parameter read in the
 * body itself (what `force` is for) is settled during the call and stays where it is.
 */
function* escapingArguments(graph: DataflowGraph, id: NodeId): Generator<NodeId> {
	for(const [target, edge] of graph.outgoingEdges(id) ?? NoEdges) {
		if(!DfEdge.includesType(edge, EdgeType.Calls)) {
			continue;
		}
		const callee = graph.getVertex(target);
		if(!FunctionDefinitionVertex.is(callee)) {
			continue;
		}
		for(const exit of callee.exitPoints) {
			const closure = graph.getVertex(exit.nodeId);
			if(!FunctionDefinitionVertex.is(closure)) {
				continue;
			}
			for(const key of Object.keys(callee.params)) {
				const parameter = NodeId.normalize(key);
				let escapes = true;
				for(const [reader, edge] of graph.ingoingEdges(parameter) ?? NoEdges) {
					if(DfEdge.includesType(edge, EdgeType.Reads) && !closure.subflow.graph.has(reader)) {
						escapes = false;
						break;
					}
				}
				if(!escapes) {
					continue;
				}
				for(const [argument, edge] of graph.outgoingEdges(parameter) ?? NoEdges) {
					if(DfEdge.includesType(edge, EdgeType.DefinedByOnCall)) {
						yield argument;
					}
				}
			}
		}
	}
}

/** The value an argument reference points at. */
function unwrapArgument<Info>(reference: NodeId | undefined, idMap: AstIdMap<Info & ParentInformation>): NodeId | undefined {
	const node = reference === undefined ? undefined : idMap.get(reference);
	return node?.type === RType.Argument ? node.value?.info.id : reference;
}

/** `eval(expr, envir)` runs elsewhere, so the bindings here say nothing. */
function evaluatesElsewhere<Info>(call: RNode<Info & ParentInformation> | undefined): boolean {
	return RFunctionCall.isNamed(call) && call.arguments.length > 1;
}

/** Drops the marker the call carries while we cannot say what it evaluates. */
function forgetUnknownSideEffect(graph: DataflowGraph, id: NodeId): void {
	for(const unknown of graph.unknownSideEffects) {
		if(UnknownSideEffect.id(unknown) === id) {
			graph.unknownSideEffects.delete(unknown);
		}
	}
}
