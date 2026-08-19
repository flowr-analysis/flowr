import { assert, describe, test } from 'vitest';
import { LintQuickFixes } from '../../../src/linter/linter-fix';
import type { LintQuickFix } from '../../../src/linter/linter-format';
import type { LinterQueryResult } from '../../../src/queries/catalog/linter-query/linter-query-format';

function remove(loc: LintQuickFix['loc']): LintQuickFix {
	return { type: 'remove', description: 'drop it', loc };
}

function replace(loc: LintQuickFix['loc'], replacement: string): LintQuickFix {
	return { type: 'replace', description: 'swap it', loc, replacement };
}

describe('Linter quick fixes', () => {
	describe('apply', () => {
		test('a removal takes its whole line when nothing else is on it', () => {
			assert.strictEqual(
				LintQuickFixes.apply('library(x)\nprint(1)\n', [remove([1, 1, 1, 10])]),
				'print(1)\n'
			);
		});

		test('a removal keeps the line when something else is on it', () => {
			assert.strictEqual(
				LintQuickFixes.apply('library(x); print(1)\n', [remove([1, 1, 1, 10])]),
				'; print(1)\n'
			);
		});

		test('a replacement swaps exactly the named range', () => {
			assert.strictEqual(
				LintQuickFixes.apply('myVar <- 1\n', [replace([1, 1, 1, 5], 'my_var')]),
				'my_var <- 1\n'
			);
		});

		test('several fixes all land, whichever order they come in', () => {
			assert.strictEqual(
				LintQuickFixes.apply('library(a)\nlibrary(b)\nprint(1)\n', [remove([2, 1, 2, 10]), remove([1, 1, 1, 10])]),
				'print(1)\n'
			);
		});

		test('a multi-line range is removed as a whole', () => {
			assert.strictEqual(
				LintQuickFixes.apply('f <- function() {\n  1\n}\nprint(2)\n', [remove([1, 1, 3, 1])]),
				'print(2)\n'
			);
		});

		test('of two overlapping fixes only the one coming first is kept', () => {
			assert.strictEqual(
				LintQuickFixes.apply('library(x)\n', [replace([1, 9, 1, 9], 'y'), remove([1, 1, 1, 10])]),
				''
			);
		});

		test('no fixes leave the code alone', () => {
			assert.strictEqual(LintQuickFixes.apply('print(1)\n', []), 'print(1)\n');
		});
	});

	describe('byFile', () => {
		const results = {
			'unused-import': {
				results: [
					{ certainty: 'uncertain', involvedId: 0, loc: [1, 1, 1, 10, '/p/a.R'], quickFix: [remove([1, 1, 1, 10, '/p/a.R'])] },
					{ certainty: 'uncertain', involvedId: 1, loc: [2, 1, 2, 10, '/p/b.R'], quickFix: [remove([2, 1, 2, 10, '/p/b.R'])] },
					{ certainty: 'uncertain', involvedId: 2, loc: [3, 1, 3, 10], quickFix: [remove([3, 1, 3, 10])] },
					{ certainty: 'uncertain', involvedId: 3, loc: [4, 1, 4, 10, '/p/a.R'] }
				],
				'.meta': {}
			}
		} as unknown as LinterQueryResult['results'];

		test('fixes are grouped by the file they change', () => {
			const byFile = LintQuickFixes.byFile(results);
			assert.deepStrictEqual([...byFile.keys()].sort(), ['/p/a.R', '/p/b.R']);
			assert.lengthOf(byFile.get('/p/a.R') as LintQuickFix[], 1);
		});

		test('a rule that failed contributes nothing', () => {
			assert.strictEqual(
				LintQuickFixes.byFile({ 'unused-import': { error: new Error('boom') } }).size,
				0
			);
		});
	});
});
