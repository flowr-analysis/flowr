import type { RNode } from '../../../../../r-bridge/lang-4.x/ast/model/model';
import type { ControlFlowGraph } from '../../../../../control-flow/control-flow-graph';
import { RFunctionCall } from '../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { AstIdMap, ParentInformation } from '../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { NodeId } from '../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { IdentifierReference } from '../../../../environments/identifier';
import { Identifier } from '../../../../environments/identifier';
import { BuiltInProcName } from '../../../../environments/built-in-proc-name';
import { DfEdge, EdgeType } from '../../../../graph/edge';
import type { DataflowGraph } from '../../../../graph/graph';
import { NoEdges, FunctionArgument, UnknownSideEffect } from '../../../../graph/graph';
import { type DataflowGraphVertexFunctionCall, FunctionCallVertex, VariableDefinitionVertex, VertexType } from '../../../../graph/vertex';
import { linkExpressionIn, linkInputs } from '../../../linker';
import { type MaskingCall, Nse } from './nse';
import { Deferred } from './deferred';
import { FunctionDefinitionVertex } from '../../../../graph/vertex';
import { RArgument } from '../../../../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import { removeRQuotes } from '../../../../../r-bridge/retriever';
import { happensBefore } from '../../../../../control-flow/happens-before';
import { Ternary } from '../../../../../util/logic';

/** Calls capturing a language object. */
const CapturingProcessors: readonly BuiltInProcName[] = [BuiltInProcName.Quote];
/** Calls whose result is a language object although they read their arguments like any other call. */
const CapturingCalls: ReadonlySet<string> = new Set(['expression']);
/** Calls capturing an expression as a promise, forced at some later read of the variable they bind. */
const DelayingCalls: ReadonlySet<string> = new Set(['delayedAssign']);
/** Calls evaluating one. */
const EvaluatingProcessors: readonly BuiltInProcName[] = [BuiltInProcName.Eval];
/** Calls evaluating their own unevaluated argument, in a frame of their own. */
const EvaluatingElsewhereCalls: ReadonlySet<string> = new Set(['evalq']);
/**
 * How a value reaches its use: `DefinedByOnCall` is the hop from a parameter to its argument, and an argument
 * counts because a call handing back one of them, a container included, must not hide the capture inside.
 */
const ValueFlow: EdgeType = EdgeType.Reads | EdgeType.DefinedBy | EdgeType.DefinedByOnCall | EdgeType.Returns | EdgeType.Argument;

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
	/** The expressions a capturing call holds on to. */
	capturedBy(this: void, graph: DataflowGraph, id: NodeId): readonly NodeId[] {
		const vertex = graph.getVertex(id);
		if(!FunctionCallVertex.is(vertex)) {
			return [];
		} else if(hasOrigin(vertex, CapturingProcessors)) {
			return capturedArgumentsOf(graph, id, true);
		} else if(CapturingCalls.has(Identifier.getName(vertex.name))) {
			return capturedArgumentsOf(graph, id, false);
		}
		return [];
	},

	/** Every expression the value at `id` may hold, with the call that captured it. Several is normal. */
	sourcesOf(this: void, graph: DataflowGraph, id: NodeId): readonly CapturedExpression[] {
		const found: CapturedExpression[] = [];
		const seen = new Set<NodeId>([id]);
		const pending: NodeId[] = [id];
		while(pending.length > 0) {
			const current = pending.pop() as NodeId;
			const captured = Quoted.capturedBy(graph, current);
			if(captured.length > 0) {
				for(const expr of captured) {
					found.push({ expr, at: current });
				}
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
		let bindings: ReadonlyMap<string, NodeId[]> | undefined = undefined;
		let cfg: ControlFlowGraph | undefined | null = null;
		const cfgOnce = () => (cfg === null ? (cfg = controlFlow()) : cfg);
		const masking: MaskingCall[] = [];
		for(const [id, vertex] of graph.verticesOfType(VertexType.FunctionCall)) {
			const masks = Nse.dropResolvedMask(graph, id, vertex.name);
			if(masks !== undefined) {
				masking.push(masks);
			}
			if(DelayingCalls.has(Identifier.getName(vertex.name))) {
				const promise = capturedArgumentsOf(graph, id, true)[0];
				const binding = promise === undefined ? undefined : boundBy(graph, id);
				if(promise !== undefined) {
					names ??= Deferred.indexOf(graph, idMap);
					const flow = binding === undefined ? undefined : cfgOnce();
					const sites = flow === undefined || binding === undefined ? undefined : Deferred.forcedAt(graph, binding, flow);
					Deferred.link(graph, promise, names, idMap, flow !== undefined && sites?.length && binding !== undefined ? { cfg: flow, sites, binding } : undefined);
					if(binding !== undefined) {
						linkForcesToPromise(graph, binding, promise);
					}
				}
			} else if(hasOrigin(vertex, EvaluatingProcessors) || EvaluatingElsewhereCalls.has(Identifier.getName(vertex.name))) {
				names ??= Deferred.indexOf(graph, idMap);
				bindings ??= bindingsOf(graph, idMap);
				resolveEvaluation(graph, vertex, idMap, names, bindings, cfgOnce());
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

/** Every read of the delayed name takes the promised expression's value, so all of them get the link, not just whichever forces it first. */
function linkForcesToPromise(graph: DataflowGraph, binding: NodeId, promise: NodeId): void {
	for(const [reader, edge] of graph.ingoingEdges(binding) ?? NoEdges) {
		if(DfEdge.includesType(edge, EdgeType.Reads) && reader !== promise) {
			graph.addEdge(reader, promise, EdgeType.Reads);
		}
	}
}

/**
 * The arguments a call captures: the ones it marked as unevaluated, or, for a call that reads its arguments
 * and still hands back the language object they form, all of them.
 */
function capturedArgumentsOf(graph: DataflowGraph, id: NodeId, marked: boolean): readonly NodeId[] {
	const captured: NodeId[] = [];
	for(const [target, edge] of graph.outgoingEdges(id) ?? NoEdges) {
		if(DfEdge.includesType(edge, EdgeType.Argument) && (!marked || DfEdge.includesType(edge, EdgeType.NonStandardEvaluation))) {
			captured.push(target);
		}
	}
	return captured;
}

/** Every name a definition binds, the string-named ones an `assign` creates included. */
function bindingsOf<Info>(graph: DataflowGraph, idMap: AstIdMap<Info & ParentInformation>): ReadonlyMap<string, NodeId[]> {
	const bindings = new Map<string, NodeId[]>();
	for(const [id] of graph.verticesOfType(VertexType.VariableDefinition)) {
		const name = NodeId.recoverName(id, idMap);
		if(name === undefined) {
			continue;
		}
		const key = Identifier.getName(removeRQuotes(name));
		const known = bindings.get(key);
		if(known !== undefined) {
			known.push(id);
		} else {
			bindings.set(key, [id]);
		}
	}
	return bindings;
}

/**
 * Where the evaluation happens: the call itself, or, for one inside a closure, every call of that closure (those
 * are the points whose bindings the evaluation sees). `undefined` if a nesting closure is never seen called.
 */
function evaluationSites(graph: DataflowGraph, id: NodeId): readonly NodeId[] | undefined {
	const sites: NodeId[] = [];
	let nested = false;
	for(const [definition, vertex] of graph.verticesOfType(VertexType.FunctionDefinition)) {
		if(!vertex.subflow.graph.has(id)) {
			continue;
		}
		nested = true;
		for(const [caller, edge] of graph.ingoingEdges(definition) ?? NoEdges) {
			if(DfEdge.includesType(edge, EdgeType.Calls)) {
				sites.push(caller);
			}
		}
	}
	if(!nested) {
		return [id];
	}
	return sites.length > 0 ? sites : undefined;
}

/** Whether some point the evaluation may run at can be reached with `definition` in effect. */
function mayReach(sites: readonly NodeId[] | undefined, definition: NodeId, cfg: ControlFlowGraph | undefined): boolean {
	return cfg === undefined || sites === undefined || sites.some(site => happensBefore(cfg, definition, site) !== Ternary.Never);
}

/**
 * The names the frames we know do not bind: a capture forced inside a closure may see bindings the caller made
 * after the closure was written, so every reachable definition of the name stays a candidate.
 */
function linkAgainstAnyBinding(graph: DataflowGraph, open: readonly IdentifierReference[], bindings: ReadonlyMap<string, NodeId[]>, sites: readonly NodeId[] | undefined, cfg: ControlFlowGraph | undefined): void {
	for(const reference of open) {
		if(reference.name === undefined) {
			continue;
		}
		for(const definition of bindings.get(Identifier.getName(reference.name)) ?? []) {
			if(definition !== reference.nodeId && mayReach(sites, definition, cfg)) {
				graph.addEdge(reference.nodeId, definition, EdgeType.Reads);
			}
		}
	}
}

/** Links a capture handed to an evaluating call, in that call's scope. */
function resolveEvaluation<Info>(graph: DataflowGraph, call: DataflowGraphVertexFunctionCall, idMap: AstIdMap<Info & ParentInformation>, names: ReturnType<typeof Deferred.indexOf>, bindings: ReadonlyMap<string, NodeId[]>, cfg: ControlFlowGraph | undefined): void {
	const id = call.id;
	const own = EvaluatingElsewhereCalls.has(Identifier.getName(call.name));
	const sources = own ? capturedArgumentsOf(graph, id, true).map(expr => ({ expr, at: id })) : sourcesHandedTo(graph, call, idMap);
	const environment = call.environment;
	/* a frame of its own says nothing about the bindings here, so every one of them stays possible */
	const elsewhere = own || environment === undefined || evaluatesElsewhere(idMap.get(id));
	const sites = sources.length > 0 ? evaluationSites(graph, id) : undefined;
	for(const { expr, at } of sources) {
		if(elsewhere) {
			const forces = cfg === undefined || sites === undefined ? undefined : { cfg, sites, binding: id };
			Deferred.link(graph, expr, { definitions: bindings, uses: names.uses }, idMap, forces);
		} else {
			const open = linkExpressionIn(graph, expr, environment, idMap);
			/* R falls through to the enclosing scope for names the evaluating frame does not bind */
			const enclosing = open.length > 0 ? graph.getVertex(at)?.environment : undefined;
			const unbound = enclosing === undefined ? open : linkInputs(open, enclosing, [], graph, false);
			linkAgainstAnyBinding(graph, unbound, bindings, sites, cfg);
			Deferred.publish(graph, expr, names, idMap, id, cfg);
		}
		graph.addEdge(id, expr, EdgeType.Returns);
		if(!elsewhere) {
			/* the capture said "not evaluated here", and being handed to `eval` settles that it is */
			Nse.unmark(graph, at);
		}
	}
	if(sources.length > 0 && !elsewhere) {
		forgetUnknownSideEffect(graph, id);
	}
}

/** The captures the first argument of an evaluating call may carry. */
function sourcesHandedTo<Info>(graph: DataflowGraph, call: DataflowGraphVertexFunctionCall, idMap: AstIdMap<Info & ParentInformation>): readonly CapturedExpression[] {
	const argument = call.args.find(a => !FunctionArgument.isEmpty(a));
	const reference = argument === undefined ? undefined : unwrapArgument(FunctionArgument.getReference(argument), idMap);
	return reference === undefined ? [] : Quoted.sourcesOf(graph, reference);
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
	return RArgument.is(node) ? node.value?.info.id : reference;
}

/** `eval(expr, envir)` runs in the frame it is given, so the bindings here say nothing. */
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
