import { CfgEdge, type ControlFlowInformation, CfgVertexType, ControlFlowGraph } from './control-flow-graph';
import type { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';

/** if true, return the target */
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
		if(vtx.type !== CfgVertexType.Block) {
			continue;
		}

		const outgoing = newCfg.outgoingEdges(id);
		const target = singleOutgoingFd(outgoing);
		if(target) {
			const targetIn = newCfg.ingoingEdges(target);
			if(targetIn && targetIn.size === 1) {
				newCfg.mergeTwoBasicBlocks(id, target);
			}
		}
		const ingoing = newCfg.ingoingEdges(id);
		const ingoingTarget = singleOutgoingFd(ingoing);
		if(ingoingTarget) {
			const ingoingOut = newCfg.outgoingEdges(ingoingTarget);
			if(ingoingOut && ingoingOut.size === 1) {
				newCfg.mergeTwoBasicBlocks(ingoingTarget, id);
			}
		}
	}

	const findEntries = cfInfo.entryPoints.map(e => newCfg.getBasicBlock(e)?.id);
	const findExits = cfInfo.exitPoints.map(e => newCfg.getBasicBlock(e)?.id);

	if(findEntries.some(f => f === undefined) || findExits.some(f => f === undefined)) {
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
		if(vertex.type === CfgVertexType.Block) {
			return undefined;
		}
		newGraph.addVertex({
			type:  CfgVertexType.Block,
			elems: [vertex],
			id:    'bb-' + id,
		});
	}

	// promote all edges
	for(const [from, outgoing] of existing.edges().entries()) {
		for(const [to, edge] of outgoing.entries()) {
			newGraph.addEdge('bb-' + from, 'bb-' + to, edge);
		}
	}

	return newGraph;
}