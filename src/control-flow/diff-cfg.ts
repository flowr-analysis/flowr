/**
 * `Dataflow` spreads {@link GraphHelper} in, and it is built on this file, so the diff pieces are reached
 * through the helper itself here; going through `Dataflow` would be a cycle.
 * @lintIgnore use-instead
 */
import type { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';
import { GraphHelper } from '../dataflow/graph/graph-helper';
import { type GraphDiffContext, type NamedGraph, initDiffContext, GraphDifferenceReport } from '../util/diff-graph';
import { type GenericDiffConfiguration, setDifference } from '../util/diff';
import { CfgEdge, CfgVertex, type ControlFlowGraph } from './control-flow-graph';
import { arrayEqual } from '../util/collections/arrays';


/**
 * Compare two control flow graphs and return a report on the differences.
 * If you simply want to check whether they equal, use {@link GraphDifferenceReport#isEqual|`<result>.isEqual()`}.
 * @see {@link diffDataflowGraph} - for dataflow graphs
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
	GraphHelper.diff.outgoingEdges(ctx, diffEdges);
}

function diffRootVertices(ctx: GraphDiffContext<ControlFlowGraph>): void {
	setDifference(ctx.left.rootIds(), ctx.right.rootIds(), {
		...ctx,
		position: `${ctx.position}Root vertices differ in graphs. `
	});
}

function diffVertices(ctx: GraphDiffContext<ControlFlowGraph>): void {
	const lVert = [...ctx.left.vertices(false).entries()];
	const rVert = [...ctx.right.vertices(false).entries()];
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
		const lTargets = CfgVertex.getCallTargets(lInfo);
		const rTargets = CfgVertex.getCallTargets(rInfo);
		if(lTargets !== undefined || rTargets !== undefined) {
			setDifference(lTargets ?? new Set(), rTargets ?? new Set(), {
				...ctx,
				position: `${ctx.position}Vertex ${id} differs in call targets. `
			});
		}

		setDifference(new Set(CfgVertex.getChildren(lInfo)), new Set(CfgVertex.getChildren(rInfo)), {
			...ctx,
			position: `${ctx.position}Vertex ${id} differs in children. `
		});
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
	GraphHelper.diff.edges(ctx, id, lEdges, rEdges, diffEdge);
}
