import { assert, describe, test } from 'vitest';
import { mapProblematicNodesToIds, withTreeSitter } from '../../_helper/shell';
import type { NodeId } from '../../../../src/r-bridge/lang-4.x/ast/model/processing/node-id';
import type { CallGraph } from '../../../../src/dataflow/graph/call-graph';
import { getSubCallGraph } from '../../../../src/dataflow/graph/call-graph';
import { label } from '../../_helper/label';
import { FlowrAnalyzerBuilder } from '../../../../src/project/flowr-analyzer-builder';
import { requestFromInput } from '../../../../src/r-bridge/retriever';
import { diffOfDataflowGraphs } from '../../../../src/dataflow/graph/diff-dataflow-graph';
import { resolveDataflowGraph } from '../../../../src/dataflow/graph/resolve-graph';
import { diffGraphsToMermaidUrl } from '../../../../src/util/mermaid/dfg';
import { emptyGraph } from '../../../../src/dataflow/graph/dataflowgraph-builder';
import { argumentInCall, defaultEnv } from '../../_helper/dataflow/environment-builder';
import { builtInId } from '../../../../src/dataflow/environments/built-in';
import { ExitPointType } from '../../../../src/dataflow/info';
import type { SingleSlicingCriterion } from '../../../../src/slicing/criterion/parse';
import { slicingCriterionToId } from '../../../../src/slicing/criterion/parse';
import type { DataflowGraph } from '../../../../src/dataflow/graph/graph';

describe('Call Graph Sub-Extraction', withTreeSitter(ts => {
	function checkSubCallGraph(testName: string, code: string, entries: NodeId[], expectedGraph: CallGraph | DataflowGraph): void {
		const n = label(testName, [], ['call-graph']);
		test(n, async() => {
			const analyzer = await new FlowrAnalyzerBuilder().setParser(ts).build();
			analyzer.addRequest(requestFromInput(code));
			const cg = await analyzer.callGraph();
			const idMap = (await analyzer.normalize()).idMap;
			const resolvedEntries = entries.map(e => slicingCriterionToId(e as SingleSlicingCriterion, idMap));
			const subCg = getSubCallGraph(cg, new Set(resolvedEntries));
			const expectedResolved = resolveDataflowGraph(expectedGraph, analyzer.inspectContext(), idMap);
			const diff = diffOfDataflowGraphs({
				graph: subCg,
				name:  'Got'
			}, {
				graph: expectedResolved,
				name:  'Expected'
			});
			try {
				assert.isTrue(diff.isEqual(), `report:\n * ${diff.comments()?.join('\n * ') ?? ''}`);
			} catch(e) {
				const diffStr = diffGraphsToMermaidUrl(
					{ label: 'expected', graph: expectedResolved, mark: mapProblematicNodesToIds(diff.problematic()) },
					{ label: 'got', graph: subCg, mark: mapProblematicNodesToIds(diff.problematic()) },
					`%% ${JSON.stringify(code).replace(/\n/g, '\n%% ')}\n` + diff.comments()?.map(n => `%% ${n}\n`).join('') + '\n'
				);
				console.log(`Call Graph Sub Extraction Test "${testName}" failed. Diff URL:\n${diffStr}`);
				throw e;
			}
		});
	}


	checkSubCallGraph('sample calls',
		`foo <- function(x) {
			return(x + 1)
		}
		bar <- function(y) {
			return(foo(y) * 2)
		}
		u <- bar(3)
		`, ['1@function'],
		emptyGraph()
			.call(11, '{', [argumentInCall('1@10')], { omitArgs: true, onlyBuiltIn: true })
			.defineFunction('1@function', [{ nodeId: 10, controlDependencies: undefined, type: ExitPointType.Return }], {
				out:               [],
				in:                [],
				unknownReferences: [],
				entryPoint:        '2@return',
				graph:             new Set([1, 6, 7, 8, 10, 11]),
				environment:       defaultEnv().pushEnv().defineParameter('x', '1@x', '1@x')
			}, { readParams: [[1, true]] })
			.calls('1@function', [11, '2@return'])
			.calls(11, [10, builtInId('expression-list')])
			.call('2@return', 'return', [argumentInCall('2@return')], { onlyBuiltIn: true, omitArgs: true, origin: ['builtin:return'] })
			.calls('2@return', builtInId('return')).calls('2@return', '2@+')
			.call('2@+', '+', [argumentInCall('2@x'), argumentInCall('2@1')], { onlyBuiltIn: true, omitArgs: true })
			.calls('2@+', builtInId('default'))
	);
}));