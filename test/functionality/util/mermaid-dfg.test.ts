import { assert, describe, test } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { withTreeSitter } from '../_helper/shell';
import { createDataflowPipeline } from '../../../src/core/steps/pipeline/default-pipelines';
import { contextFromInput } from '../../../src/project/context/flowr-analyzer-context';
import { DataflowMermaid } from '../../../src/util/mermaid/dfg';

/** the node labels of the given mermaid code, i.e. everything mermaid parses as the text of a vertex */
function nodeLabels(mermaid: string): string[] {
	return [...mermaid.matchAll(/"`([\s\S]*?)`"/g)].map(m => m[1]);
}

/** a name mermaid must never see as it is: the backtick ends a label, the quote the string holding it */
const awkwardName = 'we`ird".R';

describe('Dataflow mermaid', withTreeSitter(parser => {
	/**
	 * The mermaid of a project sourcing {@link awkwardName}, which makes the ids of the sourced vertices carry that
	 * path. The sourced file conditionally defines the variable and the function `main.R` uses, so the vertices
	 * reference it as a control dependency (`:may:`), an origin (`v:`) and a subflow.
	 */
	async function mermaidOfSourcingProject(simplified: boolean): Promise<string> {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'flowr-mermaid-'));
		try {
			const sourced = path.join(dir, awkwardName);
			fs.writeFileSync(sourced, 'if(u > 1) { y <- 2 }\nf <- function(a) { a + 1 }\n');
			const main = path.join(dir, 'main.R');
			// single quotes, as the name holds a double one
			fs.writeFileSync(main, `source('${sourced.replaceAll('\\', '/')}')\nx <- f(y)\n`);
			const result = await createDataflowPipeline(parser, { context: contextFromInput(`file://${main}`) }).allRemainingSteps();
			return DataflowMermaid.raw(result.dataflow.graph, false, undefined, simplified);
		} finally {
			fs.rmSync(dir, { recursive: true, force: true });
		}
	}

	test.each([false, true])('a path of the project never reaches the output unescaped (simplified: %s)', async(simplified) => {
		assert.notInclude(await mermaidOfSourcingProject(simplified), awkwardName,
			'every id built from the path has to be escaped, a raw one ends the label or the string around it');
	});

	test.each([false, true])('a label never carries a raw quote or backtick (simplified: %s)', async(simplified) => {
		const labels = nodeLabels(await mermaidOfSourcingProject(simplified));
		assert.isNotEmpty(labels);
		for(const label of labels) {
			assert.notInclude(label, '"', `the label ${JSON.stringify(label)} has to escape its quotes`);
			assert.notInclude(label, '`', `the label ${JSON.stringify(label)} has to escape its backticks`);
		}
	});

	test('a vertex still reports its origins and dependencies, only escaped', async() => {
		const mermaid = await mermaidOfSourcingProject(false);
		assert.include(mermaid, 'v: ', 'the sourced file has to contribute origins');
		assert.include(mermaid, ':may:', 'the conditional definition has to contribute a control dependency');
		assert.include(mermaid, '#34;', 'a quoted origin is escaped');
	});

	test('a simplified subflow is labeled by the function it holds', async() => {
		const mermaid = await mermaidOfSourcingProject(true);
		const subgraphs = [...mermaid.matchAll(/^subgraph "[^"]+" \["(.*)"]$/gm)].map(m => m[1]);
		assert.isNotEmpty(subgraphs);
		assert.isTrue(subgraphs.some(s => s.includes('function(a)')), `the lexeme has to name the subflow, got ${JSON.stringify(subgraphs)}`);
	});
}));
