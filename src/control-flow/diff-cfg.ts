import { jsonReplacer } from '../util/json';
import type { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';
import { type GraphDiffContext, type NamedGraph, initDiffContext, GraphDifferenceReport } from '../util/diff-graph';
import { type GenericDiffConfiguration, setDifference } from '../util/diff';
import { CfgEdge, CfgVertex, type ControlFlowGraph } from './control-flow-graph';
import { arrayEqual } from '../util/collections/arrays';


/**
 * Compare two control flow graphs and return a report on the differences.
 * If you simply want to check whether they equal, use {@link GraphDifferenceReport#isEqual|`<result>.isEqual()`}.
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
	setDifference(ctx.left.rootIds(), ctx.right.rootIds(), {
		...ctx,
		position: `${ctx.position}Root vertices differ in graphs. `
	});
}

function diffVertices(ctx: GraphDiffContext<ControlFlowGraph>): void {
	const lVert = ctx.left.vertices(false).entries().map(([id, info]) => ([id, info] as const)).toArray();
	const rVert = ctx.right.vertices(false).entries().map(([id, info]) => ([id, info] as const)).toArray();
	if(lVert.length < rVert.length && !ctx.config.leftIsSubgraph
        || lVert.length > rVert.length && !ctx.config.rightIsSubgraph
	) {
		ctx.report.addComment(`Detected different number of vertices! ${ctx.leftname} has ${lVert.length}, ${ctx.rightname} has ${rVert.length}`);
	}

	for(const [id, lInfo] of lVert) {
		const rInfo = ctx.right.getVertex(id, false);
		if(rInfo === undefined) {
			if(!ctx.config.rightIsSubgraph) {
				ctx.report.addComment(`Vertex ${id} is not present in ${ctx.rightname}`, { tag: 'vertex', id });
			}
			continue;
		}
		const lType = CfgVertex.getType(lInfo);
		const rType = CfgVertex.getType(rInfo);
		if(lType !== rType) {
			ctx.report.addComment(`Vertex ${id} differs in tags. ${ctx.leftname}: ${CfgVertex.typeToString(lType)} vs. ${ctx.rightname}: ${CfgVertex.typeToString(rType)}`, {
				tag: 'vertex',
				id
			});
		}

		const lCt = CfgVertex.getCallTargets(lInfo);
		const rCt = CfgVertex.getCallTargets(rInfo);
		if(lCt !== undefined || rCt !== undefined) {
			setDifference(
				new Set(lCt ?? []),
				new Set(rCt ?? []),
				{
					...ctx,
					position: `${ctx.position}Vertex ${id} differs in call targets. `
				}
			);
		}

		const lElems = CfgVertex.isBlock(lInfo) ? CfgVertex.getBasicBlockElements(lInfo) : undefined;
		const rElems = CfgVertex.isBlock(rInfo) ? CfgVertex.getBasicBlockElements(rInfo) : undefined;
		if(lElems !== undefined || rElems !== undefined) {
			if(!arrayEqual(
				(lElems ?? []) as CfgVertex[],
				(rElems ?? []) as CfgVertex[],
				CfgVertex.equal
			)) {
				ctx.report.addComment(
					`Vertex ${id} differs in elems.\n  ${ctx.leftname}: ${JSON.stringify(lElems)}\n  vs\n  ${ctx.rightname}: ${JSON.stringify(rElems)}`,
					{ tag: 'vertex', id }
				);
			}
		}
		setDifference(new Set(CfgVertex.getMid(lInfo) ?? []), new Set(CfgVertex.getMid(rInfo) ?? []), {
			...ctx,
			position: `${ctx.position}Vertex ${id} differs in attached mid markers. `
		});
		setDifference(new Set(CfgVertex.getEnd(lInfo) ?? []), new Set(CfgVertex.getEnd(rInfo) ?? []), {
			...ctx,
			position: `${ctx.position}Vertex ${id} differs in attached end markers. `
		});

		const lRoot = CfgVertex.getRootId(lInfo);
		const rRoot = CfgVertex.getRootId(rInfo);
		if(lRoot !== rRoot) {
			ctx.report.addComment(`Vertex ${id} differs in root. ${ctx.leftname}: ${JSON.stringify(lRoot)} vs ${ctx.rightname}: ${JSON.stringify(rRoot)}`, {
				tag: 'vertex',
				id
			});
		}

		setDifference(new Set(CfgVertex.getChildren(lInfo)), new Set(CfgVertex.getChildren(rInfo)), {
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
	const el = CfgEdge.getType(edge);
	const ol = CfgEdge.getType(otherEdge);
	if(el !== ol) {
		ctx.report.addComment(
			`Edge ${id}->${target} differs in labels. ${ctx.leftname}: ${el} vs ${ctx.rightname}: ${ol}`,
			{ tag: 'edge', from: id, to: target }
		);
	}
	const ec = CfgEdge.getCause(edge);
	const oc = CfgEdge.getCause(otherEdge);
	if(ec !== oc) {
		ctx.report.addComment(
			`Edge ${id}->${target} differs in caused. ${ctx.leftname}: ${JSON.stringify(ec)} vs ${ctx.rightname}: ${JSON.stringify(oc)}`,
			{ tag: 'edge', from: id, to: target }
		);
	}
	const ew = CfgEdge.getWhen(edge);
	const ow = CfgEdge.getWhen(otherEdge);
	if(ew !== ow) {
		ctx.report.addComment(
			`Edge ${id}->${target} differs in when. ${ctx.leftname}: ${JSON.stringify(ew)} vs ${ctx.rightname}: ${JSON.stringify(ow)}`,
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
