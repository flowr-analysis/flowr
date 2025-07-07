import { assert, beforeAll, describe, test } from 'vitest';
import { flowrRepl } from './utility/utility';
import { graphToMermaid, graphToMermaidUrl } from '../../src/util/mermaid/dfg';
import type { PipelineOutput } from '../../src/core/steps/pipeline/pipeline';
import { DEFAULT_DATAFLOW_PIPELINE } from '../../src/core/steps/pipeline/default-pipelines';
import { PipelineExecutor } from '../../src/core/pipeline-executor';
import { requestFromInput } from '../../src/r-bridge/retriever';
import { withShell } from '../functionality/_helper/shell';
import type { RShell } from '../../src/r-bridge/shell';
import type { DataflowGraph } from '../../src/dataflow/graph/graph';
import { emptyGraph } from '../../src/dataflow/graph/dataflowgraph-builder';
import type { NormalizedAst } from '../../src/r-bridge/lang-4.x/ast/model/processing/decorate';
import { normalizedAstToMermaid, normalizedAstToMermaidUrl } from '../../src/util/mermaid/ast';
import { defaultConfigOptions } from '../../src/config';

describe('repl', () => {
	async function analyze(shell: RShell, code: string): Promise<PipelineOutput<typeof DEFAULT_DATAFLOW_PIPELINE>> {
		return await new PipelineExecutor(DEFAULT_DATAFLOW_PIPELINE, {
			parser:  shell,
			request: requestFromInput(code)
		}, defaultConfigOptions).allRemainingSteps();
	}
	describe.sequential('inspection', withShell(shell => {
		for(const [code, str] of [
			['test', false],
			['x <- 3', false],
			['x <- 3\nprint(x)', true],
			['x <- 2\nif(u) { x <- 3 } else { x <- 4 }\nprint(x)', true],
			['x <- 2;y <- "hello";print(paste(x,y))', true],
		] as const) {
			const replCode = str ? JSON.stringify(code) : code;
			describe(replCode, () => {
				let dfOut: DataflowGraph = emptyGraph();
				let normalized: NormalizedAst | undefined = undefined;
				let output = '';
				beforeAll(async() => {
					const data = await analyze(shell, code);
					dfOut = data.dataflow.graph;
					normalized = data.normalize;
					output = await flowrRepl([`:df ${replCode}`, `:n ${replCode}`, `:df* ${replCode}`, `:n* ${replCode}`, ':quit']);
				});
				test(':df', () => {
					const expect = graphToMermaid({ graph: dfOut }).string;
					assert.include(output, expect, `output ${output} does not contain ${expect}`);
				});
				test(':df*', () => {
					const expect = graphToMermaidUrl(dfOut);
					assert.include(output, expect, `output ${output} does not contain ${expect}`);
				});
				test(':n', () => {
					const expect = normalized ? normalizedAstToMermaid(normalized.ast) : '';
					assert.include(output, expect, `output ${output} does not contain ${expect}`);
				});
				test(':n*', () => {
					const expect = normalized ? normalizedAstToMermaidUrl(normalized.ast) : '';
					assert.include(output, expect, `output ${output} does not contain ${expect}`);
				});
			});
		}
	}));

	test(':slicer', async() => {
		const output = await flowrRepl([':slicer -c "3@a" -r "a <- 3\\nb <- 4\\nprint(a)"', ':quit']);
		assert.include(output, 'a <- 3\na');
	});

	describe(':query api', () => {
		describe('dependencies', () => {
			test('Provide Library Load', async() => {
				const output = await flowrRepl([':query @dependencies "library(x)"', ':quit']);
				assert.include(output, 'library');
				assert.include(output, 'x');
			});
		});
	});
});
