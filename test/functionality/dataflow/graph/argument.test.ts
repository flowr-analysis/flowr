import { assert, describe, test } from 'vitest';
import { PipelineExecutor } from '../../../../src/core/pipeline-executor';
import { DEFAULT_DATAFLOW_PIPELINE } from '../../../../src/core/steps/pipeline/default-pipelines';
import { withShell } from '../../_helper/shell';
import { requestFromInput } from '../../../../src/r-bridge/retriever';
import type { DataflowGraphVertexFunctionCall } from '../../../../src/dataflow/graph/vertex';
import { VertexType } from '../../../../src/dataflow/graph/vertex';
import {
	getValueOfArgument
} from '../../../../src/queries/catalog/call-context-query/identify-link-to-last-call-relation';
import { RType } from '../../../../src/r-bridge/lang-4.x/ast/model/type';
import type { RNumber } from '../../../../src/r-bridge/lang-4.x/ast/model/nodes/r-number';
import type { RLogical } from '../../../../src/r-bridge/lang-4.x/ast/model/nodes/r-logical';

describe.sequential('Retrieve fitting Argument', withShell(shell => {
	async function retrieveArgOfCode(code: string, index: number, name?: string) {
		const dfg = await new PipelineExecutor(DEFAULT_DATAFLOW_PIPELINE, {
			parser:  shell,
			request: requestFromInput(code)
		}).allRemainingSteps();
		// we assume that the entry point of the graph is the function call
		const graph = dfg.dataflow.graph;
		const call = graph.getVertex(dfg.dataflow.entryPoint);
		assert.strictEqual(call?.tag, VertexType.FunctionCall);
		return getValueOfArgument(graph, call as DataflowGraphVertexFunctionCall, { name, index });
	}
	describe('Unnamed Arguments Only', () => {
		for(const [index, value] of [[0, 1], [1, 2], [2, 3]] as const) {
			test(`Unnamed at index ${index}`, async() => {
				const val = await retrieveArgOfCode('foo(1, 2, 3)', index);
				assert.strictEqual(val?.type, RType.Number);
				assert.strictEqual((val as RNumber).content.num, value);
			});
		}
	});
	describe('Mixed with named Arguments', () => {
		for(const [index, name, value] of [[0, undefined, 1], [1, 'peter', 2], [1, 'xylophon', 3]] as const) {
			test(`${name ?? 'Unnamed'} at index ${index}`, async() => {
				const val = await retrieveArgOfCode('foo(1, walter=4, peter=2, 3)', index, name);
				assert.strictEqual(val?.type, RType.Number);
				assert.strictEqual((val as RNumber).content.num, value);
			});
		}
	});
	describe('Not Existing', () => {
		for(const [index, name] of [[4, undefined], [12, 'peter']] as const) {
			test(`${name ?? 'Unnamed'} at index ${index}`, async() => {
				const val = await retrieveArgOfCode('foo(1)', index, name);
				assert.isUndefined(val);
			});
		}
	});
	describe('Non Boolean', () => {
		test('Boolean at index 0', async() => {
			const val = await retrieveArgOfCode('foo(TRUE)', 0);
			assert.strictEqual(val?.type, RType.Logical);
			assert.isTrue((val as RLogical).content);
		});
		test('Boolean with name', async() => {
			const val = await retrieveArgOfCode('foo(4, a="hey", b=FALSE)', 0, 'b');
			assert.strictEqual(val?.type, RType.Logical);
			assert.isFalse((val as RLogical).content);
		});
	});
}));
