import { describe } from 'vitest';
import { DomainMatchingType, type IntervalSlicingCriterionExpected, IntervalTests } from '../interval/interval';
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

			describe.each(['+', '-', '*', '/', '^'])('%s infix semantics', (identifier) => {
				for(const [args, expected] of intervalToPentagonTestCases(binaryOperatorSuccessTestCases.concat(binaryInfixOperatorSpecialCases))) {
					const slicingCriterionExpected: PentagonSlicingCriterionExpected | undefined = expected.get(identifier);
					if(!isUndefined(slicingCriterionExpected)) {
						testPentagonDomain(`x <- ${args[0] ?? ''} ${Identifier.toString(identifier)} ${args[1] ?? ''}`, { '1@x': slicingCriterionExpected });
					}
				}
			});

			describe.each(['+', '-', '*', '/', '^'])('%s function semantics', (identifier) => {
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
		describe('while semantics', () => {
			testPentagonDomain(`
				x <- ifelse(c, 1, 3) + 0
				while (x < 10) {
					x <- x + 1
					x <- x - 1
				}
				print(x)
			`, {
				'1@x': { interval: IntervalTests.interval(1, 3), upperBounds: UpperBoundsTests.top() },
				'2@x': { interval: IntervalTests.interval(1, 3), upperBounds: UpperBoundsTests.top() },
				'3@x': { interval: IntervalTests.interval(2, 4), upperBounds: UpperBoundsTests.bounds([], ['1@x', '4@x']), lowerBounds: UpperBoundsTests.bounds(['4@x']) },
				'4@x': { interval: IntervalTests.interval(1, 3), upperBounds: UpperBoundsTests.bounds(['3@x']) },
				'6@x': { interval: IntervalTests.bottom(), upperBounds: UpperBoundsTests.bottom() }
			});

			testPentagonDomain(`
				x <- 0
				a <- 7
				while (x == 0) {
					if (a <= 2) {
						x <- 12
					}
					a <- a - 1
				}
				cat(x, a)
			`, {
				'1@x': { interval: IntervalTests.scalar(0), upperBounds: UpperBoundsTests.top() },
				'2@a': { interval: IntervalTests.scalar(7), upperBounds: UpperBoundsTests.top() },
				'3@x': { interval: IntervalTests.interval(0, 12), intervalMatching: DomainMatchingType.Overapproximation, upperBounds: UpperBoundsTests.top() },
				'4@a': { interval: IntervalTests.interval(2, 7), intervalMatching: DomainMatchingType.Overapproximation, upperBounds: UpperBoundsTests.top() },
				'5@x': { interval: IntervalTests.scalar(12), upperBounds: UpperBoundsTests.top() },
				'7@a': { interval: IntervalTests.interval(1, 6), intervalMatching: DomainMatchingType.Overapproximation, upperBounds: UpperBoundsTests.top() },
				'9@x': { interval: IntervalTests.scalar(12), intervalMatching: DomainMatchingType.Overapproximation, upperBounds: UpperBoundsTests.top() },
				'9@a': { interval: IntervalTests.scalar(1), intervalMatching: DomainMatchingType.Overapproximation, upperBounds: UpperBoundsTests.top() },
			});
		});

		describe('if else semantis', () => {
			testPentagonDomain(`
				a <- ifelse(c, -3, 3)
				a <- a + 0
				b <- ifelse(c, b 1, 4)
				b <- b + 0
				
				x <- a + b
				x <- b + a
				x <- a - b
				x <- b - a
				x <- -b
				x <- -a
			`, {
				'2@a':  { interval: IntervalTests.interval(-3, 3), upperBounds: UpperBoundsTests.top() },
				'4@b':  { interval: IntervalTests.interval(1, 4), upperBounds: UpperBoundsTests.bounds([], ['2@a']), lowerBounds: UpperBoundsTests.bounds([], ['2@a']) },
				'6@x':  { interval: IntervalTests.interval(-2, 7), upperBounds: UpperBoundsTests.bounds([], ['6@a', '6@b']), lowerBounds: UpperBoundsTests.bounds(['6@a'], ['6@b']) },
				'7@x':  { interval: IntervalTests.interval(-2, 7), upperBounds: UpperBoundsTests.bounds([], ['7@a', '7@b']), lowerBounds: UpperBoundsTests.bounds(['7@a'], ['7@b']) },
				'8@x':  { interval: IntervalTests.interval(-7, 2), upperBounds: UpperBoundsTests.bounds(['8@a'], ['8@b']), lowerBounds: UpperBoundsTests.bounds([], ['8@a', '8@b']) },
				'9@x':  { interval: IntervalTests.interval(-2, 7), upperBounds: UpperBoundsTests.bounds([], ['9@a', '9@b']), lowerBounds: UpperBoundsTests.bounds([], ['9@a', '9@b']) },
				'10@x': { interval: IntervalTests.interval(-4, -1), upperBounds: UpperBoundsTests.bounds(['10@b']), lowerBounds: UpperBoundsTests.bounds([], ['10@b']) },
				'11@x': { interval: IntervalTests.interval(-3, 3), upperBounds: UpperBoundsTests.bounds([], ['11@a']), lowerBounds: UpperBoundsTests.bounds([], ['11@a']) }
			});

			testPentagonDomain(`
				a <- ifelse(c, -3, 3)
				a <- a + 0
				b <- ifelse(c, -1, -4)
				b <- b + 0
				
				x <- a + b
				x <- b + a
				x <- a - b
				x <- b - a
				x <- -b
				x <- -a
			`, {
				'2@a':  { interval: IntervalTests.interval(-3, 3), upperBounds: UpperBoundsTests.top() },
				'4@b':  { interval: IntervalTests.interval(-4, -1), upperBounds: UpperBoundsTests.bounds([], ['2@a']), lowerBounds: UpperBoundsTests.bounds([], ['2@a']) },
				'6@x':  { interval: IntervalTests.interval(-7, 2), upperBounds: UpperBoundsTests.bounds(['6@a'], ['6@b']), lowerBounds: UpperBoundsTests.bounds([], ['6@a', '6@b']) },
				'7@x':  { interval: IntervalTests.interval(-7, 2), upperBounds: UpperBoundsTests.bounds(['7@a'], ['7@b']), lowerBounds: UpperBoundsTests.bounds([], ['7@a', '7@b']) },
				'8@x':  { interval: IntervalTests.interval(-2, 7), upperBounds: UpperBoundsTests.bounds([], ['8@a', '8@b']), lowerBounds: UpperBoundsTests.bounds(['8@a'], ['8@b']) },
				'9@x':  { interval: IntervalTests.interval(-7, 2), upperBounds: UpperBoundsTests.bounds([], ['9@a', '9@b']), lowerBounds: UpperBoundsTests.bounds([], ['9@a', '9@b']) },
				'10@x': { interval: IntervalTests.interval(1, 4), upperBounds: UpperBoundsTests.bounds([], ['10@b']), lowerBounds: UpperBoundsTests.bounds(['10@b']) },
				'11@x': { interval: IntervalTests.interval(-3, 3), upperBounds: UpperBoundsTests.bounds([], ['11@a']), lowerBounds: UpperBoundsTests.bounds([], ['11@a']) }
			});

			// == and !=
			testPentagonDomain(`
				a <- ifelse(c, -3, 3)
				a <- a + 0
				b <- ifelse(c, -3, 3)
				b <- b + 0
				
				if(a == b) {
					print("This is possible", a, b)
				} else {
					print("This is also possible", a, b)
				}
			`, {
				'2@a': { interval: IntervalTests.interval(-3, 3), upperBounds: UpperBoundsTests.top() },
				'4@b': { interval: IntervalTests.interval(-3, 3), upperBounds: UpperBoundsTests.bounds([], ['2@a']), lowerBounds: UpperBoundsTests.bounds([], ['2@a']) },
				'7@a': { interval: IntervalTests.interval(-3, 3), upperBounds: UpperBoundsTests.bounds(['7@b']) },
				'7@b': { interval: IntervalTests.interval(-3, 3), upperBounds: UpperBoundsTests.bounds(['7@a']) },
				'9@a': { interval: IntervalTests.interval(-3, 3), upperBounds: UpperBoundsTests.bounds([], ['9@b']) },
				'9@b': { interval: IntervalTests.interval(-3, 3), upperBounds: UpperBoundsTests.bounds([], ['9@a']) }
			});

			testPentagonDomain(`
				a <- ifelse(c, -3, 3)
				a <- a + 0
				b <- a
				
				if(a == b) {
					print("This is possible", a, b)
				} else {
					print("This is NOT possible", a, b)
				}
				a
				b
			`, {
				'2@a':  { interval: IntervalTests.interval(-3, 3), upperBounds: UpperBoundsTests.top() },
				'3@b':  { interval: IntervalTests.interval(-3, 3), upperBounds: UpperBoundsTests.bounds(['3@a']), lowerBounds: UpperBoundsTests.bounds(['3@a']) },
				'6@a':  { interval: IntervalTests.interval(-3, 3), upperBounds: UpperBoundsTests.bounds(['6@b']) },
				'6@b':  { interval: IntervalTests.interval(-3, 3), upperBounds: UpperBoundsTests.bounds(['6@a']) },
				'8@a':  { interval: IntervalTests.bottom(), upperBounds: UpperBoundsTests.bottom() },
				'8@b':  { interval: IntervalTests.bottom(), upperBounds: UpperBoundsTests.bottom() },
				'10@a': { interval: IntervalTests.interval(-3, 3), upperBounds: UpperBoundsTests.bounds(['3@b']) },
				'11@b': { interval: IntervalTests.interval(-3, 3), upperBounds: UpperBoundsTests.bounds(['10@a']) },
			});

			// <=, >, >=, <
			testPentagonDomain(`
				a <- ifelse(c, -3, 3)
				a <- a + 0
				b <- ifelse(c, -3, 3)
				b <- b + 0
				
				if(a <= b) {
					z <- b - a
				} else {
					z <- a - b
				}
				z
			`, {
				'2@a':  { interval: IntervalTests.interval(-3, 3), upperBounds: UpperBoundsTests.top() },
				'4@b':  { interval: IntervalTests.interval(-3, 3), upperBounds: UpperBoundsTests.bounds([], ['2@a']), lowerBounds: UpperBoundsTests.bounds([], ['2@a']) },
				'7@a':  { interval: IntervalTests.interval(-3, 3), upperBounds: UpperBoundsTests.bounds(['7@b']) },
				'7@z':  { interval: IntervalTests.interval(0, 6), upperBounds: UpperBoundsTests.bounds([], ['7@a', '7@b']), lowerBounds: UpperBoundsTests.bounds([], ['7@a', '7@b']) },
				'9@a':  { interval: IntervalTests.interval(-3, 3), upperBounds: UpperBoundsTests.bounds([], ['9@b']), lowerBounds: UpperBoundsTests.bounds(['9@b']) },
				'9@z':  { interval: IntervalTests.interval(0, 6), upperBounds: UpperBoundsTests.bounds([], ['9@a', '9@b']), lowerBounds: UpperBoundsTests.bounds([], ['9@a', '9@b']) },
				'11@z': { interval: IntervalTests.interval(0, 6), upperBounds: UpperBoundsTests.bounds([], ['7@a', '7@b', '9@a', '9@b']) }
			});
		});

		describe('for semantics', () => {
			testPentagonDomain(`
				for (i in seq(1, length(lbs))) {
					if (lbs[i] == "wind_field_cp") {
					  # dark blue
					  col_h <- 250
					  col_c <- 45
					  col_l <- 40
					} else if (lbs[i] == "wind_field") {
					  # middle blue
					  col_h <- 250
					  col_c <- 45
					  col_l <- 60
					} else if (lbs[i] == "wind_field_noMF") {
					  # light blue
					  col_h <- 250
					  col_c <- 45
					  col_l <- 80
					} else if (lbs[i] == "mass_field") {
					  # light red
					  col_h <- 10
					  col_c <- 45
					  col_l <- 70
					} else if (lbs[i] == "mass_field_sx") {
					  # darkred
					  col_h <- 10
					  col_c <- 45
					  col_l <- 40
					} else {
					  stop("  * Error: Cluster name does not exist \\n")
					}
				}
			`, {
				'4@col_h':  { interval: IntervalTests.scalar(250), upperBounds: UpperBoundsTests.top() },
				'5@col_c':  { interval: IntervalTests.scalar(45), upperBounds: UpperBoundsTests.top() },
				'6@col_l':  { interval: IntervalTests.scalar(40), upperBounds: UpperBoundsTests.top() },
				'9@col_h':  { interval: IntervalTests.scalar(250), upperBounds: UpperBoundsTests.top() },
				'10@col_c': { interval: IntervalTests.scalar(45), upperBounds: UpperBoundsTests.top() },
				'11@col_l': { interval: IntervalTests.scalar(60), upperBounds: UpperBoundsTests.top() },
				'14@col_h': { interval: IntervalTests.scalar(250), upperBounds: UpperBoundsTests.top() },
				'15@col_c': { interval: IntervalTests.scalar(45), upperBounds: UpperBoundsTests.top() },
				'16@col_l': { interval: IntervalTests.scalar(80), upperBounds: UpperBoundsTests.top() },
				'19@col_h': { interval: IntervalTests.scalar(10), upperBounds: UpperBoundsTests.top() },
				'20@col_c': { interval: IntervalTests.scalar(45), upperBounds: UpperBoundsTests.top() },
				'21@col_l': { interval: IntervalTests.scalar(70), upperBounds: UpperBoundsTests.top() },
				'24@col_h': { interval: IntervalTests.scalar(10), upperBounds: UpperBoundsTests.top() },
				'25@col_c': { interval: IntervalTests.scalar(45), upperBounds: UpperBoundsTests.top() },
				'26@col_l': { interval: IntervalTests.scalar(40), upperBounds: UpperBoundsTests.top() },
			});
		});
	});
});
