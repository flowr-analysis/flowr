import type { DataflowGraph } from '../../dataflow/graph/graph';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { CfgVertexType, ControlFlowGraph, type CfgVertex, type ControlFlowInformation } from '../../util/cfg/cfg';
import { equalDataFrameState, type DataFrameDomain, type DataFrameStateDomain } from './domain';
import { processDataFrameNode } from './processor';

export function performDataFrameAbsint(cfinfo: ControlFlowInformation, dfg: DataflowGraph): DataFrameStateDomain {
	const visited: Map<NodeId, number> = new Map();
	let result: DataFrameStateDomain = new Map();

	const visitor = (cfg: ControlFlowGraph, vertex: CfgVertex, domain: DataFrameStateDomain) => {
		const entryNode = dfg.idMap?.get(vertex.id);
		let newDomain = domain;

		if(entryNode !== undefined) {
			newDomain = processDataFrameNode('entry', entryNode, new Map(domain), dfg);
		}
		if(vertex.type === CfgVertexType.EndMarker) {
			const exitId = getNodeIdOfExitVertex(vertex.id);
			const exitNode = exitId !== undefined ? dfg.idMap?.get(exitId) : undefined;

			if(exitNode !== undefined) {
				newDomain = processDataFrameNode('exit', exitNode, new Map(domain), dfg);
			}
		}
		if(cfinfo.exitPoints.includes(vertex.id)) {
			result = newDomain;
		}
		visited.set(vertex.id, visited.get(vertex.id) ?? 0 + 1);

		const successors = cfg.edges().get(vertex.id)?.keys()
			.map(id => cfg.vertices().get(id))
			.filter(vertex => vertex !== undefined)
			.filter(vertex => !visited.has(vertex.id) || !equalDataFrameState(domain, newDomain))
			.map<[CfgVertex, DataFrameStateDomain]>(vertex => [vertex, newDomain])
			.toArray() ?? [];

		return successors;
	};
	const cfg = flipCfg(cfinfo.graph);
	const entryPoints: [CfgVertex, DataFrameStateDomain][] = cfinfo.entryPoints
		.map(entry => cfg.vertices().get(entry))
		.filter(entry => entry !== undefined)
		.map(entry => [entry, new Map<NodeId, DataFrameDomain>()]);

	foldCfg(cfg, entryPoints, visitor);
	return result;
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

function foldCfg<T>(
	cfg: ControlFlowGraph,
	nodes: [CfgVertex, T][],
	visitor: (cfg: ControlFlowGraph, vertex: CfgVertex, value: T) => [CfgVertex, T][]
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
