import type { DataflowGraph } from '../../../../src/dataflow/graph/graph';
import type { DataflowGraphClusters } from '../../../../src/dataflow/cluster';
import { findAllClusters } from '../../../../src/dataflow/cluster';
import { assert } from 'chai';
import { emptyGraph } from '../../_helper/dataflow/dataflowgraph-builder';

describe('Graph Clustering', () => {
	describe('Simple', () => {
		test('empty', emptyGraph(), []);
		test('single vertex', emptyGraph().use(0, 'x'), [{ startNode: 0, members: [0] }]);
		test('single edge', emptyGraph().use(0, 'x').use(1, 'y').reads(0, 1), [{ startNode: 0, members: [0, 1] }]);
		test('two single-edge',
			emptyGraph().use(0, 'x').use(1, 'y').reads(0, 1).use(2, 'z').use(3, 'w').reads(2, 3),
			[{ startNode: 0, members: [0, 1] }, { startNode: 2, members: [2, 3] }]);
	});
});

function test(name: string, graph: DataflowGraph, expected: DataflowGraphClusters): void {
	it(name, () => {
		const actual = findAllClusters(graph);
		assert.equal(actual.length, expected.length, 'Different number of clusters');
		for(let i = 0; i < actual.length; i++) {
			assert.equal(actual[i].members.length, expected[i].members.length, `Member amounts of cluster differ: ${actual[i].members.toString()} vs ${expected[i].members.toString()}`);
			for(let m = 0; m < actual[i].members.length; m++) {
				assert.isTrue(expected[i].members.includes(actual[i].members[m]), `Member ${actual[i].members[m]} of cluster differs`);
			}
		}
	});
}
