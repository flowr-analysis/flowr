import { jsonReplacer } from '../util/json';
import type { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { GraphDiffContext, NamedGraph } from '../util/diff-graph';
import { initDiffContext , GraphDifferenceReport } from '../util/diff-graph';
import type { GenericDiffConfiguration } from '../util/diff';
import { setDifference } from '../util/diff';
import type { CfgEdge, ControlFlowGraph } from './control-flow-graph';


/**
 * Compare two control flow graphs and return a report on the differences.
 * If you simply want to check whether they equal, use {@link GraphDifferenceReport#isEqual|`<result>.isEqual()`}.
 *
 * @see {@link diffOfDataflowGraphs} - for dataflow graphs
 */
export function diffOfControlFlowGraphs(left: NamedGraph<ControlFlowGraph>, right: NamedGraph<ControlFlowGraph>, config?: Partial<GenericDiffConfiguration>): GraphDifferenceReport {
	if(left.graph === right.graph) {
		return new GraphDifferenceReport();
	}

	const ctx = initDiffContext(left, right, config);
	diffDataflowGraphs(ctx);
	return ctx.report;
}


function diffDataflowGraphs(ctx: GraphDiffContext<ControlFlowGraph>): void {
	diffRootVertices(ctx);
	diffVertices(ctx);
	diffOutgoingEdges(ctx);
}

function diffRootVertices(ctx: GraphDiffContext<ControlFlowGraph>): void {
	setDifference(ctx.left.rootVertexIds(), ctx.right.rootVertexIds(), {
		...ctx,
		position: `${ctx.position}Root vertices differ in graphs. `
	});
}

function diffVertices(ctx: GraphDiffContext<ControlFlowGraph>): void {
	const lVert = [...ctx.left.vertices()].map(([id, info]) => ([id, info] as const));
	const rVert = [...ctx.right.vertices()].map(([id, info]) => ([id, info] as const));
	if(lVert.length < rVert.length && !ctx.config.leftIsSubgraph
        || lVert.length > rVert.length && !ctx.config.rightIsSubgraph
	) {
		ctx.report.addComment(`Detected different number of vertices! ${ctx.leftname} has ${lVert.length}, ${ctx.rightname} has ${rVert.length}`);
	}

	for(const [id, lInfo] of lVert) {
		const rInfo = ctx.right.getVertex(id);
		if(rInfo === undefined) {
			if(!ctx.config.rightIsSubgraph) {
				ctx.report.addComment(`Vertex ${id} is not present in ${ctx.rightname}`, { tag: 'vertex', id });
			}
			continue;
		}
		if(lInfo.type !== rInfo.type) {
			ctx.report.addComment(`Vertex ${id} differs in tags. ${ctx.leftname}: ${lInfo.type} vs. ${ctx.rightname}: ${rInfo.type}`, {
				tag: 'vertex',
				id
			});
		}

		if(lInfo.kind !== undefined || rInfo.kind !== undefined) {
			if(lInfo.kind !== rInfo.kind) {
				ctx.report.addComment(`Vertex ${id} differs in kinds. ${ctx.leftname}: ${String(lInfo.kind)} vs ${ctx.rightname}: ${String(rInfo.kind)}`, {
					tag: 'vertex',
					id
				});
			}
		}
		setDifference(new Set(lInfo.mid as NodeId[] | undefined ?? []), new Set(rInfo.mid as NodeId[] | undefined ?? []), {
			...ctx,
			position: `${ctx.position}Vertex ${id} differs in attached mid markers. `
		});
		setDifference(new Set(lInfo.end as NodeId[] | undefined ?? []), new Set(rInfo.end as NodeId[] | undefined ?? []), {
			...ctx,
			position: `${ctx.position}Vertex ${id} differs in attached end markers. `
		});

		if(lInfo.root !== rInfo.root) {
			ctx.report.addComment(`Vertex ${id} differs in root. ${ctx.leftname}: ${JSON.stringify(lInfo.root)} vs ${ctx.rightname}: ${JSON.stringify(rInfo.root)}`, {
				tag: 'vertex',
				id
			});
		}

		setDifference(new Set(lInfo.children), new Set(rInfo.children), {
			...ctx,
			position: `${ctx.position}Vertex ${id} differs in chilren. `
		});
	}
}

function diffOutgoingEdges(ctx: GraphDiffContext<ControlFlowGraph>): void {
	const lEdges = new Map([...ctx.left.edges()]);
	const rEdges = new Map([...ctx.right.edges()]);

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
}

function diffEdge(edge: CfgEdge, otherEdge: CfgEdge, ctx: GraphDiffContext<ControlFlowGraph>, id: NodeId, target: NodeId) {
	if(edge.label !== otherEdge.label) {
		ctx.report.addComment(
			`Edge ${id}->${target} differs in labels. ${ctx.leftname}: ${edge.label} vs ${ctx.rightname}: ${otherEdge.label}`,
			{ tag: 'edge', from: id, to: target }
		);
	}
	if(edge.caused !== otherEdge.caused) {
		ctx.report.addComment(
			`Edge ${id}->${target} differs in caused. ${ctx.leftname}: ${JSON.stringify(edge.caused)} vs ${ctx.rightname}: ${JSON.stringify(otherEdge.caused)}`,
			{ tag: 'edge', from: id, to: target }
		);
	}
	if(edge.when !== otherEdge.when) {
		ctx.report.addComment(
			`Edge ${id}->${target} differs in when. ${ctx.leftname}: ${JSON.stringify(edge.when)} vs ${ctx.rightname}: ${JSON.stringify(otherEdge.when)}`,
			{ tag: 'edge', from: id, to: target }
		);
	}
}

function diffEdges(ctx: GraphDiffContext<ControlFlowGraph>, id: NodeId, lEdges: ReadonlyMap<NodeId, CfgEdge> | undefined, rEdges: ReadonlyMap<NodeId, CfgEdge> | undefined): void {
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
