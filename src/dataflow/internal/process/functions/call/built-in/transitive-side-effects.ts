import type { DataflowGraph } from '../../../../../graph/graph';
import { VertexType, type DataflowGraphVertexFunctionDefinition } from '../../../../../graph/vertex';
import { EdgeType } from '../../../../../graph/edge';
import { NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { EnvType, type Environment, type REnvironmentInformation } from '../../../../../environments/environment';
import type { FlowrAnalyzerContext } from '../../../../../../project/context/flowr-analyzer-context';
import { attachDependencyToEnvironment } from './built-in-library';
import { define } from '../../../../../environments/define';
import { resolveByName } from '../../../../../environments/resolve-by-name';
import type { IdentifierReference, InGraphIdentifierDefinition } from '../../../../../environments/identifier';

/**
 * The function-definition vertices a `call` resolves to (via {@link EdgeType.Calls}).
 */
function calledDefinitions(graph: DataflowGraph, call: NodeId): NodeId[] {
	const targets: NodeId[] = [];
	for(const [target, edge] of graph.outgoingEdges(call) ?? []) {
		if((edge.types & EdgeType.Calls) !== 0 && graph.getVertex(target)?.tag === VertexType.FunctionDefinition) {
			targets.push(target);
		}
	}
	return targets;
}

/**
 * Computes, for every function-definition vertex `F`, `summary(F) = own(F)` unioned with `summary(G)` over every transitive callee `G`.
 * @param graph - the fully linked dataflow graph
 * @param own   - the effects a single function definition produces itself (its contribution to the summary)
 * @returns a map from each function-definition vertex to its transitive-effect summary
 */
export function computeCallGraphSummaries<T>(this: void, graph: DataflowGraph, own: (id: NodeId, fdef: DataflowGraphVertexFunctionDefinition) => Iterable<T>): Map<NodeId, Set<T>> {
	const summary = new Map<NodeId, Set<T>>();
	const callees = new Map<NodeId, NodeId[]>();
	for(const [id, vertex] of graph.vertices(true)) {
		if(vertex.tag !== VertexType.FunctionDefinition) {
			continue;
		}
		summary.set(id, new Set(own(id, vertex)));
		const targets: NodeId[] = [];
		for(const node of vertex.subflow.graph) {
			if(graph.getVertex(node)?.tag === VertexType.FunctionCall) {
				targets.push(...calledDefinitions(graph, node));
			}
		}
		callees.set(id, targets);
	}
	if(summary.size === 0) {
		return summary;
	}
	// reverse edges: callers of each function
	const callers = new Map<NodeId, NodeId[]>();
	for(const [id, targets] of callees) {
		for(const callee of targets) {
			const existing = callers.get(callee);
			if(existing === undefined) {
				callers.set(callee, [id]);
			} else {
				existing.push(id);
			}
		}
	}
	// worklist fixpoint: pull each callee's summary, re-enqueue callers when a function grew
	const queue = [...summary.keys()];
	const queued = new Set(queue);
	while(queue.length > 0) {
		const id = queue.pop() as NodeId;
		queued.delete(id);
		const effects = summary.get(id) as Set<T>;
		let grew = false;
		for(const callee of callees.get(id) ?? []) {
			for(const effect of summary.get(callee) ?? []) {
				if(!effects.has(effect)) {
					effects.add(effect);
					grew = true;
				}
			}
		}
		if(grew) {
			for(const caller of callers.get(id) ?? []) {
				if(!queued.has(caller)) {
					queued.add(caller);
					queue.push(caller);
				}
			}
		}
	}
	return summary;
}

/** The packages (see {@link EnvType}) attached directly within a function body, i.e. its own `library()` calls. */
function attachedPackages(_id: NodeId, fdef: DataflowGraphVertexFunctionDefinition): string[] {
	const packages: string[] = [];
	for(let e: Environment | undefined = fdef.subflow.environment.current; e !== undefined && !e.builtInEnv; e = e.parent) {
		if(e.t === EnvType.Namespace && e.n !== undefined) {
			packages.push(e.n);
		}
	}
	return packages;
}

/** The non-built-in definitions a function body lets escape to an outer scope (e.g. a `<<-` super-assignment). */
function escapedDefinitions(_id: NodeId, fdef: DataflowGraphVertexFunctionDefinition): NodeId[] {
	const defs: NodeId[] = [];
	// skip the function's own frame; outer-scope definitions escaped
	for(let e: Environment | undefined = fdef.subflow.environment.current.parent; e !== undefined && !e.builtInEnv; e = e.parent) {
		for(const definitions of e.memory.values()) {
			for(const def of definitions) {
				if(!NodeId.isBuiltIn(def.definedAt)) {
					defs.push(def.nodeId);
				}
			}
		}
	}
	return defs;
}

/** Emits {@link EdgeType.SideEffectOnCall} edges for definitions that escape a function transitively. */
function propagateTransitiveDefinitions(graph: DataflowGraph): void {
	const summary = computeCallGraphSummaries(graph, escapedDefinitions);
	for(const [id, vertex] of graph.vertices(true)) {
		if(vertex.tag !== VertexType.FunctionCall) {
			continue;
		}
		for(const target of calledDefinitions(graph, id)) {
			for(const def of summary.get(target) ?? []) {
				graph.addEdge(def, id, EdgeType.SideEffectOnCall);
			}
		}
	}
}

/**
 * Attaches packages transitively loaded by top-level calls to `environment`.
 * `g <- function() library(A); f <- function() g(); f()` makes `A` available after `f()`.
 * @returns the enriched environment and whether it grew (so the caller can re-link and re-run to a fixpoint).
 */
function propagateTransitivePackages(graph: DataflowGraph, environment: REnvironmentInformation, ctx: FlowrAnalyzerContext): { environment: REnvironmentInformation, grew: boolean } {
	const summary = computeCallGraphSummaries(graph, attachedPackages);
	const reachable = new Set<string>();
	for(const [id, vertex] of graph.vertices(true)) {
		if(vertex.tag !== VertexType.FunctionCall || !graph.isRoot(id)) {
			continue;
		}
		for(const target of calledDefinitions(graph, id)) {
			for(const pack of summary.get(target) ?? []) {
				reachable.add(pack);
			}
		}
	}
	let grew = false;
	for(const pack of reachable) {
		const dependency = ctx.deps.getDependency(pack);
		if(dependency === undefined) {
			continue;
		}
		const next = attachDependencyToEnvironment(dependency, environment, ctx);
		if(next !== environment) {
			environment = next;
			grew = true;
		}
	}
	return { environment, grew };
}

/** Maps each escaped definition's node id to its full (name-carrying) definition. */
function escapedDefinitionMap(graph: DataflowGraph): Map<NodeId, InGraphIdentifierDefinition & { name: string }> {
	const map = new Map<NodeId, InGraphIdentifierDefinition & { name: string }>();
	for(const [, vertex] of graph.vertices(true)) {
		if(vertex.tag !== VertexType.FunctionDefinition) {
			continue;
		}
		for(let e: Environment | undefined = vertex.subflow.environment.current.parent; e !== undefined && !e.builtInEnv; e = e.parent) {
			for(const definitions of e.memory.values()) {
				for(const def of definitions) {
					if(!NodeId.isBuiltIn(def.definedAt) && def.name !== undefined) {
						map.set(def.nodeId, def as InGraphIdentifierDefinition & { name: string });
					}
				}
			}
		}
	}
	return map;
}

/**
 * Folds the `<<-` definitions that escape transitively from top-level calls into `environment`.
 * `f <- function() x <<- 1; g <- function() f(); g(); print(x)` makes `x` resolvable.
 * @returns the enriched environment and whether it grew (so the extractor can re-resolve open reads and re-run).
 */
function propagateTransitiveEscapedDefinitions(graph: DataflowGraph, environment: REnvironmentInformation): { environment: REnvironmentInformation, grew: boolean, names: Set<string> } {
	const summary = computeCallGraphSummaries(graph, escapedDefinitions);
	const defs = escapedDefinitionMap(graph);
	const names = new Set<string>();
	let grew = false;
	for(const [id, vertex] of graph.vertices(true)) {
		if(vertex.tag !== VertexType.FunctionCall || !graph.isRoot(id)) {
			continue;
		}
		for(const target of calledDefinitions(graph, id)) {
			for(const nodeId of summary.get(target) ?? []) {
				const def = defs.get(nodeId);
				if(def === undefined) {
					continue;
				}
				names.add(def.name);
				if(resolveByName(def.name, environment, def.type)?.some(d => d.nodeId === nodeId)) {
					continue;
				}
				environment = define(def, false, environment);
				grew = true;
			}
		}
	}
	return { environment, grew, names };
}

/** Re-resolves still-open reads whose name is one of the transitively escaped `<<-` definitions in `escapedNames`, adding {@link EdgeType.Reads} edges. */
export function reResolveOpenReferences(this: void, graph: DataflowGraph, environment: REnvironmentInformation, references: readonly IdentifierReference[], escapedNames: ReadonlySet<string>): void {
	for(const ref of references) {
		if(ref.name === undefined || !escapedNames.has(String(ref.name))) {
			continue;
		}
		for(const { nodeId } of resolveByName(ref.name, environment, ref.type) ?? []) {
			if(!NodeId.isBuiltIn(nodeId) && nodeId !== ref.nodeId) {
				graph.addEdge(ref.nodeId, nodeId, EdgeType.Reads);
			}
		}
	}
}

/**
 * Propagates every function's escaped side effects (attached packages and `<<-` definitions) to its transitive callers.
 * @returns the enriched top-level environment and whether it grew (so the extractor can re-link and re-run to a fixpoint).
 */
export function propagateTransitiveSideEffects(this: void, graph: DataflowGraph, environment: REnvironmentInformation, ctx: FlowrAnalyzerContext): { environment: REnvironmentInformation, grew: boolean, escapedNames: Set<string> } {
	propagateTransitiveDefinitions(graph);
	const packages = propagateTransitivePackages(graph, environment, ctx);
	const escaped = propagateTransitiveEscapedDefinitions(graph, packages.environment);
	return { environment: escaped.environment, grew: packages.grew || escaped.grew, escapedNames: escaped.names };
}
