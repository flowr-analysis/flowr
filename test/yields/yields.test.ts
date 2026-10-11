import os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { assert, beforeAll, describe, test } from 'vitest';
import { FlowrAnalyzerBuilder } from '../../src/project/flowr-analyzer-builder';
import { TreeSitterExecutor } from '../../src/r-bridge/lang-4.x/tree-sitter/tree-sitter-executor';
import type { SlicingCriterion } from '../../src/slicing/criterion/parse';
import type { YieldSnippet } from '../../scripts/extract-yield-snippets';
import snippets from './snippets.json';

/*
 * Every snippet that states what it yields (refresh with
 * `npx ts-node scripts/extract-yield-snippets.ts <dir with .tex files> test/yields/snippets.json`):
 * R has to print that value for the statement, and so has the slice flowR computes for it.
 */
const run = promisify(execFile);

/** what R prints for `code`, in a process of its own so no check sees the state another left behind */
async function printed(code: string): Promise<string[]> {
	const { stdout } = await run('Rscript', ['--vanilla', '-e', code], { maxBuffer: 1 << 24, cwd: os.tmpdir() });
	return stdout.trimEnd().split('\n');
}

/**
 * Whether `output` ends with what R prints for the stated value, or, for a value stated in words
 * (a backquoted plus, `2 + 2 = 4`, `3 (as before)`, `1.01 m`), with that text as R would print it.
 */
function yieldsAsStated(output: readonly string[], expected: readonly string[] | undefined, yields: string): boolean {
	if(expected !== undefined && expected.every((line, i) => output[output.length - expected.length + i] === line)) {
		return true;
	}
	/* the value as written in prose: no `[1]`, no quotes, no brackets around a unit, and for `2 + 2 = 4` what follows the `=` */
	const plain = (text: string) => text.replace(/^\[\d+\]\s*/, '').replace(/^"(.*)"$/, '$1').replace(/[[\]]/g, '').trim();
	const stated = yields.replace(/\s*\([^)]*\)$/, '').split(' = ').at(-1) ?? yields;
	return plain(output.at(-1) ?? '') === plain(stated);
}

/** the statement without the comment trailing it */
const statementOf = (line: string) => line.replace(/\s*#\s*:yields:.*$/, '').replace(/\s*#[^"'`]*$/, '').trim();

describe('Snippets that state what they yield', () => {
	beforeAll(async() => {
		await TreeSitterExecutor.initTreeSitter();
	});
	for(const snippet of snippets as YieldSnippet[]) {
		for(const check of snippet.checks) {
			const statement = statementOf(snippet.code[check.line]);
			const libraries = snippet.libraries.map(l => `suppressMessages(library(${l}))`);
			const program = [...snippet.prefix === '' ? [] : [snippet.prefix], ...libraries, ...snippet.code.slice(0, check.line), `print(${statement})`];
			test(`${statement} yields ${check.yields}`, async() => {
				const missing = snippet.libraries.length === 0 ? [] : await printed(`cat(Filter(function(p) !requireNamespace(p, quietly = TRUE), c(${snippet.libraries.map(l => `"${l}"`).join(', ')})))`);
				assert.deepStrictEqual(missing.filter(m => m !== ''), [], 'the R packages the snippet needs');
				const analyzer = await new FlowrAnalyzerBuilder().setParser(new TreeSitterExecutor()).build();
				analyzer.addRequest(program.join('\n'));
				const [expected, whole, sliced] = await Promise.all([
					printed([...libraries, `print(${check.yields})`].join('\n')).catch(() => undefined),
					printed(program.join('\n')),
					analyzer.query([{ type: 'static-slice', criteria: [`${program.length}@print` as SlicingCriterion] }])
				]);
				const slice = (Object.values(sliced['static-slice'].results)[0] as { reconstruct: { code: string } }).reconstruct.code;
				const part = await printed(slice);
				for(const [what, output] of [['R itself', whole], [`the slice:\n${slice}`, part]] as const) {
					assert.isTrue(yieldsAsStated(output, expected, check.yields), `${what} prints ${JSON.stringify(output)}`);
				}
			});
		}
	}
});
