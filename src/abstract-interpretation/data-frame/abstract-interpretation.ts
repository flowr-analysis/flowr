import type { DataflowGraph } from '../../dataflow/graph/graph';
import type { RConstant, RNode, RSingleNode } from '../../r-bridge/lang-4.x/ast/model/model';
import type { ParentInformation } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { RType } from '../../r-bridge/lang-4.x/ast/model/type';
import { CfgVertexType, ControlFlowGraph, type CfgVertex, type ControlFlowInformation } from '../../util/cfg/cfg';
import type { AbstractInterpretationInfo } from './absint-info';
import type { DataFrameDomain, DataFrameStateDomain } from './domain';
import { equalDataFrameState, joinDataFrameStates, wideningDataFrameStates } from './domain';
import { processDataFrameExpression, processDataFrameLeaf } from './processor';

const WideningThreshold = 4;

export function performDataFrameAbsint(cfinfo: ControlFlowInformation, dfg: DataflowGraph): DataFrameStateDomain {
	const visited: Map<NodeId, number> = new Map();
	let finalDomain: DataFrameStateDomain = new Map();

	const visitor = (cfg: ControlFlowGraph, dfg: DataflowGraph, vertex: CfgVertex): CfgVertex[] => {
		if(shouldSkipVertex(vertex, dfg)) {
			return getSuccessorVertices(cfg, vertex.id, dfg);
		}
		const predecessors = getPredecessorNodes(cfg, vertex.id, dfg);
		const inputDomain = joinDataFrameStates(...predecessors.map(node => node.info.dataFrame?.domain ?? new Map()));
		let oldDomain = new Map<NodeId, DataFrameDomain>();
		let newDomain = inputDomain;

		const entryNode: RNode<ParentInformation & AbstractInterpretationInfo> | undefined = dfg.idMap?.get(vertex.id);
		let node: RNode<AbstractInterpretationInfo> | undefined;

		if(entryNode !== undefined && isRSingleNode(entryNode)) {
			oldDomain = entryNode.info.dataFrame?.domain ?? oldDomain;
			newDomain = processDataFrameLeaf(entryNode, new Map(inputDomain), dfg);
			node = entryNode;
		} else if(vertex.type === CfgVertexType.EndMarker) {
			const exitId = getNodeIdForExitVertex(vertex.id);
			const exitNode: RNode<ParentInformation & AbstractInterpretationInfo> | undefined = exitId !== undefined ? dfg.idMap?.get(exitId) : undefined;

			if(exitNode !== undefined && !isRSingleNode(exitNode)) {
				oldDomain = exitNode.info.dataFrame?.domain ?? oldDomain;
				newDomain = processDataFrameExpression(exitNode, new Map(inputDomain), dfg);
				node = exitNode;
			}
		}
		if(cfinfo.exitPoints.includes(vertex.id)) {
			finalDomain = newDomain;
		}
		const visitedCount = visited.get(vertex.id) ?? 0;
		visited.set(vertex.id, visitedCount + 1);

		if(visitedCount >= WideningThreshold) {
			newDomain = wideningDataFrameStates(oldDomain, newDomain);
		}
		if(node !== undefined) {
			node.info.dataFrame ??= {};
			node.info.dataFrame.domain = new Map(newDomain);
		}
		if(!equalDataFrameState(oldDomain, newDomain)) {
			return getSuccessorVertices(cfg, vertex.id, dfg);
		}
		return getSuccessorVertices(cfg, vertex.id, dfg).filter(successor => !visited.has(successor.id));
	};
	const cfg = flipCfg(cfinfo.graph);
	const entryPoints = cfinfo.entryPoints
		.map(id => cfg.vertices().get(id))
		.filter(vertex => vertex !== undefined);

	const queue: CfgVertex[] = [...entryPoints];
	let vertex: CfgVertex | undefined;

	while((vertex = queue.shift()) !== undefined) {
		queue.push(...visitor(cfg, dfg, vertex));
	}
	return finalDomain;
}

export function flipCfg(cfg: ControlFlowGraph): ControlFlowGraph {
	const flippedCfg = new ControlFlowGraph();

	for(const [id, vertex] of cfg.vertices()) {
		flippedCfg.addVertex(vertex, cfg.rootVertexIds().has(id));
	}
	for(const [to, edges] of cfg.edges()) {
		for(const [from, edge] of edges) {
			flippedCfg.addEdge(from, to, edge);
		}
	}
	return flippedCfg;
}

function isRConstant(
	node: RNode<ParentInformation>
): node is RConstant<ParentInformation> {
	return node.type === RType.String || node.type === RType.Number || node.type === RType.Logical;
}

function isRSingleNode(
	node: RNode<ParentInformation>
): node is RSingleNode<ParentInformation> {
	return isRConstant(node) || node.type === RType.Symbol || node.type === RType.Break || node.type === RType.Next || node.type === RType.Comment || node.type === RType.LineDirective;
}

// We only process vertices of leaf nodes and exit vertices (no entry nodes of complex nodes)
function shouldSkipVertex(vertex: CfgVertex, dfg: DataflowGraph) {
	if(vertex.type === CfgVertexType.EndMarker) {
		return false;
	} else if(vertex.type === CfgVertexType.MidMarker) {
		return true;
	}
	const node = dfg.idMap?.get(vertex.id);

	return node === undefined || !isRSingleNode(node);
}

function getNodeIdForExitVertex(vertexId: NodeId): number | undefined {
	if(typeof vertexId === 'number') {
		return vertexId;
	}
	const nodeId = Number(vertexId.match(/^(\d+)/)?.[1]);

	return nodeId !== undefined && !isNaN(nodeId) ? nodeId : undefined;
}

function getPredecessorNodes(cfg: ControlFlowGraph, vertexId: NodeId, dfg: DataflowGraph): RNode<ParentInformation & AbstractInterpretationInfo>[] {
	return cfg.ingoing(vertexId)?.keys()
		.map(id => cfg.vertices().get(id))
		.flatMap(vertex => {
			if(vertex !== undefined && shouldSkipVertex(vertex, dfg)) {
				return getPredecessorNodes(cfg, vertex.id, dfg);
			} else if(vertex?.type === CfgVertexType.EndMarker) {
				const nodeId = getNodeIdForExitVertex(vertex.id);
				return nodeId ? [dfg.idMap?.get(nodeId)] : [];
			} else {
				return vertex ? [dfg.idMap?.get(vertex.id)] : [];
			}
		})
		.filter(node => node !== undefined)
		.toArray() ?? [];
}

function getSuccessorVertices(cfg: ControlFlowGraph, vertexId: NodeId, dfg: DataflowGraph): CfgVertex[] {
	return cfg.outgoing(vertexId)?.keys()
		.map(id => cfg.vertices().get(id))
		.flatMap(vertex => {
			if(vertex !== undefined && shouldSkipVertex(vertex, dfg)) {
				return getSuccessorVertices(cfg, vertex.id, dfg);
			} else {
				return [vertex];
			}
		})
		.filter(vertex => vertex !== undefined)
		.toArray() ?? [];
}
