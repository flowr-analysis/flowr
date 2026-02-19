import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { DfEdge, EdgeType } from '../graph/edge';
import type { DataflowGraph } from '../graph/graph';
import { happensInEveryBranch } from '../info';
import { getOriginInDfg } from './dfg-get-origin';

/**
 * Finds the definition of a variable and all other uses from that point on
 *
 * For example, for the following code
 * ```ts
 * y <- 5
 * f <- function() {
 * y <- 8
 * print(y)
 * }
 * ```
 * @example getAllRefsToSymbol('3\@y') returns ['3\@y', '4\@y']
 * @param graph  - Dataflow Graph
 * @param nodeId - NodeId of Symbol to resolve
 * @returns List including the Definitions and References to that definition
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
			.filter(([_, edge]) => DfEdge.includesType(edge, EdgeType.Reads))
			.forEach(([node, _]) => res.add(node));
		graph.outgoingEdges(origin.id)
			?.entries()
			.filter(([_, edge]) => DfEdge.includesType(edge, EdgeType.DefinedByOnCall))
			.forEach(([node, _]) => res.add(node));
	}

	return [...res];
}