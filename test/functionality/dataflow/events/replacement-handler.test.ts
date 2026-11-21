import { describe, expect, test, vi } from 'vitest';
import { RShell } from '../../../../src/r-bridge/shell';
import { type ReplacementOperatorHandlerArgs, handleReplacementOperator, onReplacementOperator } from '../../../../src/dataflow/graph/unknown-replacement';
import { handleUnknownSideEffect, onUnknownSideEffect } from '../../../../src/dataflow/graph/unknown-side-effect';
import { DataflowGraph } from '../../../../src/dataflow/graph/graph';
import { Environment } from '../../../../src/dataflow/environments/environment';
import type { NodeId } from '../../../../src/r-bridge/lang-4.x/ast/model/processing/node-id';
import { defaultEnv } from '../../_helper/dataflow/environment-builder';
import { analyze } from '../../_helper/analyzer';

async function runDataflowPipeline(code: string) {
	await (await analyze(new RShell(), code.trim())).dataflow();
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