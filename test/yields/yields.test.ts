import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { assert, beforeAll, describe, test } from 'vitest';
import { TreeSitterExecutor } from '../../src/r-bridge/lang-4.x/tree-sitter/tree-sitter-executor';
import type { SlicingCriterion } from '../../src/slicing/criterion/parse';
import type { YieldSnippet } from '../../scripts/extract-yield-snippets';
import { sigDbCacheDir } from '../../src/project/sigdb/decompress';
import snippets from './snippets.json';
import { sliceOf } from '../functionality/_helper/shell';

/*
 * Every snippet that states what it yields (refresh with
 * `npx ts-node scripts/extract-yield-snippets.ts <dir with .tex files> test/yields/snippets.json`):
 * R has to print that value for the statement, and so has the slice flowR computes for it.
 */
const run = promisify(execFile);

/** where the packages a snippet needs but R lacks are installed, ahead of the libraries R already has */
const packageLibrary = path.join(path.dirname(sigDbCacheDir(undefined, false)), 'r-packages');

/** what R prints for `code`, in a process of its own so no check sees the state another left behind */
async function printed(code: string): Promise<string[]> {
	const env = { ...process.env, R_LIBS: [packageLibrary, process.env.R_LIBS].filter(Boolean).join(path.delimiter) };
	const { stdout } = await run('Rscript', ['--vanilla', '-e', code], { maxBuffer: 1 << 24, cwd: os.tmpdir(), env });
	return stdout.trimEnd().split('\n');
}

/** the packages out of `packages` that R can not load */
async function missingOf(packages: readonly string[]): Promise<string[]> {
	if(packages.length === 0) {
		return [];
	}
	const missing = await printed(`cat(Filter(function(p) !requireNamespace(p, quietly = TRUE), c(${packages.map(p => `"${p}"`).join(', ')})))`);
	return missing.join(' ').split(' ').filter(m => m !== '');
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
		/* a package that does not install leaves its checks to skip */
		const missing = await missingOf([...new Set((snippets as YieldSnippet[]).flatMap(s => s.libraries))]);
		if(missing.length > 0) {
			await fs.promises.mkdir(packageLibrary, { recursive: true })
				.then(() => printed(`install.packages(c(${missing.map(p => `"${p}"`).join(', ')}), lib = "${packageLibrary.replaceAll('\\', '/')}", repos = "https://cloud.r-project.org/", quiet = TRUE)`))
				.catch(() => undefined);
		}
	}, 30 * 60 * 1000);
	for(const snippet of snippets as YieldSnippet[]) {
		for(const check of snippet.checks) {
			const statement = statementOf(snippet.code[check.line]);
			const libraries = snippet.libraries.map(l => `suppressMessages(library(${l}))`);
			const program = [...snippet.prefix === '' ? [] : [snippet.prefix], ...libraries, ...snippet.code.slice(0, check.line), `print(${statement})`];
			test(`${statement} yields ${check.yields}`, async ctx => {
				const missing = await missingOf(snippet.libraries);
				if(missing.length > 0) {
					ctx.skip(`R lacks ${missing.join(', ')}, and installing into ${packageLibrary} did not work`);
				}
				const [expected, whole, slice] = await Promise.all([
					printed([...libraries, `print(${check.yields})`].join('\n')).catch(() => undefined),
					printed(program.join('\n')),
					sliceOf(new TreeSitterExecutor(), program.join('\n'), `${program.length}@print` as SlicingCriterion)
				]);
				const part = await printed(slice);
				for(const [what, output] of [['R itself', whole], [`the slice:\n${slice}`, part]] as const) {
					assert.isTrue(yieldsAsStated(output, expected, check.yields), `${what} prints ${JSON.stringify(output)}`);
				}
			});
		}
	}
});
