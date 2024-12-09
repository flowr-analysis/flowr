import { withShell } from '../../_helper/shell';
import { describe, expect, test } from 'vitest';
import { PipelineExecutor } from '../../../../src/core/pipeline-executor';
import { DEFAULT_DATAFLOW_PIPELINE } from '../../../../src/core/steps/pipeline/default-pipelines';
import { requestFromInput } from '../../../../src/r-bridge/retriever';
import { resolveToValues } from '../../../../src/dataflow/environments/resolve-by-name';
import type { Identifier } from '../../../../src/dataflow/environments/identifier';
import type { RShell } from '../../../../src/r-bridge/shell';
import { numVal } from '../../_helper/ast-builder';

async function runPipeline(code: string, shell: RShell) {
	return await new PipelineExecutor(DEFAULT_DATAFLOW_PIPELINE, {
		shell:   shell,
		request: requestFromInput(code)
	}).allRemainingSteps();
}

describe.sequential('Alias Tracking', withShell(shell => {
	test('Simple Builtin Constant', async() => {
		const result = await runPipeline('x <- TRUE; y <- x; print(y);', shell);
		const values = resolveToValues('x' as Identifier, result.dataflow.environment, result.dataflow.graph);
		expect(values).toEqual([true]);
	});

	test('Simple Numbers', async() => {
		const result = await runPipeline('x <- 42; y <- x; print(y);', shell);
		const values = resolveToValues('x' as Identifier, result.dataflow.environment, result.dataflow.graph);
		expect(values).toEqual([numVal(42)]);
	});

	test('Simple Builtin Multiple', async() => {
		const result = await runPipeline('x <- TRUE; y <- FALSE; z <- y; z <- x; print(z);', shell);
		const values = resolveToValues('x' as Identifier, result.dataflow.environment, result.dataflow.graph);
		expect(values).toEqual([true, false]);
	});
}));

