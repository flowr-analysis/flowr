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

	test.each([
		['x <- TRUE; print(x);', 'x', [true]],
		['x <- TRUE; y <- x; print(y);', 'y', [true]],
		['x <- 42; y <- x; print(y);', 'y', [numVal(42)]],
		['x <- TRUE; y <- FALSE; z <- x; z <- y; print(z);', 'z', [false]],
		['x <- TRUE; y <- FALSE; if(x) { y <- TRUE; }; print(y);', 'y', [true]],
		[`x <- TRUE;
while(x) {
  if(runif(1)) 
     x <- FALSE
}`, 'x', [true, false]]
	])('%s should resolve %s to %o', async (code, identifier, expectedValues) => {
		const result = await runPipeline(code, shell);
		const values = resolveToValues(identifier as Identifier, result.dataflow.environment, result.dataflow.graph);
		expect(values).toEqual(expectedValues);
	});
}));

