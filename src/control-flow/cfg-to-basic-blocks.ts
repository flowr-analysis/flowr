import { CfgEdge, type ControlFlowInformation, ControlFlowGraph, CfgVertex } from './control-flow-graph';
import type { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';
import { isUndefined } from '../util/assert';

/** the single vertex the given edges connect to, if there is exactly one and it is a flow dependency */
function singleOutgoingFd(outgoing: ReadonlyMap<NodeId, CfgEdge> | undefined): NodeId | undefined {
	if(!outgoing || outgoing.size !== 1) {
		return undefined;
	}

	const next = outgoing.entries().next().value;
	if(CfgEdge.isFlowDependency(next?.[1])) {
		return next[0];
	} else {
		return undefined;
	}
}

/**
 * Take a control flow information of a graph without any basic blocks and convert it to a graph with basic blocks.
 */
export function convertCfgToBasicBlocks(cfInfo: ControlFlowInformation): ControlFlowInformation {
	const newCfg = wrapEveryVertexInBasicBlock(cfInfo.graph);
	if(!newCfg) {
		return cfInfo;
	}

	for(const [id, vtx] of newCfg.vertices(false)) {
		if(!CfgVertex.isBlock(vtx)) {
			continue;
		}

		const next = singleOutgoingFd(newCfg.outgoingEdges(id));
		if(next) {
			const into = newCfg.ingoingEdges(next);
			if(into && into.size === 1) {
				newCfg.mergeTwoBasicBlocks(id, next);
			}
		}
		const previous = singleOutgoingFd(newCfg.ingoingEdges(id));
		if(previous) {
			const outOf = newCfg.outgoingEdges(previous);
			if(outOf && outOf.size === 1) {
				newCfg.mergeTwoBasicBlocks(previous, id);
			}
		}
	}

	const findEntries = cfInfo.entryPoints.map(e => CfgVertex.getId(newCfg.getBasicBlock(e)));
	const findExits = cfInfo.exitPoints.map(e => CfgVertex.getId(newCfg.getBasicBlock(e)));

	if(findEntries.some(isUndefined) || findExits.some(isUndefined)) {
		/* something went wrong */
		return cfInfo;
	}

	return {
		...cfInfo,
		graph:       newCfg,
		entryPoints: findEntries as NodeId[],
		exitPoints:  findExits as NodeId[],
	};
}


/** only returns undefined when the cfg already contains basic blocks */
function wrapEveryVertexInBasicBlock(existing: ControlFlowGraph): ControlFlowGraph | undefined {
	const newGraph = new ControlFlowGraph();

	for(const [id, vertex] of existing.vertices(false)) {
		if(CfgVertex.isBlock(vertex)) {
			return undefined;
		}
		newGraph.addVertex(CfgVertex.makeBlock(CfgVertex.toBasicBlockId(id), [vertex]));
	}

	// promote all edges
	for(const [from, outgoing] of existing.edges().entries()) {
		for(const [to, edge] of outgoing.entries()) {
			newGraph.addEdge(CfgVertex.toBasicBlockId(from), CfgVertex.toBasicBlockId(to), edge);
		}
	}

	return newGraph;
}