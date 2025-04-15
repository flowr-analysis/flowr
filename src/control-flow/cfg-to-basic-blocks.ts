import type { CfgEdge, ControlFlowInformation } from './control-flow-graph';
import { CfgEdgeType, CfgVertexType, ControlFlowGraph } from './control-flow-graph';
import type { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';

/** if true, return the target */
function singleOutgoingFd(outgoing: ReadonlyMap<NodeId, CfgEdge> | undefined): NodeId | undefined {
	if(!outgoing) {
		return undefined;
	}

	const outgoingNonCalls = [...outgoing.entries()].filter(([_, edge]) => edge.label !== CfgEdgeType.Call);

	if(outgoingNonCalls.length !== 1) {
		return undefined;
	}

	const next = outgoingNonCalls[0];
	if(next?.[1].label === CfgEdgeType.Fd) {
		return next[0];
	} else {
		return undefined;
	}
}

/**
 * Take a control flow graph without any basic blocks and convert it to a graph with basic blocks.
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

		const outgoing = newCfg.outgoing(id);
		const target = singleOutgoingFd(outgoing);
		if(target) {
			const targetIn = newCfg.ingoing(target);
			if(targetIn && targetIn.size === 1) {
				newCfg.mergeTwoBasicBlocks(id, target);
			}
		}
		const ingoing = newCfg.ingoing(id);
		const ingoingTarget = singleOutgoingFd(ingoing);
		if(ingoingTarget) {
			const ingoingOut = newCfg.outgoing(ingoingTarget);
			if(ingoingOut && ingoingOut.size === 1) {
				newCfg.mergeTwoBasicBlocks(ingoingTarget, id);
			}
		}
	}


	// TODO: check in and outputs to attach entry and exit points
	const findEntries = cfInfo.entryPoints.map(e => newCfg.getBasicBlock(e)?.id);
	const findExits = cfInfo.exitPoints.map(e => newCfg.getBasicBlock(e)?.id);

	if(findEntries.some(f => f === undefined) || findExits.some(f => f === undefined)) {
		/* something went wrong */
		return cfInfo;
	}

	const res = {
		...cfInfo,
		graph:       newCfg,
		entryPoints: findEntries as NodeId[],
		exitPoints:  findExits as NodeId[],
	};

	return res;
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