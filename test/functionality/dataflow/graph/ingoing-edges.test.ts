import { describe, assert, test } from 'vitest';
import { DataflowGraph } from '../../../../src/dataflow/graph/graph';
import { EdgeType } from '../../../../src/dataflow/graph/edge';
import type { NodeId } from '../../../../src/r-bridge/lang-4.x/ast/model/processing/node-id';

/**
 * `ingoingEdges` answers from a reverse index that `addEdge` keeps up to date instead of rebuilding.
 * These pin that the index never goes stale, whichever order the two are interleaved in.
 */
describe('DataflowGraph ingoing edges', () => {
	const sources = (graph: DataflowGraph, to: NodeId) => [...graph.ingoingEdges(to)?.keys() ?? []].sort();

	test('sees edges added before the first lookup', () => {
		const graph = new DataflowGraph(undefined);
		graph.addEdge('a', 'target', EdgeType.Reads);
		graph.addEdge('b', 'target', EdgeType.Reads);
		assert.deepEqual(sources(graph, 'target'), ['a', 'b']);
	});

	test('sees edges added after the first lookup', () => {
		const graph = new DataflowGraph(undefined);
		graph.addEdge('a', 'target', EdgeType.Reads);
		assert.deepEqual(sources(graph, 'target'), ['a']);
		graph.addEdge('b', 'target', EdgeType.Reads);
		assert.deepEqual(sources(graph, 'target'), ['a', 'b']);
		// a target the index had never heard of before
		graph.addEdge('a', 'later', EdgeType.Calls);
		assert.deepEqual(sources(graph, 'later'), ['a']);
	});

	test('reports a widened type on an edge that already existed', () => {
		const graph = new DataflowGraph(undefined);
		graph.addEdge('a', 'target', EdgeType.Reads);
		assert.deepEqual(sources(graph, 'target'), ['a']);
		graph.addEdge('a', 'target', EdgeType.Calls);
		assert.strictEqual(graph.ingoingEdges('target')?.get('a')?.types, EdgeType.Reads | EdgeType.Calls);
		assert.deepEqual(sources(graph, 'target'), ['a'], 'the edge must not be duplicated');
	});

	test('sees edges a merge brought in', () => {
		const graph = new DataflowGraph(undefined);
		graph.addEdge('a', 'target', EdgeType.Reads);
		assert.deepEqual(sources(graph, 'target'), ['a']);
		const other = new DataflowGraph(undefined);
		other.addEdge('b', 'target', EdgeType.Reads);
		graph.mergeWith(other);
		assert.deepEqual(sources(graph, 'target'), ['a', 'b']);
	});

	test('a self-edge is dropped, as it always was', () => {
		const graph = new DataflowGraph(undefined);
		graph.addEdge('a', 'a', EdgeType.Reads);
		assert.deepEqual(sources(graph, 'a'), []);
	});
});
