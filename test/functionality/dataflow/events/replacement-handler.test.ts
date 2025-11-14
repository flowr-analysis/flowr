import { describe, expect, test, vi } from 'vitest';
import { PipelineExecutor } from '../../../../src/core/pipeline-executor';
import { DEFAULT_DATAFLOW_PIPELINE } from '../../../../src/core/steps/pipeline/default-pipelines';
import { RShell } from '../../../../src/r-bridge/shell';
import { requestFromInput } from '../../../../src/r-bridge/retriever';
import { type ReplacementOperatorHandlerArgs , handleReplacementOperator, onReplacementOperator } from '../../../../src/dataflow/graph/unknown-replacement';
import { handleUnknownSideEffect, onUnknownSideEffect } from '../../../../src/dataflow/graph/unknown-side-effect';
import { DataflowGraph } from '../../../../src/dataflow/graph/graph';
import { Environment } from '../../../../src/dataflow/environments/environment';
import type { NodeId } from '../../../../src/r-bridge/lang-4.x/ast/model/processing/node-id';
import { defaultConfigOptions } from '../../../../src/config';
import { defaultEnv } from '../../_helper/dataflow/environment-builder';

async function runDataflowPipeline(code: string) {
	await new PipelineExecutor(DEFAULT_DATAFLOW_PIPELINE, {
		parser:   new RShell(),
		requests: requestFromInput(code.trim())
	}, defaultConfigOptions).allRemainingSteps();
}

describe('unknown-replacement', () =>  {
	test('direct-call', () => {
		const mockHandler = vi.fn();
		onReplacementOperator(mockHandler);
		handleReplacementOperator({} as unknown as ReplacementOperatorHandlerArgs);
		expect(mockHandler).toHaveBeenCalled();
	});

	test('mock-handler-test', async() => {
		const mockHandler = vi.fn();
		onReplacementOperator(mockHandler);
		await runDataflowPipeline('a$b <- 5');
		expect(mockHandler).toHaveBeenCalled();
	});
});

describe('unknown-side-effect', () => {
	test('direct-call', () => {
		const mockHandler = vi.fn();
		onUnknownSideEffect(mockHandler);
		const graph = new DataflowGraph(undefined);
		const env = {
			current: new Environment(defaultEnv().current),
			level:   0
		};
		handleUnknownSideEffect(graph, env, {} as unknown as NodeId);
		expect(mockHandler).toHaveBeenCalled();
	});

	test('mock-handler-test', async() => {
		const mockHandler = vi.fn();
		onUnknownSideEffect(mockHandler);
		await runDataflowPipeline('eval("test")');
		expect(mockHandler).toHaveBeenCalled();
	});
});