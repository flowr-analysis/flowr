import type { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { GenericDiffConfiguration, GenericDifferenceInformation, WriteableDifferenceReport } from './diff';
import type { DataflowGraph } from '../dataflow/graph/graph';
import { jsonReplacer } from './json';

export interface NamedGraph<Graph = DataflowGraph> {
	name:  string,
	graph: Graph
}

interface ProblematicVertex {
	tag: 'vertex',
	id:  NodeId
}

interface ProblematicEdge {
	tag:  'edge',
	from: NodeId,
	to:   NodeId
}

export type ProblematicDiffInfo = ProblematicVertex | ProblematicEdge;

/**
 * To be produced by a function differencing two graphs (e.g., {@link DataflowGraph|DFGs} or {@link ControlFlowGraph|CFGs}).
 * @see {@link GraphDifferenceReport#isEqual|isEqual} - to check whether the graphs are equal
 * @see {@link GraphDifferenceReport#addComment|addComment} - to add comments to the report
 * @see {@link GraphDifferenceReport#comments|comments} - to get the attached comments
 * @see {@link GraphDifferenceReport#problematic|problematic} - to get the problematic vertices/edges
 */
export class GraphDifferenceReport implements WriteableDifferenceReport {
	_comments:    string[] | undefined = undefined;
	_problematic: ProblematicDiffInfo[] | undefined = undefined;

	addComment(comment: string, ...related: readonly ProblematicDiffInfo[]): void {
		if(this._comments === undefined) {
			this._comments = [comment];
		} else {
			this._comments.push(comment);
		}
		if(related.length > 0) {
			if(this._problematic === undefined) {
				this._problematic = [...related];
			} else {
				this._problematic.push(...related);
			}
		}
	}

	comments(): readonly string[] | undefined {
		return this._comments;
	}

	problematic(): readonly ProblematicDiffInfo[] | undefined {
		return this._problematic;
	}

	isEqual(): boolean {
		return this._comments === undefined;
	}
}

/**
 * A context that can be used by differencing functions to compare two graphs
 * See {@link initDiffContext} for a function that creates such a context.
 */
export interface GraphDiffContext<Graph = DataflowGraph> extends GenericDifferenceInformation<GraphDifferenceReport> {
	left:   Graph
	right:  Graph
	config: GenericDiffConfiguration
}

/**
 * Create the context for differencing two graphs
 */
export function initDiffContext<Graph>(left: NamedGraph<Graph>, right: NamedGraph<Graph>, config?: Partial<GenericDiffConfiguration>): GraphDiffContext<Graph> {
	return {
		left:      left.graph,
		leftname:  left.name,
		right:     right.graph,
		rightname: right.name,
		report:    new GraphDifferenceReport(),
		position:  '',
		config:    {
			rightIsSubgraph: false,
			leftIsSubgraph:  false,
			...config
		}
	};
}

/** The minimum a graph has to offer for {@link GraphDiff} to compare its edges. */
export interface EdgeIndexedGraph<EdgeMap> {
	edges():   Iterable<readonly [NodeId, EdgeMap]>
	hasVertex(id: NodeId): boolean
}

/**
 * Index the edges of a graph, optionally narrowing every entry to the part the comparison cares about.
 * Sources whose edges the projection drops entirely do not take part in the comparison.
 */
function collectEdges<EdgeMap>(graph: EdgeIndexedGraph<EdgeMap>, project?: (edges: EdgeMap) => EdgeMap | undefined): Map<NodeId, EdgeMap> {
	const result = new Map<NodeId, EdgeMap>();
	for(const [id, edges] of graph.edges()) {
		const projected = project ? project(edges) : edges;
		if(projected !== undefined) {
			result.set(id, projected);
		}
	}
	return result;
}

/** The edge-differencing steps shared by the dataflow and the control flow graph diff. */
export const GraphDiff = {
	/** Compares all edges of both graphs vertex by vertex, handing each pair to `diffEdges`. */
	outgoingEdges<EdgeMap, Graph extends EdgeIndexedGraph<EdgeMap>>(
		this: void,
		ctx: GraphDiffContext<Graph>,
		diffEdges: (ctx: GraphDiffContext<Graph>, id: NodeId, lEdges: EdgeMap | undefined, rEdges: EdgeMap | undefined) => void,
		project?: (edges: EdgeMap) => EdgeMap | undefined
	): void {
		const lEdges = collectEdges(ctx.left, project);
		const rEdges = collectEdges(ctx.right, project);

		if(lEdges.size < rEdges.size && !ctx.config.leftIsSubgraph || lEdges.size > rEdges.size && !ctx.config.rightIsSubgraph) {
			ctx.report.addComment(`Detected different number of edges! ${ctx.leftname} has ${lEdges.size} (${JSON.stringify(lEdges, jsonReplacer)}). ${ctx.rightname} has ${rEdges.size} ${JSON.stringify(rEdges, jsonReplacer)}`);
		}

		for(const [id, edge] of lEdges) {
			/* This has nothing to do with the subset relation as we verify this in the same graph.
			 * Yet we still do the check as a subgraph may not have to have all source vertices for edges.
			 */
			if(!ctx.left.hasVertex(id)) {
				if(!ctx.config.leftIsSubgraph) {
					ctx.report.addComment(`The source ${id} of edges ${JSON.stringify(edge, jsonReplacer)} is not present in ${ctx.leftname}. This means that the graph contains an edge but not the corresponding vertex.`);
					continue;
				}
			}
			diffEdges(ctx, id, edge, rEdges.get(id));
		}
		// just to make it both ways in case the length differs
		for(const [id, edge] of rEdges) {
			if(!ctx.right.hasVertex(id)) {
				if(!ctx.config.rightIsSubgraph) {
					ctx.report.addComment(`The source ${id} of edges ${JSON.stringify(edge, jsonReplacer)} is not present in ${ctx.rightname}. This means that the graph contains an edge but not the corresponding vertex.`);
					continue;
				}
			}
			if(!ctx.config.leftIsSubgraph && !lEdges.has(id)) {
				diffEdges(ctx, id, undefined, edge);
			}
			/* otherwise, we already cover the edge above */
		}
	},
	/** Compares the outgoing edges of a single vertex, handing each pair of edges to `diffEdge`. */
	edges<Edge, Graph>(
		this: void,
		ctx: GraphDiffContext<Graph>,
		id: NodeId,
		lEdges: ReadonlyMap<NodeId, Edge> | undefined,
		rEdges: ReadonlyMap<NodeId, Edge> | undefined,
		diffEdge: (edge: Edge, otherEdge: Edge, ctx: GraphDiffContext<Graph>, id: NodeId, target: NodeId) => void
	): void {
		if(lEdges === undefined || rEdges === undefined) {
			if(
				(lEdges === undefined && !ctx.config.leftIsSubgraph)
				|| (rEdges === undefined && !ctx.config.rightIsSubgraph)
			) {
				ctx.report.addComment(
					`Vertex ${id} has undefined outgoing edges. ${ctx.leftname}: ${JSON.stringify(lEdges, jsonReplacer)} vs ${ctx.rightname}: ${JSON.stringify(rEdges, jsonReplacer)}`,
					{ tag: 'vertex', id }
				);
			}
			return;
		}

		if(
			lEdges.size < rEdges.size && !ctx.config.leftIsSubgraph
			|| lEdges.size > rEdges.size && !ctx.config.rightIsSubgraph
		) {
			ctx.report.addComment(
				`Vertex ${id} differs in number of outgoing edges. ${ctx.leftname}: [${[...lEdges.keys()].join(',')}] vs ${ctx.rightname}: [${[...rEdges.keys()].join(',')}] `,
				{ tag: 'vertex', id }
			);
		}
		// order independent compare
		for(const [target, edge] of lEdges) {
			const otherEdge = rEdges.get(target);
			if(otherEdge === undefined) {
				if(!ctx.config.rightIsSubgraph) {
					ctx.report.addComment(
						`Target of ${id}->${target} in ${ctx.leftname} is not present in ${ctx.rightname}`,
						{ tag: 'edge', from: id, to: target }
					);
				}
				continue;
			}
			diffEdge(edge, otherEdge, ctx, id, target);
		}
	}
} as const;