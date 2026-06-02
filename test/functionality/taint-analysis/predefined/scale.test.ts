import { test, describe } from 'vitest';
import type { TaintAnalysisExpectation } from '../helper';
import { testPredefinedTaintAnalysis } from '../helper';
import { Unscaled, ZScore, ZeroCentered, UnitVariance } from '../../../../src/taint-analysis/predefined/scale-analysis';
import { Bottom } from '../../../../src/abstract-interpretation/domains/lattice';

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
			x <- c(1 , 2 , 3 , 4 , 5)
			x <- scale(x)`,
		{
			'1@x': Unscaled,
			'2@x': ZScore,
		});
	});

	test('center only (no scaling)', async() => {
		await testScaleAnalysis(`
			x <- c(1 , 2 , 3 , 4 , 5)
			x <- scale(x, scale = FALSE)`,
		{
			'1@x': Unscaled,
			'2@x': ZeroCentered,
		});
	});

	test('scale only (no centering)', async() => {
		await testScaleAnalysis(`
			x <- c(1 , 2 , 3 , 4 , 5)
			x <- scale(x, center = FALSE)`,
		{
			'1@x': Unscaled,
			'2@x': UnitVariance,
		});
	});

	test('no centering and no scaling (identity)', async() => {
		await testScaleAnalysis(`
			x <- c(1 , 2 , 3 , 4 , 5)
			x <- scale(x, center = FALSE, scale = FALSE)`,
		{
			'1@x': Unscaled,
			'2@x': Unscaled,
		});
	});

	test('mean after zero-centered scaling -> Bottom', async() => {
		await testScaleAnalysis(`
			x <- c(1 , 2 , 3 , 4 , 5)
			x <- scale(x, scale = FALSE)
			x <- mean(x)`,
		{
			'1@x': Unscaled,
			'2@x': ZeroCentered,
			'3@x': Bottom,
		});
	});

	test('mean after unit-variance scaling -> retains unit variance', async() => {
		await testScaleAnalysis(`
			x <- c(1 , 2 , 3 , 4 , 5)
			x <- scale(x, center = FALSE)
			x <- mean(x)`,
		{
			'1@x': Unscaled,
			'2@x': UnitVariance,
			'3@x': UnitVariance,
		});
	});

	test('mean after z-score scaling -> Bottom', async() => {
		await testScaleAnalysis(`
			x <- c(1 , 2 , 3 , 4 , 5)
			x <- scale(x)
			x <- mean(x)`,
		{
			'1@x': Unscaled,
			'2@x': ZScore,
			'3@x': Bottom,
		});
	});
});