import { describe, assert, test } from 'vitest';
import { Dataflow } from '../../../../src/dataflow/graph/df-helper';
import { emptyGraph } from '../../../../src/dataflow/graph/dataflowgraph-builder';
import { Identifier } from '../../../../src/dataflow/environments/identifier';
import { VertexType } from '../../../../src/dataflow/graph/vertex';

/**
 * `Dataflow.qualify` answers from a cache the graph holds, as resolving a call again is what costs.
 * These pin that the cache never outlives the resolution it stands for.
 */
describe('Dataflow qualify cache', () => {
	const qualify = (graph: Parameters<typeof Dataflow.qualify>[1], id: number, baseR = true) => {
		const q = Dataflow.qualify(id, graph, baseR);
		return q === undefined ? undefined : Identifier.toString(q);
	};

	test('answers the same on a repeated ask', () => {
		const graph = emptyGraph().call(1, 'sd', []);
		assert.strictEqual(qualify(graph, 1), 'stats::sd');
		assert.strictEqual(qualify(graph, 1), 'stats::sd');
		assert.isUndefined(qualify(graph, 1, false), 'without the base-R step there is nothing to qualify');
	});

	test('drops what an added edge invalidates', () => {
		const graph = emptyGraph().call(1, 'sd', []).defineVariable(2, 'sd');
		assert.strictEqual(qualify(graph, 1), 'stats::sd');
		graph.calls(1, 2);
		assert.isUndefined(qualify(graph, 1), 'the call resolves to a definition of the analyzed code now');
	});

	test('drops what an added vertex invalidates', () => {
		const graph = emptyGraph().call(1, 'sd', []);
		Dataflow.qualifyAll(graph);
		graph.call(2, 'acf', []);
		const all = Dataflow.qualifyAll(graph);
		assert.deepEqual([...all.keys()].sort(), [1, 2]);
		assert.strictEqual(Identifier.toString(all.get(2) as Identifier), 'stats::acf');
	});

	test('qualifies every call exactly as the single ask does', () => {
		const graph = emptyGraph().call(1, 'sd', []).call(2, 'acf', []).call(3, 'notAFunction', []);
		const all = Dataflow.qualifyAll(graph);
		const bare = Dataflow.qualifyAll(graph, false);
		for(const [id] of graph.verticesOfType(VertexType.FunctionCall)) {
			assert.deepEqual(all.get(id), Dataflow.qualify(id, graph, true), `base-R qualification of ${id}`);
			assert.deepEqual(bare.get(id), Dataflow.qualify(id, graph, false), `plain qualification of ${id}`);
		}
		assert.isUndefined(all.get(3));
	});
});
