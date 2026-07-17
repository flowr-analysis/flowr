import { assert, describe, test } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { withTreeSitter } from '../_helper/shell';
import { createDataflowPipeline } from '../../../src/core/steps/pipeline/default-pipelines';
import { contextFromInput } from '../../../src/project/context/flowr-analyzer-context';
import { DataflowMermaid } from '../../../src/util/mermaid/dfg';

function nodeLabels(mermaid: string): string[] {
	return [...mermaid.matchAll(/"`([\s\S]*?)`"/g)].map(m => m[1]);
}

const awkwardName = 'we`ird".R';

describe('Dataflow mermaid', withTreeSitter(parser => {
	async function build(simplified: boolean): Promise<string> {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'flowr-mermaid-'));
		try {
			const sourced = path.join(dir, awkwardName);
			fs.writeFileSync(sourced, 'if(u > 1) { y <- 2 }\nf <- function(a) { a + 1 }\n');
			const main = path.join(dir, 'main.R');
			fs.writeFileSync(main, `source('${sourced.replaceAll('\\', '/')}')\nx <- f(y)\n`);
			const result = await createDataflowPipeline(parser, { context: contextFromInput(`file://${main}`) }).allRemainingSteps();
			return DataflowMermaid.raw(result.dataflow.graph, false, undefined, simplified);
		} finally {
			fs.rmSync(dir, { recursive: true, force: true });
		}
	}

	/** the mermaid of a project sourcing {@link awkwardName}, analyzed once per mode */
	const cache = new Map<boolean, Promise<string>>();
	function mermaidOfSourcingProject(simplified: boolean): Promise<string> {
		let mermaid = cache.get(simplified);
		if(mermaid === undefined) {
			mermaid = build(simplified);
			cache.set(simplified, mermaid);
		}
		return mermaid;
	}

	test.each([false, true])('nothing of the project ends a label or the string around it (simplified: %s)', async(simplified) => {
		const mermaid = await mermaidOfSourcingProject(simplified);
		assert.notInclude(mermaid, awkwardName, 'every id built from the path has to be escaped');
		const labels = nodeLabels(mermaid);
		assert.isNotEmpty(labels);
		for(const label of labels) {
			assert.notInclude(label, '"', `the label ${JSON.stringify(label)} has to escape its quotes`);
			assert.notInclude(label, '`', `the label ${JSON.stringify(label)} has to escape its backticks`);
		}
	});

	test('an id stays readable and relative to what was requested', async() => {
		const mermaid = await mermaidOfSourcingProject(false);
		assert.include(mermaid, 'v: ', 'the sourced file has to contribute origins');
		assert.match(mermaid, /, we_ird_\.R:\d+:\d+-\d+\+/, 'the conditional definition has to contribute a control dependency');
		const ids = [...mermaid.matchAll(/\*\*id: (.*?)\*\*/g)].map(m => m[1]);
		assert.isNotEmpty(ids);
		for(const id of ids) {
			assert.notInclude(id, os.tmpdir(), `the id ${id} still carries the requested root`);
		}
	});

	test('a simplified subflow is labeled by the function it holds', async() => {
		const subgraphs = [...(await mermaidOfSourcingProject(true)).matchAll(/^subgraph "[^"]+" \["(.*)"]$/gm)].map(m => m[1]);
		assert.isNotEmpty(subgraphs);
		assert.isTrue(subgraphs.some(s => s.includes('function(a)')), `the lexeme has to name the subflow, got ${JSON.stringify(subgraphs)}`);
	});
}));
