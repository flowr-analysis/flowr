import { describe, test } from 'vitest';
import { testCompositeTaintAnalysis } from '../helper';
import { determinism } from '../../../../src/taint-analysis/predefined/determinism';
import { UserInput, NetworkInput } from '../../../../src/taint-analysis/predefined/security-analysis';
import { Random, Deterministic } from '../../../../src/taint-analysis/predefined/randomness-analysis';
import { Top } from '../../../../src/abstract-interpretation/domains/lattice';

describe('Composite Taint Analysis: Security + Randomness', () => {
	test('user input is tracked as UserInput in security, Top in randomness', async() => {
		await testCompositeTaintAnalysis(`
			x <- readline("Enter value: ")`,
		determinism,
		{
			'1@x': { security: UserInput, randomness: Top },
		});
	});

	test('random function is tracked as Top in security, Random in randomness', async() => {
		await testCompositeTaintAnalysis(`
			x <- runif(5)`,
		determinism,
		{
			'1@x': { security: Top, randomness: Random },
		});
	});

	test('network input is tracked as NetworkInput in security, Top in randomness', async() => {
		await testCompositeTaintAnalysis(`
			x <- read.csv('http://example.com/data.csv')`,
		determinism,
		{
			'1@x': { security: NetworkInput, randomness: Top },
		});
	});

	test('deterministic values tracked as Top in security, Deterministic in randomness', async() => {
		await testCompositeTaintAnalysis(`
			x <- c(1, 2, 3)`,
		determinism,
		{
			'1@x': { security: Top, randomness: Deterministic },
		});
	});

	test('combines both taints: user input tracked in security, sample tracked in randomness', async() => {
		await testCompositeTaintAnalysis(`
			x <- readline("Enter n: ")
			y <- sample(1:10, x)`,
		determinism,
		{
			'1@x': { security: UserInput, randomness: Top },
			'2@y': { security: Top, randomness: Random },
		});
	});

	test('independent assignments track separate security and randomness taints', async() => {
		await testCompositeTaintAnalysis(`
			x <- readline("Enter value: ")
			y <- runif(5)`,
		determinism,
		{
			'1@x': { security: UserInput, randomness: Top },
			'2@y': { security: Top, randomness: Random },
		});
	});
});
