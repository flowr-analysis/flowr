import type { DataflowGraph } from '../../../../src/dataflow/graph/graph';
import type { DataflowGraphClusters } from '../../../../src/dataflow/cluster';
import { findAllClusters } from '../../../../src/dataflow/cluster';
import { assert } from 'chai';
import { emptyGraph } from '../../_helper/dataflow/dataflowgraph-builder';
import type { SingleSlicingCriterion } from '../../../../src/slicing/criterion/parse';
import { PipelineExecutor } from '../../../../src/core/pipeline-executor';
import { DEFAULT_DATAFLOW_PIPELINE } from '../../../../src/core/steps/pipeline/default-pipelines';
import { requestFromInput } from '../../../../src/r-bridge/retriever';
import { deterministicCountingIdGenerator } from '../../../../src/r-bridge/lang-4.x/ast/model/processing/decorate';
import { withShell } from '../../_helper/shell';
import { slicingCriterionToId } from '../../../../src/slicing/criterion/parse';
import type { NodeId } from '../../../../src/r-bridge/lang-4.x/ast/model/processing/node-id';

describe('Graph Clustering', () => {
	describe('Simple Graph Tests', () => {
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

		test('empty', emptyGraph(), []);
		test('single vertex', emptyGraph().use(0, 'x'), [{ startNode: 0, members: [0] }]);
		test('single edge', emptyGraph().use(0, 'x').use(1, 'y').reads(0, 1), [{ startNode: 0, members: [0, 1] }]);
		test('two single-edge',
			emptyGraph().use(0, 'x').use(1, 'y').reads(0, 1).use(2, 'z').use(3, 'w').reads(2, 3),
			[{ startNode: 0, members: [0, 1] }, { startNode: 2, members: [2, 3] }]);
	});

	function compareIds(a: NodeId | undefined, b: NodeId | undefined): number {
		return String(a ?? '').localeCompare(String(b ?? ''));
	}

	function normalizeClusters(clusters: DataflowGraphClusters) {
		/* sort order and the order members */
		return clusters.map(c => ({
			startNode: c.startNode,
			members:   [...c.members].sort(compareIds)
		})).sort((a, b) => compareIds(a.members[0], b.members[0]));
	}

	describe('Code Snippets', withShell(shell => {
		function test(name: string, code: string, clusters: readonly SingleSlicingCriterion[][]) {
			it(name, async() => {
				const info = await new PipelineExecutor(DEFAULT_DATAFLOW_PIPELINE, {
					shell,
					request: requestFromInput(code),
					getId:   deterministicCountingIdGenerator(0)
				}).allRemainingSteps();

				const graph = info.dataflow.graph;

				// resolve all criteria
				const resolved = normalizeClusters(clusters.map(c => ({
					startNode: '',
					members:   c.map(s => slicingCriterionToId(s, graph.idMap ?? info.normalize.idMap))
				})));

				const actual = normalizeClusters(findAllClusters(graph));
				assert.equal(actual.length, resolved.length, `Different number of clusters: ${JSON.stringify(actual)} vs. wanted: ${JSON.stringify(resolved)}`);
				for(let i = 0; i < actual.length; i++) {
					assert.equal(actual[i].members.length, resolved[i].members.length, `Member amounts of cluster differ: ${JSON.stringify(actual[i].members)} vs ${JSON.stringify(resolved[i])}`);
					for(let m = 0; m < actual[i].members.length; m++) {
						assert.isTrue(resolved[i].members.includes(actual[i].members[m]), `Member ${actual[i].members[m]} of cluster differs`);
					}
				}
			});
		}

		test('assignment', 'x <- 3', [['1:1', '1:3', '1:6']]);
		test('two independent assignments', 'x <- 3\ny <- 4', [['1:1', '1:3', '1:6'], ['2:1', '2:3', '2:6']]);
		test('with a print call', 'x <- 3\nprint(x)', [['1:1', '1:3', '1:6', '2:1', '2:7']]);
		test('late join of clusters', 'x <- 3\ny <- 4\nprint(x + y)', [['1:1', '1:3', '1:6', '2:1', '2:3', '2:6', '3:1', '3:7', '3:9', '3:11']]);
		test('contain call target', 'y <- 42\nf <- function(x) { x * y }\nf(2)\nf(3)', [['1:1', '1:3', '1:6', '2:1', '2:3', '2:6', '2:15', '2:18', '2:20', '2:22', '2:24', '3:1', '3:3', '4:1', '4:3']]);
		test('some odd ducklings', 'y <- 42\nz <- 5\nf <- function(x) { x * y }\nf(2)\nprint(z)\nf(3)\nu', [
			['1:1', '1:3', '1:6', '3:1', '3:3', '3:6', '3:15', '3:18', '3:20', '3:22', '3:24', '3:1', '3:3', '6:1', '6:3'], /* call as before */
			['2:1', '2:3', '2:6', '5:1', '5:7'], /* print & z */
			['7:1'] /* u */
		]);
	}));
});
