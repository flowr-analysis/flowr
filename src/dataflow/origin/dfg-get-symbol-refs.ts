import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { EdgeTypeBits } from '../graph/edge';
import { edgeIncludesType, EdgeType } from '../graph/edge';
import type { DataflowGraph } from '../graph/graph';
import { happensInEveryBranch } from '../info';
import { getOriginInDfg } from './dfg-get-origin';

/**
 * Finds the definition of a Symbol and all other uses from that point on 
 * 
 * @param graph  - Dataflow Graph
 * @param nodeId - NodeId of Symbol to resolve
 * @returns List including the Definitions and Refereneces to that definition
 */
export function getAllRefsToSymbol(graph: DataflowGraph, nodeId: NodeId): NodeId[] | undefined {
	// Get all origins and filter for ones that happen for sure
	const origins = getOriginInDfg(graph, nodeId);
	if(origins === undefined) {
		return undefined;
	}

	const definitiveOrigins = origins.filter(o => 
		happensInEveryBranch(graph.getVertex(o.id)?.cds)
	);
	if(definitiveOrigins.length === 0 ) {
		return undefined;
	}

	// Gather all the references 
	const res = new Set<NodeId>();
	for(const origin of definitiveOrigins) {
		res.add(origin.id);
		graph.ingoingEdges(origin.id)
			?.entries()
			.filter(([_, edge]) => edgeIncludesType(edge.types, EdgeType.Reads))
			.forEach(([node, _]) => res.add(node));
		graph.outgoingEdges(origin.id)
			?.entries()
			.filter(([_, edge]) => edgeIncludesType(edge.types, EdgeType.DefinedByOnCall))
			.forEach(([node, _]) => res.add(node));
	}

	return [...res];
}