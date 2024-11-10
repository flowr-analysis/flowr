import type { DataflowGraph } from '../../../../src/dataflow/graph/graph';
import type { DataflowGraphCluster, DataflowGraphClusters } from '../../../../src/dataflow/cluster';
import { findAllClusters } from '../../../../src/dataflow/cluster';
import type { SlicingCriteria } from '../../../../src/slicing/criterion/parse';
import { PipelineExecutor } from '../../../../src/core/pipeline-executor';
import { DEFAULT_DATAFLOW_PIPELINE } from '../../../../src/core/steps/pipeline/default-pipelines';
import { requestFromInput } from '../../../../src/r-bridge/retriever';
import { deterministicCountingIdGenerator } from '../../../../src/r-bridge/lang-4.x/ast/model/processing/decorate';
import { withShell } from '../../_helper/shell';
import { slicingCriterionToId } from '../../../../src/slicing/criterion/parse';
import type { NodeId } from '../../../../src/r-bridge/lang-4.x/ast/model/processing/node-id';
import { dataflowGraphToMermaidUrl } from '../../../../src/core/print/dataflow-printer';
import { emptyGraph } from '../../../../src/dataflow/graph/dataflowgraph-builder';
import { describe, assert, test } from 'vitest';

describe('Graph Clustering', () => {
	describe('Simple Graph Tests', () => {
		function check(name: string, graph: DataflowGraph, expected: DataflowGraphClusters): void {
			test(name, () => compareClusters(findAllClusters(graph), expected));
		}

		check('empty', emptyGraph(), []);
		check('single vertex', emptyGraph().use(0, 'x'), [
			{ startNode: 0, members: [0], hasUnknownSideEffects: false }
		]);
		check('single edge', emptyGraph().use(0, 'x').use(1, 'y').reads(0, 1), [
			{ startNode: 0, members: [0, 1], hasUnknownSideEffects: false }
		]);
		check('two single-edge',
			emptyGraph().use(0, 'x').use(1, 'y').reads(0, 1).use(2, 'z').use(3, 'w').reads(2, 3), [
				{ startNode: 0, members: [0, 1], hasUnknownSideEffects: false },
				{ startNode: 2, members: [2, 3], hasUnknownSideEffects: false }
			]);
	});

	describe.sequential('Code Snippets', withShell(shell => {
		function check(name: string, code: string, clusters: readonly (SlicingCriteria | { members: SlicingCriteria, hasUnknownSideEffects: boolean })[]): void {
			test(`${name} [${code.split('\n').join('\\n')}]`, async() => {
				const info = await new PipelineExecutor(DEFAULT_DATAFLOW_PIPELINE, {
					shell,
					request: requestFromInput(code),
					getId:   deterministicCountingIdGenerator(0)
				}).allRemainingSteps();

				const graph = info.dataflow.graph;

				// resolve all criteria
				const resolved = clusters.map<DataflowGraphCluster>(c => {
					const { members, hasUnknownSideEffects } = c instanceof Array ? {
						members:               c,
						hasUnknownSideEffects: false
					} : c;
					return {
						startNode: '',
						members:   members.map(s => slicingCriterionToId(s, graph.idMap ?? info.normalize.idMap)),
						hasUnknownSideEffects
					};
				});
				const actual = findAllClusters(graph);
				try {
					compareClusters(actual, resolved);
				} catch(e) {
					console.log(dataflowGraphToMermaidUrl(info.dataflow));
					throw e;
				}
			});
		}

		describe('imperative', () => {
			check('assignment', 'x <- 3', [
				['1:1', '1:3', '1:6']
			]);
			check('two independent assignments', 'x <- 3\ny <- 4', [
				['1:1', '1:3', '1:6'],
				['2:1', '2:3', '2:6']
			]);
			check('with a print call', 'x <- 3\nprint(x)', [
				['1:1', '1:3', '1:6', '2:1', '2:7']
			]);
			check('late join of clusters', 'x <- 3\ny <- 4\nprint(x + y)', [
				['1:1', '1:3', '1:6', '2:1', '2:3', '2:6', '3:1', '3:7', '3:9', '3:11']
			]);
			check('x join of clusters', 'x <- 3\ny <- 4\nprint(x + y)\nprint(x)\nprint(y)', [
				['1:1', '1:3', '1:6', '2:1', '2:3', '2:6', '3:1', '3:7', '3:9', '3:11', '4:1', '4:7', '5:1', '5:7']
			]);
			describe('conditional', () => {
				check('linked conditional', 'x <- 2\n if(runif(k) > j) {\nx <- 3\n} else {\nx <- 4 }\nprint(x)', [
					['1:1', '1:3', '1:6'],
					['2@if', '2@runif', '2@k', '2:14', '2@j', '$14', '3:1', '3:3', '3:6', '$20', '5:1', '5:3', '5:6', '6@print', '6@x']
				]);
				check('unrelated conditional', 'if(x) y <- k\nprint(y)', [
					['1@if', '1@x', '1@y', '1@<-', '1@k', '2@print', '2@y']
				]);
				check('unrelated nested conditional', 'if(x) {\nif(y) y <- k }\nprint(y)', [
					['1@if', '1@x', '$9', '2@if', '2@y', '2:7', '2@<-', '2@k', '3@print', '3@y']
				]);
			});
			describe('loops', () => {
				check('simple loop', 'for(i in v)\n y <- x + i', [
					['1@for', '1@i', '1@v', '2@y', '2@<-', '2@x', '2@+', '2@i']
				]);
			});
		});
		describe('inter-procedural', () => {
			check('contain call target', 'y <- 42\nf <- function(x) { x * y }\nf(2)\nf(3)', [
				['1:1', '1:3', '1:6', '2:1', '2:3', '2:6', '2:15', '$11', '2:20', '2:22', '2:24', '3:1', '3:3', '4:1', '4:3']
			]);
			check('some odd ducklings', 'y <- 42\nz <- 5\nf <- function(x) { x * y }\nf(2)\nprint(z)\nf(3)\nu', [
				['1:1', '1:3', '1:6', '3:1', '3:3', '3:6', '3:15', '$14', '3:20', '3:22', '3:24', '4:1', '4:3', '6:1', '6:3'], /* call as before */
				['2:1', '2:3', '2:6', '5:1', '5:7'], /* print & z */
				['7:1'] /* u */
			]);
			check('uncalled functions', 'f <- function() 1\nx <- 3', [
				['1:1', '1:3', '1:6', '1:17'],
				['2:1', '2:3', '2:6']
			]);
			check('side effects', 'f <- function() x <<- 1\nf()\nprint(x)', [
				['1:1', '1:3', '1:6', '1:17', '1:19', '1:23', '2:1', '3:1', '3:7'],
			]);
			check('closures', 'f <- function() { function() 3 }\nx <- f()\nx()', [
				['1:1', '1:3', '1:6', '$6', '1:19', '1:30', '2:1', '2:3', '2:6', '3:1'],
			]);
			check('uncalled closure with context ref', 'f <- function() { x <- 3\nfunction() x }\nx', [
				['1@f', '1:3', '1:6', '$9', '1:19', '1:21', '1:24', '2:1', '2@x'],
				['3@x']
			]);
			check('sub-function cluster', 'f <- function() { x <- 3\n4 }\nx', [
				['1@f', '1:3', '1:6', '2:1', '$7' ],
				['1@x', '1:21', '1:24'],
				['3@x']
			]);
		});
		describe('split points', () => {
			describe('control dependencies should be respected', () => {
				/* please repeat this test for while and repeat loops*/
				check('two two-purpose for', `
sum <- vsum
product <- vproduct
w <- vw
N <- vN

for (i in N) {
  sum <- sum + i * w
  product <- product * i
}

cat(sum)
cat(product)
				`, [
					[
						'2@sum', '2@<-', '2@vsum',
						'3@product', '3@<-', '3@vproduct',
						'4@w', '4@<-', '4@vw',
						'5@N', '5@<-', '5@vN',
						'7@for', '7@i', '7@N', '$28',
						'8@sum', '8:10', '8@<-', '8@+', '8@*', '8@i', '8@w',
						'9@product', '9:14', '9@<-', '9@*', '9@i',
						'12@cat', '12@sum',
						'13@cat', '13@product'
					]
				]);
				check('two half if', 'if(x) a <- va else b = vb\nprint(a)\nprint(b)', [
					['1@if', '1@x', '1@a', '1@<-', '1@va', '2@print', '2@a', '1@b', '1@=', '1@vb', '3@print', '3@b']
				]);
				check('the "zeitschleife"', 'x <- vx\nwhile(u) {\nx <- v + vi\n v <- x } ', [ /* or: interdependence should be maintained */
					['1@x', '1@<-', '1@vx', '2@while', '2@u', '$14', '3@x', '3@<-', '3@v', '3@+', '3@vi', '4@v', '4@<-', '4@x']
				]);
				check('re-cluster function calls', 'f <- function() vf\nf()\nf()\nf()', [
					['1@f', '1@<-', '1@function', '1@vf', '2@f', '3@f', '4@f']
				]);
				check('maintain clusters on dependent function calls', 'f <- function(x) x\nk <- f(vi)\nf(k)', [
					['1@f', '1@<-', '1@function', '1@x', '1:18', '2@k', '2@<-', '2@f', '2@vi', '3@f', '3@k']
				]);
			});
		});
		describe('unknown side effects', () => {
			check('unknown side effects should get their own cluster', 'library(dplyr)\nx', [
				{ members: ['1@library', '1@dplyr'], hasUnknownSideEffects: true },
				['2@x']
			]);
			check('unknown side effects should be marked as such', 'x <- vx\nrequire(vx)\nx', [
				{ members: ['2@require', '2@vx'], hasUnknownSideEffects: true },
				['1@x', '1@<-', '1@vx', '3@x']
			]);
			check('unknown side effects with forward ref', 'vx <- 3\nrequire(vx,character.only=TRUE)', [
				{ members: ['1@vx', '1@<-', '1@3', '2@require', '2@vx', '$8', '2@TRUE'], hasUnknownSideEffects: true }
			]);
		});
	}));
});

function compareClusters(actual: DataflowGraphClusters, expected: DataflowGraphClusters): void {
	actual = normalizeClusters(actual);
	expected = normalizeClusters(expected);

	assert.equal(actual.length, expected.length, `Different number of clusters: ${actualExpectedString()}`);
	for(let i = 0; i < actual.length; i++) {
		assert.equal(actual[i].hasUnknownSideEffects, expected[i].hasUnknownSideEffects, `Unknown side effects of cluster differ: ${actualExpectedString()}`);
		assert.equal(actual[i].members.length, expected[i].members.length, `Member amounts of cluster differ: ${actualExpectedString()}`);
		for(let m = 0; m < actual[i].members.length; m++) {
			assert.equal(actual[i].members[m], expected[i].members[m], `Member ${actual[i].members[m]} of cluster differs: ${actualExpectedString()}`);
		}
	}

	function compareIds(a: NodeId | undefined, b: NodeId | undefined): number {
		return String(a ?? '').localeCompare(String(b ?? ''));
	}

	function normalizeClusters(clusters: DataflowGraphClusters): DataflowGraphClusters {
		/* sort order and the order members */
		return clusters.map(c => ({
			...c,
			members: [...c.members].sort(compareIds)
		})).sort((a, b) => compareIds(a.members[0], b.members[0]));
	}

	function actualExpectedString(): string {
		return `
actual   ${JSON.stringify(actual)}
expected ${JSON.stringify(expected)}`;
	}
}
