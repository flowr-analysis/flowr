import type {
	CallContextQuery,
	CallContextQueryResult } from '../../../../src/queries/call-context-query/call-context-query-format';
import {
	CallTargets
} from '../../../../src/queries/call-context-query/call-context-query-format';


import { PipelineExecutor } from '../../../../src/core/pipeline-executor';
import type { RShell } from '../../../../src/r-bridge/shell';
import { DEFAULT_DATAFLOW_PIPELINE } from '../../../../src/core/steps/pipeline/default-pipelines';
import { requestFromInput } from '../../../../src/r-bridge/retriever';
import { deterministicCountingIdGenerator } from '../../../../src/r-bridge/lang-4.x/ast/model/processing/decorate';
import { executeQueries } from '../../../../src/queries/query';
import { withShell } from '../../_helper/shell';
import { assert } from 'chai';

function test(name: string, shell: RShell, code: string, queries: readonly CallContextQuery[], expected: CallContextQueryResult) {
	/* TODO: labels */
	it(name, async() => {
		const info = await new PipelineExecutor(DEFAULT_DATAFLOW_PIPELINE, {
			shell,
			request: requestFromInput(code),
			getId:   deterministicCountingIdGenerator(0)
		}).allRemainingSteps();

		const graph = info.dataflow.graph;
		const { 'call-context': result } = executeQueries(graph, queries);
		/* expect them to be deeply equal */
		assert.deepStrictEqual(result, expected, 'The result of the call context query does not match the expected result');
	});
}

/** TODO: check what happens if builtin if may be override */
describe('Call Context Query', withShell(shell => {
	test('Print calls', shell, 'print(1)', [{
		type:        'call-context',
		callName:    /print/,
		kind:        'visualize',
		subkind:     'print',
		callTargets: CallTargets.OnlyGlobal
	}], {
		type:  'call-context',
		kinds: {
			'visualize': {
				subkinds: {
					'print': [{
						id:    3,
						calls: []
					}]
				}
			}
		}
	});
}));
