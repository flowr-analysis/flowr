import { test, describe } from 'vitest';
import type { TaintAnalysisExpectation } from '../helper';
import { testPredefinedTaintAnalysis } from '../helper';
import { Unscaled, ZScore } from '../../../../src/taint-analysis/predefined/scale-analysis';
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

	test('tainting of scaled value', async() => {
		await testScaleAnalysis(`
			x <- c(1 , 2 , 3 , 4 , 5)
			x <- scale(x)`,
		{
			'1@x': Unscaled,
			'2@x': ZScore,
		});
	});

	test('finding', async() => {
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