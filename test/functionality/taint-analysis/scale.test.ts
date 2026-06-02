import { describe } from 'vitest';
import { Scaled, Unscaled } from '../../../src/taint-analysis/predefined/scale-analysis';
import type { TaintAnalysisExpectation } from './helper';
import { testSingularTaintAnalysis } from './helper';
import { Bottom } from '../../../src/abstract-interpretation/domains/lattice';

const testScaleAnalysis =
	(code: string, expectation: TaintAnalysisExpectation) => testSingularTaintAnalysis(code, 'scale', expectation);

describe('Taint Analysis Scale', async() => {
	await testScaleAnalysis(`
			x <- 42`,
	{
		'1@x': undefined,
	});

	await testScaleAnalysis(`
			x <- c(1 , 2 , 3 , 4 , 5)
			x <- scale(x)`,
	{
		'1@x': Unscaled,
		'2@x': Scaled,
	});

	await testScaleAnalysis(`
			x <- c(1 , 2 , 3 , 4 , 5)
			x <- scale(x)
			x <- mean(x)`,
	{
		'1@x': Unscaled,
		'2@x': Scaled,
		'3@x': Bottom,
	});
});