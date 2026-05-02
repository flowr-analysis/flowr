import { describe } from 'vitest';
import { type IntervalSlicingCriterionExpected, IntervalTests } from '../interval/interval';
import type { PentagonSlicingCriterionExpected } from './pentagon';
import { testPentagonDomain, UpperBoundsTests } from './pentagon';
import { Identifier } from '../../../../src/dataflow/environments/identifier';
import type { IntervalInferenceOperatorTestCase } from '../interval/inference.test';
import {
	binaryInfixOperatorSpecialCases,
	binaryOperatorSpecialCases,
	binaryOperatorSuccessTestCases,
	constantNonNumericTestCases,
	constantNumericTestCases,
	lengthTestCases
} from '../interval/inference.test';
import { isUndefined } from '../../../../src/util/assert';

type PentagonIntervalInferenceOperatorTestCase = readonly [arguments: string[], expected: Map<Identifier, PentagonSlicingCriterionExpected>][];

const singleValueIntervalToPentagonTestCase = (intervalTestCases: readonly [value: string, expected: IntervalSlicingCriterionExpected][]): [value: string, expected: PentagonSlicingCriterionExpected][] => {
	return intervalTestCases.map(([value, expected]): [value: string, expected: PentagonSlicingCriterionExpected] => {
		return [value, { interval: expected.domain, intervalMatching: expected.matching, upperBounds: UpperBoundsTests.top() }];
	});
};

const intervalToPentagonTestCases = (intervalTestCases: IntervalInferenceOperatorTestCase): PentagonIntervalInferenceOperatorTestCase => {
	return intervalTestCases.map(([args, expected]) => {
		return [args, new Map(expected.entries().map(([id, criterion]): [Identifier, PentagonSlicingCriterionExpected] => [id, { interval: criterion.domain, intervalMatching: criterion.matching, upperBounds: UpperBoundsTests.top() }]))];
	});
};

describe('Pentagon Inference', () => {
	describe('expression semantics', () => {
		describe('interval value part', () => {
			describe('constant numeric values', () => {
				for(const [value, expected] of singleValueIntervalToPentagonTestCase(constantNumericTestCases)) {
					testPentagonDomain(`x <- ${value}`, { '1@x': expected });
				}
			});

			describe('non-numeric constant values', () => {
				for(const [value, expected] of singleValueIntervalToPentagonTestCase(constantNonNumericTestCases)) {
					testPentagonDomain(`x <- ${value}`, { '1@x': expected });
				}
			});

			describe.each(['+', '-', '*'])('%s infix semantics', (identifier) => {
				for(const [args, expected] of intervalToPentagonTestCases(binaryOperatorSuccessTestCases.concat(binaryInfixOperatorSpecialCases))) {
					const slicingCriterionExpected: PentagonSlicingCriterionExpected | undefined = expected.get(identifier);
					if(!isUndefined(slicingCriterionExpected)) {
						testPentagonDomain(`x <- ${args[0] ?? ''} ${Identifier.toString(identifier)} ${args[1] ?? ''}`, { '1@x': slicingCriterionExpected });
					}
				}
			});

			describe.each(['+', '-', '*'])('%s function semantics', (identifier) => {
				for(const [args, expected] of intervalToPentagonTestCases(binaryOperatorSuccessTestCases.concat(binaryOperatorSpecialCases))) {
					const slicingCriterionExpected: PentagonSlicingCriterionExpected | undefined = expected.get(identifier);
					if(!isUndefined(slicingCriterionExpected)) {
						testPentagonDomain(`x <- \`${Identifier.toString(identifier)}\`(${args.join(', ')})`, { '1@x': slicingCriterionExpected });
					}
				}
			});

			describe('length semantics', () => {
				for(const [value, expected] of singleValueIntervalToPentagonTestCase(lengthTestCases)) {
					testPentagonDomain(`x <- length(${value})`, { '1@x': expected });
				}
			});

			describe('basic combined calculation', () => {
				testPentagonDomain('x <- 3 + 5 * 7 - 3', { '1@x': { interval: IntervalTests.scalar(3+5*7-3), upperBounds: UpperBoundsTests.top() } });
				testPentagonDomain('x <- (3 + 2) * (7 - 2 * 2)', { '1@x': { interval: IntervalTests.scalar((3+2)*(7-2*2)), upperBounds: UpperBoundsTests.top() } });
			});
		});

		describe('combined pentagon part', () => {
			describe('basic combined calculation', () => {
				testPentagonDomain(`
					x <- 3
					y <- -4
					z <- 2.4
					result <- x * 3 - y * z
					zero <- 5 * 0
					invalid <- Inf * zero
				`, {
					'1@x':       { interval: IntervalTests.scalar(3), upperBounds: UpperBoundsTests.top() },
					'2@y':       { interval: IntervalTests.scalar(-4), upperBounds: UpperBoundsTests.bounds(['1@x']) },
					'3@z':       { interval: IntervalTests.scalar(2.4), upperBounds: UpperBoundsTests.bounds(['1@x']), lowerBounds: UpperBoundsTests.bounds(['2@y']) },
					'4@result':  { interval: IntervalTests.scalar(3*3-(-4)*2.4), upperBounds: UpperBoundsTests.top(), lowerBounds: UpperBoundsTests.bounds(['1@x']) },
					'5@zero':    { interval: IntervalTests.scalar(0), upperBounds: UpperBoundsTests.bounds(['1@x', '3@z']), lowerBounds: UpperBoundsTests.bounds(['2@y']) },
					'6@invalid': { interval: IntervalTests.top(), upperBounds: UpperBoundsTests.top() }
				});

				testPentagonDomain(`
					x <- -Inf
					y <- 4
					z <- x + y
				`, {
					'1@x': { interval: IntervalTests.scalar(-Infinity), upperBounds: UpperBoundsTests.top() },
					'2@y': { interval: IntervalTests.scalar(4), upperBounds: UpperBoundsTests.top(), lowerBounds: UpperBoundsTests.bounds(['1@x']) },
					'3@z': { interval: IntervalTests.scalar(-Infinity), upperBounds: UpperBoundsTests.bounds(['3@y']), lowerBounds: UpperBoundsTests.bounds(['3@x']) },
				});
			});
		});

		// We cannot process interprocedural calls yet
		describe('user defined function calls ARE NOT ABLE to return numeric values', { fails: true }, () => {
			// Once we support interprocedural analysis, remove the filter to also test the cases, where Top should be inferred.
			for(const [value, expected] of singleValueIntervalToPentagonTestCase(constantNumericTestCases.concat(constantNonNumericTestCases).filter(([_, expected]) => expected.domain !== IntervalTests.top()))) {
				testPentagonDomain(`
					f <- function() ${value}
					x <- f()
				`, { '2@x': expected });
			}
		});
	});

	describe('condition semantics', () => {
		describe('if else semantis', () => {
			testPentagonDomain(`
				ifelse(c, a <- -3, a <- 3)
				a <- a + 0
				ifelse(c, b <- 1, b <- 4)
				b <- b + 0
				
				x <- a + b
				x <- b + a
				x <- a - b
				x <- b - a
			`, {
				'2@a': { interval: IntervalTests.interval(-3, 3), upperBounds: UpperBoundsTests.top() },
				'4@b': { interval: IntervalTests.interval(1, 4), upperBounds: UpperBoundsTests.bounds([], ['2@a']), lowerBounds: UpperBoundsTests.bounds([], ['2@a']) },
				// '6@x': { interval: IntervalTests.interval(-2, 7), upperBounds: UpperBoundsTests.bounds([], ['6@a', '6@b']), lowerBounds: UpperBoundsTests.bounds(['6@a'], ['6@b']) },
				// '7@x': { interval: IntervalTests.interval(-2, 7), upperBounds: UpperBoundsTests.bounds([], ['7@a', '7@b']), lowerBounds: UpperBoundsTests.bounds(['7@a'], ['7@b']) },
				'8@x': { interval: IntervalTests.interval(-7, 2), upperBounds: UpperBoundsTests.bounds(['8@a'], ['8@b']), lowerBounds: UpperBoundsTests.bounds([], ['8@a', '8@b']) },
				'9@x': { interval: IntervalTests.interval(-2, 7), upperBounds: UpperBoundsTests.bounds([], ['9@a', '9@b']), lowerBounds: UpperBoundsTests.bounds([], ['9@a', '9@b']) }
			});

			testPentagonDomain(`
				ifelse(c, a <- -3, a <- 3)
				a <- a + 0
				ifelse(c, b <- -1, b <- -4)
				b <- b + 0
				
				x <- a + b
				x <- b + a
				x <- a - b
				x <- b - a
			`, {
				'2@a': { interval: IntervalTests.interval(-3, 3), upperBounds: UpperBoundsTests.top() },
				'4@b': { interval: IntervalTests.interval(-4, -1), upperBounds: UpperBoundsTests.bounds([], ['2@a']), lowerBounds: UpperBoundsTests.bounds([], ['2@a']) },
				// '6@x': { interval: IntervalTests.interval(-7, 2), upperBounds: UpperBoundsTests.bounds(['6@a'], ['6@b']), lowerBounds: UpperBoundsTests.bounds([], ['6@a', '6@b']) },
				// '7@x': { interval: IntervalTests.interval(-7, 2), upperBounds: UpperBoundsTests.bounds(['7@a'], ['7@b']), lowerBounds: UpperBoundsTests.bounds([], ['7@a', '7@b']) },
				'8@x': { interval: IntervalTests.interval(-2, 7), upperBounds: UpperBoundsTests.bounds([], ['8@a', '8@b']), lowerBounds: UpperBoundsTests.bounds(['8@a'], ['8@b']) },
				'9@x': { interval: IntervalTests.interval(-7, 2), upperBounds: UpperBoundsTests.bounds([], ['9@a', '9@b']), lowerBounds: UpperBoundsTests.bounds([], ['9@a', '9@b']) }
			});
		});
	});
});
