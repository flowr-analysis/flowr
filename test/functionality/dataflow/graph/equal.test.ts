import { emptyGraph } from '../../../../src/dataflow/graph/dataflowgraph-builder';
import type { DataflowGraphJson } from '../../../../src/dataflow/graph/graph';
import { DataflowGraph } from '../../../../src/dataflow/graph/graph';
import { diffGraphsToMermaidUrl } from '../../../../src/util/mermaid/dfg';
import type { GenericDiffConfiguration } from '../../../../src/util/diff';
import type { DataflowDifferenceReport } from '../../../../src/dataflow/graph/diff';
import { diffOfDataflowGraphs } from '../../../../src/dataflow/graph/diff';
import { jsonReplacer } from '../../../../src/util/json';
import { argumentInCall } from '../../_helper/dataflow/environment-builder';
import { BuiltIn } from '../../../../src/dataflow/environments/built-in';
import { describe, assert, test } from 'vitest';

function check(cmp: (x: boolean) => void, a: DataflowGraph, b: DataflowGraph, text: string, config?: GenericDiffConfiguration) {
	let res: DataflowDifferenceReport | undefined = undefined;
	try {
		res = diffOfDataflowGraphs({
			name:  'left (a)',
			graph: a
		}, {
			name:  'right (b)',
			graph: b
		}, config);
		cmp(res.isEqual());
	} catch(e) {
		console.log(res?.comments());
		// only calculate the dataflow graphs if it fails
		const diff = diffGraphsToMermaidUrl({ label: 'left', graph: a }, { label: 'right', graph: b }, '');
		console.error(text + '; diff:\n', diff);
		throw e;
	}
}

describe('Dataflow Graph Comparisons', () => {
	describe('Equal', () => {
		function raw(name: string, a: DataflowGraph, b: DataflowGraph, text: string, cmp: (x: boolean) => void) {
			return test(name, () => {
				// as the comparison is relatively quick, we allow explicit checks for commutativity
				check(cmp, a, b, 'a;b -> ' + text);
				check(cmp, b, a, 'b;a -> ' + text);
			});
		}

		describe('Positive', () => {
			function eq(name: string, a: DataflowGraph, b: DataflowGraph) {
				raw(name, a, b, 'should be equal', k => assert.isTrue(k));
			}

			eq('Empty graphs', emptyGraph(), emptyGraph());
			eq('Same vertex', emptyGraph().use('0', 'x'), emptyGraph().use('0', 'x'));
		});
		describe('Negative', () => {
			function neq(name: string, a: DataflowGraph, b: DataflowGraph) {
				raw(name, a, b, 'should differ', k => assert.isFalse(k));
			}
			describe('More elements', () => {
				neq('Additional root vertex', emptyGraph(), emptyGraph().use('0', 'x'));
				neq('Additional non-root vertex', emptyGraph(), emptyGraph().use('0', 'x', {}, false));
				neq('Additional edge', emptyGraph(), emptyGraph().reads('0', '1'));
			});
			describe('Different elements', () => {
				describe('Different vertices', () => {
					const rhs = emptyGraph().use('0', 'x');
					neq('Id', emptyGraph().use('1', 'x'), rhs);
					neq('Name', emptyGraph().use('0', 'y'), rhs);
					neq('Control Dependency', emptyGraph().use('0', 'x', { controlDependencies: [{ id: '1', when: true }] }), rhs);
					neq('Tag', emptyGraph().constant('0'), rhs);
				});
				describe('Different edges', () => {
					const rhs = emptyGraph().reads('0', '1');
					neq('Source Id', emptyGraph().reads('2', '1'), rhs);
					neq('Target Id', emptyGraph().reads('0', '2'), rhs);
					neq('Type', emptyGraph().calls('0', '1'), rhs);
				});
			});
		});

		describe('JSON Data', () =>{
			const graph = emptyGraph()
				.use('0', 'a', { controlDependencies: [] })
				.argument('3', '0')
				.call('3', '[', [argumentInCall('0'), argumentInCall('1')], { returns: ['0'], reads: [BuiltIn, '0', '1'], onlyBuiltIn: true })
				.argument('3', '1')
				.argument('6', '3')
				.call('6', '[', [argumentInCall('3'), argumentInCall('4')], { returns: ['3'], reads: ['3', '4', BuiltIn], onlyBuiltIn: true })
				.argument('6', '4')
				.constant('1')
				.constant('4');
			const json = JSON.parse(JSON.stringify(graph, jsonReplacer)) as DataflowGraphJson;
			const graph2 = DataflowGraph.fromJson(json);
			raw('Equals', graph, graph2, 'should be equal', k => assert.isTrue(k));
		});
	});
	describe('Subgraph Comparison', () => {
		// b will be passes as subgraph on both sides
		function raw(name: string, a: DataflowGraph, b: DataflowGraph, text: string, cmp: (x: boolean) => void) {
			return test(name, () => {
				// as the comparison is relatively quick, we allow explicit checks for commutativity
				check(cmp, a, b, 'a >= b -> ' + text, { rightIsSubgraph: true });
				check(cmp, b, a, 'b <= a -> ' + text, { leftIsSubgraph: true });
			});
		}

		describe('Positive', () => {
			function eq(name: string, a: DataflowGraph, b: DataflowGraph) {
				raw(name, a, b, 'should hold', k => assert.isTrue(k));
			}

			eq('Empty graphs', emptyGraph(), emptyGraph());
			eq('Same vertex', emptyGraph().use('0', 'x'), emptyGraph().use('0', 'x'));
			eq('Same vertex with additional', emptyGraph().use('0', 'x').use('1', 'y'), emptyGraph().use('0', 'x'));
			eq('Same vertex with additional (2)',
				emptyGraph().use('0', 'x').use('1', 'y').use('2', 'z'),
				emptyGraph().use('0', 'x').use('1', 'y'));
			eq('Same edges', emptyGraph().use('0','x').reads('0', '1'), emptyGraph().reads('0', '1'));
			eq('Same edges with additional', emptyGraph().use('0','x').use('1','y').reads('0', '1').reads('1', '2'), emptyGraph().reads('0', '1'));
		});
	});
});
