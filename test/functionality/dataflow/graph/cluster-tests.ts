import type { DataflowGraph } from '../../../../src/dataflow/graph/graph';
import type { DataflowGraphClusters } from '../../../../src/dataflow/cluster';
import { findAllClusters } from '../../../../src/dataflow/cluster';
import { assert } from 'chai';
import { emptyGraph } from '../../_helper/dataflow/dataflowgraph-builder';

describe('Graph Clustering', () => {
	describe('Simple', () => {
		describe('Positive', () => {
			test('empty', emptyGraph(), []);
			test('single vertex', emptyGraph().use(0, 'x'), [{ startNode: 0, members: [0] }]);
			test('single edge', emptyGraph().use(0, 'x').use(1, 'y').reads(0, 1), [{ startNode: 0, members: [0, 1] }]);
		});
	});
});

function test(name: string, graph: DataflowGraph, expected: DataflowGraphClusters): void {
	it(name, () => {
		const actual = findAllClusters(graph);
		assert.equal(actual.length, expected.length, 'Different number of clusters');
		for(let i = 0; i < actual.length; i++) {
			// TODO probably allow arbitrary cluster & cluster member ordering between actual and expected
			assert.equal(actual[i].startNode, expected[i].startNode, `Start node of cluster ${i} differs`);
			assert.equal(actual[i].members.length, expected[i].members.length, `Member amounts of cluster ${i} differ`);
			for(let m = 0; m < actual[i].members.length; m++) {
				assert.equal(actual[i].members[m], expected[i].members[m], `Member ${m} of cluster ${i} differs`);
			}
		}
	});
}
