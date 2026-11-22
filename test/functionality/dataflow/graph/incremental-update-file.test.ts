import { assert, describe, test } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { FlowrAnalyzerBuilder } from '../../../../src/project/flowr-analyzer-builder';
import type { FlowrAnalyzer } from '../../../../src/project/flowr-analyzer';
import { TreeSitterExecutor } from '../../../../src/r-bridge/lang-4.x/tree-sitter/tree-sitter-executor';
import { fileProtocol } from '../../../../src/r-bridge/retriever';
import { FlowrInlineTextFile } from '../../../../src/project/context/flowr-file';
import { resolveOracle } from '../../util/incremental/dataflow-graph/incremental-oracles';

const base = 'x <- 1\nf <- function(a) a + x\ny <- f(2)';

async function analyzerOf(request: (a: FlowrAnalyzer) => void, incremental: boolean): Promise<FlowrAnalyzer> {
	const analyzer = await new FlowrAnalyzerBuilder().setParser(new TreeSitterExecutor()).amendConfig(c => {
		c.incremental.dataflow.reuse = incremental;
		c.incremental.dataflow.activated = incremental;
	}).build();
	request(analyzer);
	return analyzer;
}

/** Runs `steps` on an incremental and a non-incremental analyzer alike, asking `oracle` first after every step, and compares the two. */
async function compareSteps(request: (a: FlowrAnalyzer) => void, steps: readonly ((a: FlowrAnalyzer) => void)[], oracleSpec: string, applied: readonly boolean[]): Promise<void> {
	const oracle = resolveOracle(oracleSpec);
	const [incremental, repeated] = [await analyzerOf(request, true), await analyzerOf(request, false)];
	oracle.assertMatches(await oracle.run(incremental), await oracle.run(repeated), 'initial analysis');
	for(const [i, step] of steps.entries()) {
		step(incremental);
		step(repeated);
		oracle.assertMatches(await oracle.run(incremental), await oracle.run(repeated), `step ${i} (${oracleSpec})`);
		assert.strictEqual(incremental.inspectContext().inc.getLastAppliedIncrementalUpdate()?.applied ?? false, applied[i], `step ${i}: ${JSON.stringify(incremental.inspectContext().inc.getLastAppliedIncrementalUpdate())}`);
	}
}

describe('incremental dataflow through updateFile', () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'flowr-update-file-'));
	const onDisk = path.join(dir, 'script.R');
	fs.writeFileSync(onDisk, base);
	const fromDisk = (a: FlowrAnalyzer) => a.addRequest(`${fileProtocol}${onDisk}`);
	const inline = (a: FlowrAnalyzer) => {
		a.addFile(new FlowrInlineTextFile('inline.R', base));
		a.addRequest({ request: 'file', content: 'inline.R' });
	};

	for(const oracle of [':dataflow', 'query:linter', 'query:dependencies', 'query:call-context']) {
		test(`editor content of a file on disk (${oracle} first)`, async() => {
			await compareSteps(fromDisk, [
				a => a.updateFile(onDisk, `${base}\nprint(y)`),
				a => a.updateFile(onDisk, `${base}\nprint(y) # shown`),
				a => a.updateFile(onDisk, `${base}\nz <- y`)
			], oracle, [true, true, true]);
			assert.strictEqual(fs.readFileSync(onDisk, 'utf8'), base, 'updateFile must not write to disk');
		});
		test(`inline file (${oracle} first)`, async() => {
			await compareSteps(inline, [
				a => a.updateFile('inline.R', `${base}\nprint(y)`),
				a => a.updateFile('inline.R', `${base}\nprint(y) # c`),
				a => a.updateFile('inline.R', `x <- 2\n${base}`)
			], oracle, [true, true, false]);
		});
	}

	test('a saved file is read again', async() => {
		const saved = path.join(dir, 'saved.R');
		fs.writeFileSync(saved, base);
		await compareSteps(a => a.addRequest(`${fileProtocol}${saved}`), [
			a => {
				fs.writeFileSync(saved, `${base}\nprint(y)`);
				a.updateFile(saved);
			}
		], ':dataflow', [true]);
	});
});
