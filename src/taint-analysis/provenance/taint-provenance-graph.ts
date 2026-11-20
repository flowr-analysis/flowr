import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { AnyAbstractDomain } from '../../abstract-interpretation/domains/abstract-domain';
import { DataflowGraph } from '../../dataflow/graph/graph';
import type { DataflowGraphVertexInfo } from '../../dataflow/graph/vertex';
import { DfEdge, EdgeType } from '../../dataflow/graph/edge';
import { GraphHelper } from '../../dataflow/graph/graph-helper';
import { Dataflow } from '../../dataflow/graph/df-helper';
import { SourceLocation } from '../../util/range';
import { Mermaid } from '../../util/mermaid/mermaid';
import { toBase64 } from '../../util/text/url-encoding';
import type { TaintRole, TaintRuleRecord } from '../taint-mapping';

/** How the taint of a call was resolved, see {@link TaintProvenanceAnnotation.call}. */
export interface TaintCallResolution extends Omit<TaintRuleRecord, 'inputs'> {
	/** The role of the mapping that decided the taint */
	readonly role?:     TaintRole
	/** The function category of the mapping that decided the taint */
	readonly category?: string
}

/**
 * What is annotated for a vertex of the {@link TaintProvenanceGraph}.
 */
export interface TaintProvenanceAnnotation {
	/** The source code of the node, if known */
	readonly code?: string
	/** The source location of the node, if known */
	readonly loc?:  SourceLocation
	/** The taint value of the node */
	readonly value: AnyAbstractDomain
	/** How the taint of the call was resolved */
	readonly call?: TaintCallResolution
}

/** A vertex of the dataflow graph, annotated with what the taint analysis inferred for it. */
export type TaintProvenanceVertex = DataflowGraphVertexInfo & { readonly taint: TaintProvenanceAnnotation };

/**
 * A taint provenance graph is a dataflow graph whose vertices are the calls and inputs of a taint analysis, each
 * annotated with its taint: a call points to its inputs, and an input to the calls its value stems from.
 * You can record one with {@link TaintAnalysis.withProvenance}.
 * If you want to extract the part a finding stems from, use {@link TaintProvenanceGraph.ofFinding}.
 * @see {@link TaintProvenanceGraph.hidePassthrough} - to hide the vertices that only pass a value on
 */
export type TaintProvenanceGraph = DataflowGraph<TaintProvenanceVertex>;

/**
 * A call that explains the taint of a finding.
 */
export interface TaintOrigin extends Omit<TaintProvenanceAnnotation, 'call'>, TaintCallResolution {
	/** The inputs of the call with their taints */
	readonly inputs: readonly { readonly node: NodeId, readonly taint: AnyAbstractDomain | undefined }[]
	/** How many calls lie between the call and the finding */
	readonly depth:  number
}

/** Keeps only the vertices for which `isKept` holds and links each of them directly to the next kept vertices it reaches, skipping all others. */
function contract(graph: TaintProvenanceGraph, isKept: (vertex: TaintProvenanceVertex) => boolean): TaintProvenanceGraph {
	const result: TaintProvenanceGraph = new DataflowGraph(graph.idMap);
	const kept = new Set<NodeId>();
	for(const [id, vertex] of graph.vertices(true)) {
		if(isKept(vertex)) {
			kept.add(id);
			result.addVertex(vertex, undefined, true);
		}
	}
	for(const from of kept) {
		const visited = new Set<NodeId>([from]);
		const toVisit: [NodeId, number][] = [...graph.edgesFrom(from)].map(([to, edge]) => [to, edge.types]);
		for(let next = toVisit.pop(); next !== undefined; next = toVisit.pop()) {
			const [current, types] = next;
			if(visited.has(current)) {
				continue;
			}
			visited.add(current);
			if(kept.has(current)) {
				result.addEdge(from, current, types);
			} else {
				toVisit.push(...[...graph.edgesFrom(current)].map(([to]): [NodeId, number] => [to, EdgeType.Reads]));
			}
		}
	}
	return result;
}

/**
 * Helper object for taint provenance graphs, you can record new taint provenance graphs based on {@link TaintAnalysis.withProvenance}.
 * @helper dataflow
 * @see {@link Dataflow}
 * @see {@link TaintProvenanceGraph}
 */
export const TaintProvenanceGraph = {
	...GraphHelper,
	name: 'TaintProvenanceGraph',
	/**
	 * The part of a provenance graph the taint of the given node stems from
	 * @param graph  - The provenance graph
	 * @param nodeId - The node to start from, e.g., a finding
	 */
	ofFinding(this: void, graph: TaintProvenanceGraph, nodeId: NodeId): TaintProvenanceGraph {
		return Dataflow.reduceGraph(graph, graph.hasVertex(nodeId) ? Dataflow.reachable(graph, nodeId) : new Set());
	},
	/**
	 * Hides all nodes that only pass a value on, i.e. variables and alias calls
	 * @param graph - The provenance graph
	 * @param keep  - Nodes that are always shown, such as the finding the graph is rendered for
	 */
	hidePassthrough(this: void, graph: TaintProvenanceGraph, keep: Iterable<NodeId> = []): TaintProvenanceGraph {
		const kept = new Set(keep);
		return contract(graph, ({ id, taint }) => kept.has(id) || graph.edgesFrom(id).size === 0 || (taint.call !== undefined && !taint.call.passthrough));
	},
	/**
	 * The calls that explain the taint of a finding, ordered from the finding towards the sources the taint stems from
	 * @param graph  - The provenance graph of the analysis
	 * @param nodeId - The id of the finding
	 */
	origins(this: void, graph: TaintProvenanceGraph, nodeId: NodeId): TaintOrigin[] {
		const finding = TaintProvenanceGraph.ofFinding(graph, nodeId);
		const shown = TaintProvenanceGraph.hidePassthrough(finding, [nodeId]);
		const depth = new Map<NodeId, number>([[nodeId, 0]]);
		const queue = [nodeId];
		for(const id of queue) {
			for(const to of shown.edgesFrom(id).keys()) {
				if(!depth.has(to)) {
					depth.set(to, (depth.get(id) ?? 0) + 1);
					queue.push(to);
				}
			}
		}
		const origins = [...shown.vertices(true)].flatMap(([id, { taint: { call, ...annotation } }]) => {
			if(call === undefined || annotation.value.isTop()) {
				return [];
			}
			const inputs = [...finding.edgesFrom(id).keys()].map(input => ({ node: input, taint: finding.getVertex(input)?.taint.value }));
			return [{ ...annotation, ...call, inputs, depth: depth.get(id) ?? 0 }];
		});
		if(origins.length === 0) {
			return [];
		}
		const offset = Math.min(...origins.map(origin => origin.depth));
		return origins
			.map(origin => ({ ...origin, depth: origin.depth - offset }))
			.sort((a, b) => a.depth - b.depth || (a.loc && b.loc ? SourceLocation.compare(b.loc, a.loc) : 0));
	},
	/**
	 * Converts a provenance graph into a JSON-serializable object.
	 * @param graph - The provenance graph
	 */
	toJson(this: void, graph: TaintProvenanceGraph): { nodes: object[], edges: { from: NodeId, to: NodeId, types: string[] }[] } {
		return {
			nodes: [...graph.vertices(true)].map(([id, { taint: { code, loc, value, call } }]) => ({ id, code, loc, value: value.toJSON(), ...call })),
			edges: [...graph.edges()].flatMap(([from, targets]) => [...targets].map(([to, edge]) => ({ from, to, types: DfEdge.splitTypes(edge).map(DfEdge.typeToName) })))
		};
	},
	/**
	 * Renders a provenance graph as mermaid code with the dataflow graph visualization
	 * @param graph - The provenance graph to render
	 * @param name  - The name of the taint analysis, shown alongside the taints
	 */
	toMermaid(this: void, graph: TaintProvenanceGraph, name?: string): string {
		return Dataflow.visualize.mermaid.convert({
			graph,
			annotate: (id: NodeId) => {
				const taint = graph.getVertex(id)?.taint;
				if(taint === undefined) {
					return undefined;
				}
				const value = `**${Mermaid.escape(taint.value.toString())}**`;
				const named = name === undefined ? value : `${Mermaid.escape(name)}: ${value}`;
				const notes = taint.call?.notes ?? [];
				return notes.length > 0 ? `${named} (${Mermaid.escape(notes.join(', '))})` : named;
			}
		}).string;
	},
	/**
	 * Renders a provenance graph as a link to the mermaid live viewer, see {@link TaintProvenanceGraph.toMermaid}.
	 * @param graph - The provenance graph to render
	 * @param name  - The name of the taint analysis, shown alongside the taints
	 */
	toMermaidUrl(this: void, graph: TaintProvenanceGraph, name?: string): string {
		const state = { code: TaintProvenanceGraph.toMermaid(graph, name), mermaid: JSON.stringify({ theme: 'default' }), autoSync: true };
		return `https://mermaid.live/view#base64:${toBase64(new TextEncoder().encode(JSON.stringify(state)))}`;
	}
} as const;
