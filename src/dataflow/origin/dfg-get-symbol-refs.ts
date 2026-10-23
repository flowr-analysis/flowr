import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { EdgeType } from '../graph/edge';
import type { DataflowGraph } from '../graph/graph';
import { happensInEveryBranch } from '../info';
import { Dataflow } from '../graph/df-helper';

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
 * @param graph  - Dataflow Graph
 * @param nodeId - NodeId of Symbol to resolve
 * @returns      List including the Definitions and References to that definition
 * @useInstead {@link Dataflow.refsToSymbol}
 * @example getAllRefsToSymbol('3\@y') returns ['3\@y', '4\@y']
 */
export function getAllRefsToSymbol(graph: DataflowGraph, nodeId: NodeId): NodeId[] | undefined {
	// Get all origins and filter for ones that happen for sure
	const origins = Dataflow.origin(graph, nodeId);
	if(origins === undefined) {
		return undefined;
	}

	const definitiveOrigins = origins.filter(o =>
		happensInEveryBranch(graph.getVertex(o.id)?.cds)
	);
	if(definitiveOrigins.length === 0) {
		return undefined;
	}

	// Gather all the references
	const res = new Set<NodeId>();
	for(const { id } of definitiveOrigins) {
		res.add(id);
		Dataflow.sourcesOf(graph, id, EdgeType.Reads).forEach(node => res.add(node));
		Dataflow.targetsOf(graph, id, EdgeType.DefinedByOnCall).forEach(node => res.add(node));
	}

	return [...res];
}