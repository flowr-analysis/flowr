import type { DataflowGraph } from '../../dataflow/graph/graph';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { CfgEdge } from '../../util/cfg/cfg';
import type { SimpleControlFlowGraph, SimpleControlFlowInformation } from '../simple-cfg';


export function performDataFrameAbsint(cfg: SimpleControlFlowInformation, dfg: DataflowGraph) {
	const visitor = (nodeId: NodeId, successors: ReadonlyMap<NodeId, CfgEdge>) => {
		const node = dfg.idMap?.get(nodeId);
		console.log(node?.info.id ?? nodeId, node?.type, node?.lexeme, node?.info.fullLexeme, dfg.get(nodeId), successors.keys().toArray());
	};

	foldGraph(cfg.graph, [...cfg.entryPoints], [], visitor);
}

function foldGraph(
	cfg: SimpleControlFlowGraph,
	nodes: NodeId[],
	visited: NodeId[],
	visitor: (node: NodeId, predecessors: ReadonlyMap<NodeId, CfgEdge>) => void
): void {
	for(const node of nodes) {
		if(!visited.includes(node)) {
			visited.push(node);
			const outgoing = cfg.outgoing(node);
			visitor(node, outgoing ?? new Map());
			const successors = outgoing?.keys().toArray() ?? [];
			foldGraph(cfg, successors, visited, visitor);
		}
	}
}
