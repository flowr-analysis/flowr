import { DataflowGraph } from './graph';
import { type AstIdMap } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { guard } from '../../util/assert';
import type { SingleSlicingCriterion } from '../../slicing/criterion/parse';
import { slicingCriterionToId } from '../../slicing/criterion/parse';
import { splitEdgeTypes } from './edge';

/**
 * Resolves the dataflow graph ids from slicing criterion form to ids.
 * This returns a **new** graph with the resolved ids.
 */
export function resolveDataflowGraph(graph: DataflowGraph, idMap?: AstIdMap): DataflowGraph {
	const resolveMap = idMap ?? graph.idMap;
	guard(resolveMap !== undefined, 'idMap must be provided to resolve the graph');

	const cache = new Map<string, NodeId>();

	const resolve = (id: string | NodeId): NodeId => {
		const cached = cache.get(id as string);
		if(cached !== undefined) {
			return cached;
		}
		let resolved: NodeId;
		try {
			resolved = slicingCriterionToId(id as SingleSlicingCriterion, resolveMap);
		} catch(e) {
			/* just keep it :D */
			resolved = id as NodeId;
		}

		cache.set(id as string, resolved);
		return resolved;
	};

	const resultGraph = new DataflowGraph(resolveMap);
	const roots = graph.rootIds();

	/* recreate vertices */
	for(const [id, vertex] of graph.vertices(true)) {
		resultGraph.addVertex({
			...vertex,
			id: resolve(id as string)
		}, roots.has(id));
	}
	/* recreate edges */
	for(const [from, targets] of graph.edges()) {
		for(const [to, info] of targets) {
			for(const type of splitEdgeTypes(info.types)) {
				resultGraph.addEdge(
					resolve(from),
					resolve(to),
					{ type }
				);
			}
		}
	}

	return resultGraph;
}
