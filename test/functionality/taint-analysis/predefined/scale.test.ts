import { test, describe } from 'vitest';
import type { TaintAnalysisExpectation } from '../helper';
import { testPredefinedTaintAnalysis } from '../helper';
import { ZScore, ZeroCentered, MinMax } from '../../../../src/taint-analysis/predefined/scale-analysis';
import { Bottom, Top } from '../../../../src/abstract-interpretation/domains/lattice';

const testScaleAnalysis =
	(code: string, expectation: TaintAnalysisExpectation) => testPredefinedTaintAnalysis(code, 'scale', expectation);

describe('Taint Analysis Scale', () => {
	test('unrelated assignment', async() => {
		await testScaleAnalysis(`
			x <- 42`,
		{
			'1@x': undefined,
		});
	});

	test('tainting of z-score scaled value', async() => {
		await testScaleAnalysis(`
			x <- scale(x)`,
		{
			'1@x': ZScore,
		});
	});

	test('center only (no scaling)', async() => {
		await testScaleAnalysis(`
			x <- scale(x, scale = FALSE)`,
		{
			'1@x': ZeroCentered,
		});
	});

	test('scale only (calculates root mean square)', async() => {
		await testScaleAnalysis(`
			x <- scale(x, center = FALSE)`,
		{
			'1@x': Top,
		});
	});

	test('no centering and no scaling (identity)', async() => {
		await testScaleAnalysis(`
			x <- scale(x, center = FALSE, scale = FALSE)`,
		{
			'1@x': Top,
		});
	});

	test('mean after zero-centered scaling -> Bottom', async() => {
		await testScaleAnalysis(`
			x <- scale(x, scale = FALSE)
			x <- mean(x)`,
		{
			'2@x': Bottom,
		});
	});

	test('mean after z-score scaling -> Bottom', async() => {
		await testScaleAnalysis(`
			x <- scale(x)
			x <- mean(x)`,
		{
			'2@x': Bottom,
		});
	});

	test('call to rescale package -> MinMax', async() => {
		await testScaleAnalysis(`
			x <- rescale::scales(x)`,
		{
			'1@x': MinMax,
		});
	});

	test('interprocedural tracking: passing a scaled value into a user-defined function and returning it keeps the taint', async() => {
		await testScaleAnalysis(`
				f <- function(v) { v }
				x <- scale(x)
				y <- f(x)`,
		{
			'2@x': ZScore,
			'3@y': ZScore,
		});
	});

	describe('Untracked Operations Mapped to Top', () => {
		test('arithmetic on a scaled value breaks the chain (untracked, not Top)', async() => {
			await testScaleAnalysis(`
				x <- scale(x)
				y <- x + 1`,
			{
				'1@x': ZScore,
				'2@y': undefined,
			});
		});

		test('indexing a scaled value breaks the chain (untracked, not Top)', async() => {
			await testScaleAnalysis(`
				x <- scale(df$col)
				y <- x[1]`,
			{
				'1@x': ZScore,
				'2@y': undefined,
			});
		});

		test('subassignment into a scaled value breaks the chain (untracked, not Top)', async() => {
			await testScaleAnalysis(`
				x <- scale(x)
				x[1] <- 0
				y <- x`,
			{
				'1@x': ZScore,
				'3@y': undefined,
			});
		});

		test('do.call does not forward the scale() mapping', async() => {
			await testScaleAnalysis(`
				x <- do.call(scale, list(x))`,
			{
				'1@x': Top,
			});
		});

		test('sapply over a scaled vector does not forward the mapping into its result', async() => {
			await testScaleAnalysis(`
				x <- scale(x)
				y <- sapply(x, abs)`,
			{
				'1@x': ZScore,
				'2@y': Top,
			});
		});
	});
});