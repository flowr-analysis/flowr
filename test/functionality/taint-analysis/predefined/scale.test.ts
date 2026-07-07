import { test, describe } from 'vitest';
import type { TaintAnalysisExpectation } from '../helper';
import { testPredefinedTaintAnalysis } from '../helper';
import { ZScore, ZeroCentered } from '../../../../src/taint-analysis/predefined/scale-analysis';
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
});