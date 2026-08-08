import { describe, test } from 'vitest';
import type { TaintAnalysisExpectation } from '../helper';
import { testPredefinedTaintAnalysis } from '../helper';
import { Random, Deterministic } from '../../../../src/taint-analysis/predefined/randomness-analysis';
import { Top } from '../../../../src/abstract-interpretation/domains/lattice';

const testRandomnessAnalysis =
	(code: string, expectation: TaintAnalysisExpectation) => testPredefinedTaintAnalysis(code, 'randomness', expectation);

describe('Taint Analysis Randomness', () => {
	test('c() is Deterministic', async() => {
		await testRandomnessAnalysis('x <- c(1, 2, 3)', { '1@x': Deterministic });
	});

	test('runif is Random', async() => {
		await testRandomnessAnalysis('x <- runif(5)', { '1@x': Random });
	});

	test('sample is Random', async() => {
		await testRandomnessAnalysis('x <- sample(1:10, 2)', { '1@x': Random });
	});

	test('unrelated assignment is untracked', async() => {
		await testRandomnessAnalysis('x <- 42', { '1@x': undefined });
	});

	test('set.seed has no effect on the classification of a subsequent random call', async() => {
		await testRandomnessAnalysis(`
				set.seed(1)
				x <- runif(5)`,
		{ '2@x': Random });
	});

	test('randomness generated inside a closure passed to sapply does not propagate to the result', async() => {
		await testRandomnessAnalysis('y <- sapply(1:5, function(i) runif(1))', { '1@y': Top });
	});
});
