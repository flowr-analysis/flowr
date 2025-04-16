import type { DataflowGraph } from '../../dataflow/graph/graph';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { RFalse, RTrue } from '../../r-bridge/lang-4.x/convert-values';
import { guard } from '../../util/assert';
import type { CfgEdge } from '../../util/cfg/cfg';
import type { SimpleControlFlowGraph, SimpleControlFlowInformation } from '../simple-cfg';
import type { DataFrameDomain, DataFrameStateDomain } from './domain';
import { equalDataFrameState } from './domain';
import { processDataFrameNode } from './processor';

export function performDataFrameAbsint(cfg: SimpleControlFlowInformation, dfg: DataflowGraph) {
	const visited: Set<NodeId> = new Set();

	const visitor = (cfg: SimpleControlFlowGraph, nodeId: NodeId, domain: DataFrameStateDomain) => {
		const node = dfg.idMap?.get(nodeId);
		guard(node !== undefined, 'Node must not be undefined');

		const result = processDataFrameNode(node, domain, dfg);
		const equal = 'FD' in result ? {
			'FD':     equalDataFrameState(domain, result['FD']),
			[RTrue]:  equalDataFrameState(domain, result[RTrue]),
			[RFalse]: equalDataFrameState(domain, result[RFalse])
		} : equalDataFrameState(domain, result);

		const hasChanged = (edge: CfgEdge) => typeof equal === 'object' ? !equal[edge.label === 'FD' ? edge.label : edge.when] : !equal;
		const getDomain = (edge: CfgEdge) => 'FD' in result ? result[edge.label === 'FD' ? edge.label : edge.when] : result;

		const successors = cfg.edges().get(nodeId)?.entries()
			.filter(([successor, edge]) => !visited.has(successor) || hasChanged(edge))
			.map<[NodeId, DataFrameStateDomain]>(([successor, edge]) => [successor, getDomain(edge)])
			.toArray();

		successors?.forEach(([successor]) => visited.add(successor));

		return successors ?? [];
	};
	foldGraph(cfg.graph, cfg.entryPoints.map((entry) => [entry, new Map<NodeId, DataFrameDomain>()]), visitor);
}

function foldGraph(
	cfg: SimpleControlFlowGraph,
	nodes: [NodeId, DataFrameStateDomain][],
	visitor: (cfg: SimpleControlFlowGraph, node: NodeId, domain: DataFrameStateDomain) => [NodeId, DataFrameStateDomain][]
): void {
	for(const [node, domain] of nodes) {
		const successors = visitor(cfg, node, domain);
		foldGraph(cfg, successors, visitor);
	}
}
