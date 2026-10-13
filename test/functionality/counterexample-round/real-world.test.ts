import os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { assert, beforeAll, describe, test } from 'vitest';
import { FlowrAnalyzerBuilder } from '../../../src/project/flowr-analyzer-builder';
import { TreeSitterExecutor } from '../../../src/r-bridge/lang-4.x/tree-sitter/tree-sitter-executor';
import type { SlicingCriterion } from '../../../src/slicing/criterion/parse';

const run = promisify(execFile);
async function printed(code: string): Promise<string> {
	try {
		const { stdout } = await run('Rscript', ['--vanilla', '-e', code], { cwd: os.tmpdir(), maxBuffer: 1 << 24, timeout: 20000 });
		return stdout.trimEnd();
	} catch(e) {
		return `failed: ${(e as { stdout?: string }).stdout ?? ''}`;
	}
}

/* the last element states whether the shipped signature database is on, as it is outside the tests */
const cases: readonly (readonly [string, string, string, boolean])[] = [
	['setRefClass contains a class registered by name', 'setRefClass("A", fields = list(a = "numeric"))\nB <- setRefClass("B", contains = "A")\nprint(B$className)', '3@print', false],
	['setRefClass new of a subclass', 'A <- setRefClass("A", fields = list(a = "numeric"))\nB <- setRefClass("B", contains = "A")\nb <- B$new(a = 3)\nprint(b$a)', '4@print', false],
	['uncalled ggplot body and a later library', 'f <- 1\ng <- function() ggplot()\nprint(f)\nlibrary(ggplot2)', '3@print', true],
	['uncalled theme body and a later library', 'f <- 1\ng <- function() theme_classic()\ncat(f, "\\n")\nlibrary(ggplot2)', '3@cat', true],
];

describe.sequential('Counterexample round: real-world scripts', () => {
	beforeAll(async() => {
		await TreeSitterExecutor.initTreeSitter();
	});
	for(const [name, code, criterion, sigdb] of cases) {
		test(name, async() => {
			const prev = process.env.FLOWR_DISABLE_DEFAULT_SIGDB;
			if(sigdb) {
				delete process.env.FLOWR_DISABLE_DEFAULT_SIGDB;
			}
			const analyzer = await new FlowrAnalyzerBuilder().setParser(new TreeSitterExecutor()).build();
			analyzer.addRequest(code);
			const sliced = await analyzer.query([{ type: 'static-slice', criteria: [criterion as SlicingCriterion] }]);
			if(prev !== undefined) {
				process.env.FLOWR_DISABLE_DEFAULT_SIGDB = prev;
			}
			const slice = (Object.values(sliced['static-slice'].results)[0] as { reconstruct: { code: string } }).reconstruct.code;
			const whole = await printed(code);
			const part = await printed(slice);
			assert.strictEqual(part, whole, `the slice:\n${slice}`);
		}, 60000);
	}
});
