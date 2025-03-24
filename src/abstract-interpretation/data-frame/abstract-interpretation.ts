import type { AstIdMap, ParentInformation } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { CfgEdge, ControlFlowGraph, ControlFlowInformation } from '../../util/cfg/cfg';

export function performDataFrameAbsint<OtherInfo>(cfg: ControlFlowInformation, idMap: AstIdMap<OtherInfo & ParentInformation>) {
	const visitor = (nodeId: NodeId, predecessors: ReadonlyMap<NodeId, CfgEdge>) => {
		const node = idMap.get(nodeId);
		console.log(node?.info.id ?? nodeId, node?.type, node?.lexeme, node?.info.fullLexeme, predecessors.keys().toArray());
	};

	foldForward(cfg.graph, [...cfg.exitPoints], [], visitor);
}

function foldForward(
	cfg: ControlFlowGraph,
	nodes: NodeId[],
	visited: NodeId[],
	visitor: (node: NodeId, predecessors: ReadonlyMap<NodeId, CfgEdge>) => void
): void {
	for(const node of nodes) {
		if(!visited.includes(node)) {
			visited.push(node);
			const incoming = cfg.outgoing(node);
			const predecessors = incoming?.keys().toArray() ?? [];
			foldForward(cfg, predecessors, visited, visitor);
			visitor(node, incoming ?? new Map());
		}
	}
}
