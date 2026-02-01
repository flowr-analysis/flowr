import { withShell } from '../../../_helper/shell';
import { describe, expect, test } from 'vitest';
import { Identifier } from '../../../../../src/dataflow/environments/identifier';
import type { RShell } from '../../../../../src/r-bridge/shell';
import { PipelineExecutor } from '../../../../../src/core/pipeline-executor';
import { DEFAULT_DATAFLOW_PIPELINE } from '../../../../../src/core/steps/pipeline/default-pipelines';
import { defaultConfigOptions } from '../../../../../src/config';
import { setFrom } from '../../../../../src/dataflow/eval/values/sets/set-constants';
import { valueFromTsValue } from '../../../../../src/dataflow/eval/values/general';
import { Top } from '../../../../../src/dataflow/eval/values/r-value';
import { trackAliasInEnvironments } from '../../../../../src/dataflow/eval/resolve/alias-tracking';
import type { FlowrAnalyzerContext } from '../../../../../src/project/context/flowr-analyzer-context';
import { contextFromInput } from '../../../../../src/project/context/flowr-analyzer-context';

async function runPipeline(code: string, shell: RShell, ctx: FlowrAnalyzerContext) {
	return await new PipelineExecutor(DEFAULT_DATAFLOW_PIPELINE, {
		parser:  shell,
		context: ctx
	}).allRemainingSteps();
}

describe.sequential('Alias Tracking', withShell(shell => {
	test.each([
		['x <- TRUE; print(x);', 'x', setFrom(valueFromTsValue(true))],
		['x <- TRUE; y <- x; print(y);', 'y', setFrom(valueFromTsValue(true))],
		['x <- 42; y <- x; print(y);', 'y', setFrom(valueFromTsValue(42))],
		['x <- TRUE; y <- FALSE; z <- x; z <- y; print(z);', 'z', setFrom(valueFromTsValue(false))],
		['x <- TRUE; y <- FALSE; if(x) { y <- TRUE; }; print(y);', 'y', setFrom(valueFromTsValue(true))],
		['x <- TRUE; while(x) { if(runif(1)) { x <- FALSE } }', 'x', setFrom(valueFromTsValue(true), valueFromTsValue(false))],
		['k <- 4; if(u) { x <- 2; } else { x <- 3; }; y <- x; print(y);', 'y', setFrom(valueFromTsValue(2), valueFromTsValue(3))],
		['f <- function(a = u) { if(k) { u <- 1; } else { u <- 2; }; print(a); }; f();', 'a', Top], // Note: This should result in a in [1,2] in the future
		['x <- 1; while(x < 10) { if(runif(1)) x <- x + 1 }', 'x', Top]
	])('%s should resolve %s to %o', async(code, identifier, expectedValues) => {
		const ctx = contextFromInput(code);
		const result = await runPipeline(code, shell, ctx);
		const values = trackAliasInEnvironments(
			defaultConfigOptions.solver.variables,
			Identifier.make(identifier),
			result.dataflow.environment,
			ctx,
			result.dataflow.graph,
			result.dataflow.graph.idMap
		);
		expect(values).toEqual(expectedValues);
	});
}));

