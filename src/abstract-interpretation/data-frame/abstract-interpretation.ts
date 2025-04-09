import type { DataflowGraph } from '../../dataflow/graph/graph';
import type { RConstant, RNode, RSingleNode } from '../../r-bridge/lang-4.x/ast/model/model';
import type { ParentInformation } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { RType } from '../../r-bridge/lang-4.x/ast/model/type';
import { CfgVertexType, ControlFlowGraph, type CfgVertex, type ControlFlowInformation } from '../../util/cfg/cfg';
import type { AbstractInterpretationInfo } from './absint-info';
import { equalDataFrameState, type DataFrameDomain, type DataFrameStateDomain } from './domain';
import { processDataFrameNode } from './processor';

export function performDataFrameAbsint(cfg: ControlFlowInformation, dfg: DataflowGraph) {
	const visited: Set<NodeId> = new Set();

	const visitor = (cfg: ControlFlowGraph, vertex: CfgVertex, domain: DataFrameStateDomain) => {
		const entryNode = dfg.idMap?.get(vertex.id);
		let result = domain;

		if(entryNode !== undefined && !isRSingleNode(entryNode)) {
			result = processDataFrameNode('entry', entryNode, new Map(domain), dfg);
		}

		if(vertex.type === CfgVertexType.EndMarker) {
			const exitId = getNodeIdOfExitVertex(vertex.id);
			const exitNode = exitId !== undefined ? dfg.idMap?.get(exitId) : undefined;

			if(exitNode !== undefined && !isRSingleNode(exitNode)) {
				result = processDataFrameNode('exit', exitNode, new Map(domain), dfg);
			}
		}
		const successors = cfg.edges().get(vertex.id)?.keys()
			.map(id => cfg.vertices().get(id))
			.filter(vertex => vertex !== undefined)
			.filter(vertex => !visited.has(vertex.id) || !equalDataFrameState(domain, result))
			.map<[CfgVertex, DataFrameStateDomain]>(vertex => [vertex, result])
			.toArray() ?? [];

		successors.forEach(([vertex]) => visited.add(vertex.id));

		return successors;
	};
	const entryPoints: [CfgVertex, DataFrameStateDomain][] = cfg.entryPoints
		.map(entry => cfg.graph.vertices().get(entry))
		.filter(entry => entry !== undefined)
		.map(entry => [entry, new Map<NodeId, DataFrameDomain>()]);

	foldCfg(cfg.graph, entryPoints, visitor);

	const target = dfg.idMap?.get(16);
	const result = (target?.info as AbstractInterpretationInfo).dataFrame?.domain?.entries()
		.map(([id, value]) => {
			const node = dfg.idMap?.get(id);
			return [`${node?.info.id}: ${node?.lexeme}`, value];
		})
		.toArray() ?? [];
	console.log(...result);
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

function foldCfg(
	cfg: ControlFlowGraph,
	nodes: [CfgVertex, DataFrameStateDomain][],
	visitor: (cfg: ControlFlowGraph, vertex: CfgVertex, domain: DataFrameStateDomain) => [CfgVertex, DataFrameStateDomain][]
): void {
	for(const [node, domain] of nodes) {
		const successors = visitor(cfg, node, domain);
		foldCfg(cfg, successors, visitor);
	}
}

function getNodeIdOfExitVertex(vertexId: NodeId): number | undefined {
	if(typeof vertexId === 'number') {
		return vertexId;
	}
	const nodeId = Number(vertexId.match(/^(\d+)/)?.[1]);

	return nodeId !== undefined && !isNaN(nodeId) ? nodeId : undefined;
}

function isRConstant<OtherInfo>(
	node: RNode<OtherInfo & ParentInformation>
): node is RConstant<OtherInfo & ParentInformation> {
	return node.type === RType.String || node.type === RType.Number || node.type === RType.Logical;
}

function isRSingleNode<OtherInfo>(
	node: RNode<OtherInfo & ParentInformation>
): node is RSingleNode<OtherInfo & ParentInformation> {
	return isRConstant(node) || node.type === RType.Symbol || node.type === RType.Break || node.type === RType.Next || node.type === RType.Comment || node.type === RType.LineDirective;
}
