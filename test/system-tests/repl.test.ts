import { assert, beforeAll, describe, test } from 'vitest';
import { flowrRepl } from './utility/utility';
import { withShell } from '../functionality/_helper/shell';
import type { DataflowGraph } from '../../src/dataflow/graph/graph';
import { emptyGraph } from '../../src/dataflow/graph/dataflowgraph-builder';
import type { NormalizedAst } from '../../src/r-bridge/lang-4.x/ast/model/processing/decorate';
import { normalizedAstToMermaid, normalizedAstToMermaidUrl } from '../../src/util/mermaid/ast';
import { Dataflow } from '../../src/dataflow/graph/df-helper';
import { analyze } from '../functionality/_helper/analyzer';

describe('repl', () => {
	describe('inspection', { concurrent: false }, withShell(shell => {
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
					const analyzer = await analyze(shell, code);
					dfOut = (await analyzer.dataflow()).graph;
					normalized = await analyzer.normalize();
					output = await flowrRepl([`:df ${replCode}`, `:n ${replCode}`, `:df* ${replCode}`, `:n* ${replCode}`, ':quit']);
				});
				test(':df', () => {
					const expect = Dataflow.visualize.mermaid.convert({ graph: dfOut }).string;
					assert.include(output, expect, `output ${output} does not contain ${expect}`);
				});
				test(':df*', () => {
					const expect = Dataflow.visualize.mermaid.url(dfOut);
					assert.include(output, expect, `output ${output} does not contain ${expect}`);
				});
				test(':n', () => {
					const expect = normalized ? normalizedAstToMermaid(normalized.ast, {}) : '';
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
		try {
			assert.include(output, 'a <- 3\na');
		} catch(e) {
			console.error('Output was:', output);
			throw e;
		}
	});

	test('reports the loaded package database', async() => {
		const output = await flowrRepl([':version', ':quit']);
		try {
			assert.include(output, 'databases');
		} catch(e) {
			console.error('Output was:', output);
			throw e;
		}
	});

	describe(':query api', () => {
		describe('dependencies', () => {
			test('Provide Library Load', async() => {
				const output = await flowrRepl([':query @dependencies "library(x)"', ':quit']);
				assert.include(output, 'Libraries');
				assert.include(output, 'via library');
			});
		});
	});
});
