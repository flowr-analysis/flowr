import { type QuadSerializationConfiguration, graph2quads } from '../../util/quads';
import type { DataflowGraph } from './graph';
import { DfEdge } from './edge';

/**
 * @see cfg2quads
 * @see serialize2quads
 * @see graph2quads
 */
export function df2quads(graph: DataflowGraph, config: QuadSerializationConfiguration): string {
	return graph2quads({
		rootIds:  Array.from(graph.rootIds()),
		vertices: Array.from(graph.vertices(true)
			.map(([, v]) => v)),
		edges: graph.edges().flatMap(([fromId, targets]) =>
			Array.from(targets).map(([toId, info]) => ({
				from: fromId,
				to:   toId,
				type: Array.from(DfEdge.typesToNames(info)),
			}))
		).toArray()
	},
	config
	);
}
