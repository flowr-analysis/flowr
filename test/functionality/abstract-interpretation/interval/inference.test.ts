import { describe } from 'vitest';
import type { SlicingCriterionExpected } from './interval';
import { DomainMatchingType, IntervalTests, testIntervalDomain } from './interval';
import { Identifier } from '../../../../src/dataflow/environments/identifier';
import { isUndefined } from '../../../../src/util/assert';

type IntervalInferenceOperatorTestCase = readonly [arguments: string[], expected: Map<Identifier, SlicingCriterionExpected>][];

describe('Interval Inference', () => {
	describe('expression semantics', () => {
		const constantNumericTestCases: readonly [value: string, expected: SlicingCriterionExpected][] = [
			['0', { domain: IntervalTests.scalar(0) }],
			['5', { domain: IntervalTests.scalar(5) }],
			['2L', { domain: IntervalTests.scalar(2) }],
			['Inf', { domain: IntervalTests.scalar(Infinity) }],
			['-Inf', { domain: IntervalTests.scalar(-Infinity) }],
			['1e10', { domain: IntervalTests.scalar(1e10) }],
			['-1e-5', { domain: IntervalTests.scalar(-1e-5) }],
			['-5', { domain: IntervalTests.scalar(-5) }],
			['-10L', { domain: IntervalTests.scalar(-10) }],
			['3.14', { domain: IntervalTests.scalar(3.14) }],
			['-12.54', { domain: IntervalTests.scalar(-12.54) }],
			['2i', { domain: IntervalTests.top() }],
			['NaN', { domain: IntervalTests.top() }],
		] as const;

		const constantNonNumericTestCases: readonly [value: string, expected: SlicingCriterionExpected][] = [
			['"Hallo"', { domain: IntervalTests.top() }],
			['TRUE', { domain: IntervalTests.top() }],
			['FALSE', { domain: IntervalTests.top() }],
			['NULL', { domain: IntervalTests.top() }],
			['"3"', { domain: IntervalTests.top() }],
			['c(1, 2, 3)', { domain: IntervalTests.top() }],
		] as const;

		const binaryOperatorSpecialCases: IntervalInferenceOperatorTestCase = [
			[[''], new Map([
				['+', { domain: IntervalTests.bottom() }],
				['-', { domain: IntervalTests.bottom() }],
				['*', { domain: IntervalTests.bottom() }]
			])],
			[['3'], new Map([
				['+', { domain: IntervalTests.scalar(3) }],
				['-', { domain: IntervalTests.scalar(-3) }],
				['*', { domain: IntervalTests.bottom() }],
			])],
			[['3', ''], new Map([
				['+', { domain: IntervalTests.bottom() }],
				['-', { domain: IntervalTests.bottom() }],
				['*', { domain: IntervalTests.bottom() }]
			])],
			[['', '7'], new Map([
				['+', { domain: IntervalTests.bottom() }],
				['-', { domain: IntervalTests.bottom() }],
				['*', { domain: IntervalTests.bottom() }]
			])],
			[['', ''], new Map([
				['+', { domain: IntervalTests.bottom() }],
				['-', { domain: IntervalTests.bottom() }],
				['*', { domain: IntervalTests.bottom() }]
			])],
			[['3', '4', ''], new Map([
				['+', { domain: IntervalTests.bottom() }],
				['-', { domain: IntervalTests.bottom() }],
				['*', { domain: IntervalTests.bottom() }]
			])]
		] as const;

		const binaryInfixOperatorSpecialCases: IntervalInferenceOperatorTestCase = [
			[['', '7'], new Map([
				['+', { domain: IntervalTests.scalar(7) }],
				['-', { domain: IntervalTests.scalar(-7) }]
			])]
		] as const;

		const binaryOperatorSuccessTestCases: IntervalInferenceOperatorTestCase = [
			[['0', '0'], new Map([
				['+', { domain: IntervalTests.scalar(0) }],
				['-', { domain: IntervalTests.scalar(0) }],
				['*', { domain: IntervalTests.scalar(0) }]
			])],
			[['2.5', '0'], new Map([
				['+', { domain: IntervalTests.scalar(2.5) }],
				['-', { domain: IntervalTests.scalar(2.5) }],
				['*', { domain: IntervalTests.scalar(0) }]
			])],
			[['0', '-5'], new Map([
				['+', { domain: IntervalTests.scalar(-5) }],
				['-', { domain: IntervalTests.scalar(5) }],
				['*', { domain: IntervalTests.scalar(0) }]
			])],
			[['2', '5'], new Map([
				['+', { domain: IntervalTests.scalar(2+5) }],
				['-', { domain: IntervalTests.scalar(2-5) }],
				['*', { domain: IntervalTests.scalar(2*5) }]
			])],
			[['384', '92'], new Map([
				['+', { domain: IntervalTests.scalar(384+92) }],
				['-', { domain: IntervalTests.scalar(384-92) }],
				['*', { domain: IntervalTests.scalar(384*92) }]
			])],
			[['-5', '18'], new Map([
				['+', { domain: IntervalTests.scalar((-5)+18) }],
				['-', { domain: IntervalTests.scalar((-5)-18) }],
				['*', { domain: IntervalTests.scalar((-5)*18) }]
			])],
			[['-15', '-2'], new Map([
				['+', { domain: IntervalTests.scalar((-15)+(-2)) }],
				['-', { domain: IntervalTests.scalar((-15)-(-2)) }],
				['*', { domain: IntervalTests.scalar((-15)*(-2)) }]
			])],
			[['2.7', '1.3'], new Map([
				['+', { domain: IntervalTests.scalar(2.7+1.3) }],
				['-', { domain: IntervalTests.scalar(2.7-1.3) }],
				['*', { domain: IntervalTests.scalar(2.7*1.3) }]
			])],
			[['2', '1.3'], new Map([
				['+', { domain: IntervalTests.scalar(2+1.3) }],
				['-', { domain: IntervalTests.scalar(2-1.3) }],
				['*', { domain: IntervalTests.scalar(2*1.3) }]
			])],
			[['5', '-3'], new Map([
				['+', { domain: IntervalTests.scalar(5+(-3)) }],
				['-', { domain: IntervalTests.scalar(5-(-3)) }],
				['*', { domain: IntervalTests.scalar(5*(-3)) }]
			])],
			[['-2', '4'], new Map([
				['+', { domain: IntervalTests.scalar((-2)+4) }],
				['-', { domain: IntervalTests.scalar((-2)-4) }],
				['*', { domain: IntervalTests.scalar((-2)*4) }]
			])],
			[['-3', '-6'], new Map([
				['+', { domain: IntervalTests.scalar((-3)+(-6)) }],
				['-', { domain: IntervalTests.scalar((-3)-(-6)) }],
				['*', { domain: IntervalTests.scalar((-3)*(-6)) }]
			])],
			[['1e10', '1e-5'], new Map([
				['+', { domain: IntervalTests.scalar(1e10+1e-5) }],
				['-', { domain: IntervalTests.scalar(1e10-1e-5) }],
				['*', { domain: IntervalTests.scalar(1e10*1e-5) }]
			])],
			[['Inf', '0'], new Map([
				['+', { domain: IntervalTests.scalar(Infinity) }],
				['-', { domain: IntervalTests.scalar(Infinity) }],
				['*', { domain: IntervalTests.top() }]
			])],
			[['Inf', '5'], new Map([
				['+', { domain: IntervalTests.scalar(Infinity + 5) }],
				['-', { domain: IntervalTests.scalar(Infinity - 5) }],
				['*', { domain: IntervalTests.scalar(Infinity * 5) }]
			])],
			[['Inf', '-3'], new Map([
				['+', { domain: IntervalTests.scalar(Infinity+(-3)) }],
				['-', { domain: IntervalTests.scalar(Infinity-(-3)) }],
				['*', { domain: IntervalTests.scalar(Infinity*(-3)) }]
			])],
			[['87', 'Inf'], new Map([
				['+', { domain: IntervalTests.scalar(87+Infinity) }],
				['-', { domain: IntervalTests.scalar(87-Infinity) }],
				['*', { domain: IntervalTests.scalar(87*Infinity) }]
			])],
			[['Inf', 'Inf'], new Map([
				['+', { domain: IntervalTests.scalar(Infinity+Infinity) }],
				['-', { domain: IntervalTests.top() }],
				['*', { domain: IntervalTests.scalar(Infinity*Infinity) }]
			])],
			[['(-Inf)', 'Inf'], new Map([
				['+', { domain: IntervalTests.top() }],
				['-', { domain: IntervalTests.scalar((-Infinity)-Infinity) }],
				['*', { domain: IntervalTests.scalar((-Infinity)*Infinity) }]
			])],
			[['(-Inf)', '(-Inf)'], new Map([
				['+', { domain: IntervalTests.scalar((-Infinity)+(-Infinity)) }],
				['-', { domain: IntervalTests.top() }],
				['*', { domain: IntervalTests.scalar((-Infinity)*(-Infinity)) }]
			])],
			[['NaN', '3'], new Map([
				['+', { domain: IntervalTests.top() }],
				['-', { domain: IntervalTests.top() }],
				['*', { domain: IntervalTests.top() }]
			])],
			[['3', '"Hallo"'], new Map([
				['+', { domain: IntervalTests.top() }],
				['-', { domain: IntervalTests.top() }],
				['*', { domain: IntervalTests.top() }]
			])],
			[['`+`()', '7'], new Map([
				['+', { domain: IntervalTests.bottom() }],
				['-', { domain: IntervalTests.bottom() }],
				['*', { domain: IntervalTests.bottom() }]
			])],
			[['7', '`+`()'], new Map([
				['+', { domain: IntervalTests.bottom() }],
				['-', { domain: IntervalTests.bottom() }],
				['*', { domain: IntervalTests.bottom() }]
			])]
		] as const;

		describe('constant numeric values', () => {
			for(const [value, expected] of constantNumericTestCases) {
				testIntervalDomain(`x <- ${value}`, { '1@x': expected });
			}
		});

		describe('non-numeric constant values', () => {
			for(const [value, expected] of constantNonNumericTestCases) {
				testIntervalDomain(`x <- ${value}`, { '1@x': expected });
			}
		});

		describe.each(['+', '-', '*'])('%s infix semantics', (identifier) => {
			for(const [args, expected] of binaryOperatorSuccessTestCases.concat(binaryInfixOperatorSpecialCases)) {
				const slicingCriterionExpected: SlicingCriterionExpected | undefined = expected.get(identifier);
				if(!isUndefined(slicingCriterionExpected)) {
					testIntervalDomain(`x <- ${args[0] ?? ''} ${Identifier.toString(identifier)} ${args[1] ?? ''}`, { '1@x': slicingCriterionExpected });
				}
			}
		});

		describe.each(['+', '-', '*'])('%s function semantics', (identifier) => {
			for(const [args, expected] of binaryOperatorSuccessTestCases.concat(binaryOperatorSpecialCases)) {
				const slicingCriterionExpected: SlicingCriterionExpected | undefined = expected.get(identifier);
				if(!isUndefined(slicingCriterionExpected)) {
					testIntervalDomain(`x <- \`${Identifier.toString(identifier)}\`(${args.join(', ')})`, { '1@x': slicingCriterionExpected });
				}
			}
		});

		describe('length semantics', () => {
			const testCases: [value: string, expected: SlicingCriterionExpected][] = [
				['', { domain: IntervalTests.bottom() }],
				['0', { domain: IntervalTests.scalar(1) }],
				['-232', { domain: IntervalTests.scalar(1) }],
				['Inf', { domain: IntervalTests.scalar(1) }],
				['-Inf', { domain: IntervalTests.scalar(1) }],
				['NaN', { domain: IntervalTests.interval(0, Infinity) }],
				['c(1, 2, 3)', { domain: IntervalTests.interval(0, Infinity) }],
				['"Hallo"', { domain: IntervalTests.interval(0, Infinity) }],
				['TRUE', { domain: IntervalTests.interval(0, Infinity) }],
				['NULL', { domain: IntervalTests.interval(0, Infinity) }],
				['1, 2', { domain: IntervalTests.bottom() }]
			] as const;

			for(const [value, expected] of testCases) {
				testIntervalDomain(`x <- length(${value})`, { '1@x': expected });
			}

			testIntervalDomain(`
				x <- \`+\`()
				y <- length(x)
			`, {
				'1@x': { domain: IntervalTests.bottom() },
				'2@y': { domain: IntervalTests.bottom() }
			});
		});

		describe('basic combined calculation', () => {
			testIntervalDomain('x <- 3 + 5 * 7 - 3', { '1@x': { domain: IntervalTests.scalar(3+5*7-3) } });
			testIntervalDomain('x <- (3 + 2) * (7 - 2 * 2)', { '1@x': { domain: IntervalTests.scalar((3+2)*(7-2*2)) } });
			testIntervalDomain(`
				x <- 3
				y <- -4
				z <- 2.4
				result <- x * 3 - y * z
				zero <- 5 * 0
				invalid <- Inf * zero
			`, {
				'1@x':       { domain: IntervalTests.scalar(3) },
				'2@y':       { domain: IntervalTests.scalar(-4) },
				'3@z':       { domain: IntervalTests.scalar(2.4) },
				'4@result':  { domain: IntervalTests.scalar(3*3-(-4)*2.4) },
				'5@zero':    { domain: IntervalTests.scalar(0) },
				'6@invalid': { domain: IntervalTests.top() }
			});
		});

		// We cannot process interprocedural calls yet
		describe('user defined function calls ARE NOT ABLE to return numeric values', { fails: true }, () => {
			// Once we support interprocedural analysis, remove the filter to also test the cases, where Top should be inferred.
			for(const [value, expected] of constantNumericTestCases.concat(constantNonNumericTestCases).filter(([_, expected]) => expected.domain !== IntervalTests.top())) {
				testIntervalDomain(`
					f <- function() ${value}
					x <- f()
				`, { '2@x': expected });
			}
		});
	});

	describe('condition semantics', () => {
		describe('while semantics', () => {
			testIntervalDomain(`
				x <- 1
				while (x < 10) {
					x <- x + 1
					x <- x - 1
				}
				print(x)
			`, {
				'1@x': { domain: IntervalTests.scalar(1) },
				'2@x': { domain: IntervalTests.scalar(1) },
				'3@x': { domain: IntervalTests.scalar(2) },
				'4@x': { domain: IntervalTests.scalar(1) },
				'6@x': { domain: IntervalTests.bottom() }
			});
			testIntervalDomain(`
				x <- 0
				while (!((!(!3)))) {
					x <- x + 1
				}
				print(x)
			`, {
				'3@x': { domain: IntervalTests.bottom() },
				'5@x': { domain: IntervalTests.scalar(0) },
			});
			testIntervalDomain(`
				x <- 0
				while ((3 + 4) * (2 - 2)) {
					x <- x * 2
					x <- x + 4
				}
				print(x)
			`, {
				'1@x': { domain: IntervalTests.scalar(0) },
				'3@x': { domain: IntervalTests.bottom() },
				'4@x': { domain: IntervalTests.bottom() },
				'6@x': { domain: IntervalTests.scalar(0) }
			});
			testIntervalDomain(`
				x <- 0
				while (!x) {
					x <- 1
				}
				print(x)
			`, {
				'1@x': { domain: IntervalTests.scalar(0) },
				'2@x': { domain: IntervalTests.interval(0, 1) },
				'3@x': { domain: IntervalTests.scalar(1) },
				'5@x': { domain: IntervalTests.scalar(1), matching: DomainMatchingType.Overapproximation } // OA due to flowR -> read edge to 1@x
			});
			testIntervalDomain(`
				x <- 0
				while (3) {
					x <- x + 1
				}
				print(x)
			`, {
				'3@x': { domain: IntervalTests.interval(1, Infinity) },
				'5@x': { domain: IntervalTests.bottom() },
			});

			testIntervalDomain(`
				x <- 0
				while (x != 2) {
					x <- x + 1
				}
				print(x)
			`, {
				'3@x': { domain: IntervalTests.interval(1, 2), matching: DomainMatchingType.Overapproximation }, // Due to reads edge from 2@x to 1@x (still there after first iteration where x is re-defined)
				'5@x': { domain: IntervalTests.scalar(2) },
			});

			testIntervalDomain(`
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
				'1@x': { domain: IntervalTests.scalar(0) },
				'2@a': { domain: IntervalTests.scalar(7) },
				'3@x': { domain: IntervalTests.interval(0, 12), matching: DomainMatchingType.Overapproximation },
				'4@a': { domain: IntervalTests.interval(2, 7), matching: DomainMatchingType.Overapproximation },
				'5@x': { domain: IntervalTests.scalar(12) },
				'7@a': { domain: IntervalTests.interval(1, 6), matching: DomainMatchingType.Overapproximation },
				'9@x': { domain: IntervalTests.scalar(12), matching: DomainMatchingType.Overapproximation },
				'9@a': { domain: IntervalTests.scalar(1), matching: DomainMatchingType.Overapproximation },
			});

			testIntervalDomain(`
				x <- 0
				while (x <= 20) {
					if (x > 20) {
						x <- 70
					}
					x <- x + 3
				}
				print(x)
			`, {
				'1@x': { domain: IntervalTests.scalar(0) },
				'2@x': { domain: IntervalTests.interval(0, 21), matching: DomainMatchingType.Overapproximation }, // OA due to widening
				'3@x': { domain: IntervalTests.interval(0, 18), matching: DomainMatchingType.Overapproximation },
				'4@x': { domain: IntervalTests.bottom() },
				'6@x': { domain: IntervalTests.interval(3, 21), matching: DomainMatchingType.Overapproximation },
				'8@x': { domain: IntervalTests.scalar(21), matching: DomainMatchingType.Overapproximation },
			});

			testIntervalDomain(`
				x <- 0
				while (x <= 5) {
					if (x > 5) {
						x <- 70
					}
					x <- x + 3
				}
				print(x)
			`, {
				'1@x': { domain: IntervalTests.scalar(0) },
				'2@x': { domain: IntervalTests.interval(0, 6), matching: DomainMatchingType.Overapproximation }, // OA due to join of 1@x and 6@x in 2@x
				'3@x': { domain: IntervalTests.interval(0, 3), matching: DomainMatchingType.Overapproximation },
				'4@x': { domain: IntervalTests.bottom() },
				'6@x': { domain: IntervalTests.interval(3, 6), matching: DomainMatchingType.Overapproximation },
				'8@x': { domain: IntervalTests.scalar(6), matching: DomainMatchingType.Overapproximation },
			});

			testIntervalDomain(`
				x <- 0
				a <- 6
				while (x < 2) {
					while (a <= 7) {
						if (a == 5) {
							x <- x + 1
						}
						a <- a + 1
					}
					a <- 3
				}
				cat(x, a)
			`, {
				'1@x':  { domain: IntervalTests.scalar(0) },
				'2@a':  { domain: IntervalTests.scalar(6) },
				'3@x':  { domain: IntervalTests.interval(0, 2), matching: DomainMatchingType.Overapproximation }, // OA due to join of 1@x and 6@x in 3@x
				'4@a':  { domain: IntervalTests.interval(3, 8), matching: DomainMatchingType.Overapproximation }, // OA due to widening
				'5@a':  { domain: IntervalTests.interval(3, 7), matching: DomainMatchingType.Overapproximation }, // OA due to widening
				'6@x':  { domain: IntervalTests.interval(1, 2), matching: DomainMatchingType.Overapproximation }, // OA due to join of 1@x and 6@x in 3@x
				'8@a':  { domain: IntervalTests.interval(4, 8), matching: DomainMatchingType.Overapproximation }, // OA due to widening
				'10@a': { domain: IntervalTests.scalar(3) },
				'12@x': { domain: IntervalTests.scalar(2), matching: DomainMatchingType.Overapproximation }, // OA due to join of 1@x and 6@x in 3@x
				'12@a': { domain: IntervalTests.scalar(3), matching: DomainMatchingType.Overapproximation }, // OA due to join of 2@a and 10@a in 12@a AND due to extra iteration after widening
			});
		});

		describe('repeat semantics', () => {
			testIntervalDomain(`
				x <- 0
				repeat {
					x <- x + 1
					if (unknown) {
						break
					}
				}
				print(x)
			`, {
				'3@x': { domain: IntervalTests.interval(1, Infinity) },
				'8@x': { domain: IntervalTests.interval(1, Infinity), matching: DomainMatchingType.Overapproximation }, // OA due to flowR -> read edge to 1@x
			});
		});

		describe('if else semantics', () => {
			testIntervalDomain(`
				x <- 0
				if (!x) {
					x <- x + 1
				} else {
					x <- x - 1
				}
				print(x)
			`, {
				'1@x': { domain: IntervalTests.scalar(0) },
				'3@x': { domain: IntervalTests.scalar(1) },
				'5@x': { domain: IntervalTests.bottom() },
				'7@x': { domain: IntervalTests.scalar(1) }
			});

			testIntervalDomain(`
				x <- 5
				if (x == 5) {
					x <- x + 1
				} else {
					x <- x - 1
				}
				print(x)
			`, {
				'1@x': { domain: IntervalTests.scalar(5) },
				'3@x': { domain: IntervalTests.scalar(6) },
				'5@x': { domain: IntervalTests.bottom() },
				'7@x': { domain: IntervalTests.scalar(6) }
			});

			testIntervalDomain(`
				x <- 1
				if ((2 * x + 3) == 5) {
					x <- x + 1
				} else {
					x <- x - 1
				}
				print(x)
			`, {
				'1@x': { domain: IntervalTests.scalar(1) },
				'3@x': { domain: IntervalTests.scalar(2) },
				'5@x': { domain: IntervalTests.bottom() },
				'7@x': { domain: IntervalTests.scalar(2) }
			});

			testIntervalDomain(`
				x <- 1
				if (is.na(x)) {
					x <- x + 1
				} else {
					x <- x - 1
				}
				print(x)
			`, {
				'1@x': { domain: IntervalTests.scalar(1) },
				'3@x': { domain: IntervalTests.bottom() },
				'5@x': { domain: IntervalTests.scalar(0) },
				'7@x': { domain: IntervalTests.scalar(0) }
			});

			testIntervalDomain(`
				x <- "Hallo"
				if (is.na(x)) {
					x <- 1
				} else {
					x <- -1
				}
				print(x)
			`, {
				'1@x': { domain: IntervalTests.top() },
				'3@x': { domain: IntervalTests.bottom(), matching: DomainMatchingType.Overapproximation }, // OA due to missing string domain/resolving
				'5@x': { domain: IntervalTests.scalar(-1) },
				'7@x': { domain: IntervalTests.scalar(-1), matching: DomainMatchingType.Overapproximation }, // OA result from above
			});

			testIntervalDomain(`
				x <- 13
				if (x < 10) {
				  x = x + 1
				} else if (x < 20) {
				  x = x + 2
				} else {
				  x = x + 3
				}
				print(x)
			`, {
				'1@x': { domain: IntervalTests.scalar(13) },
				'3@x': { domain: IntervalTests.bottom() },
				'5@x': { domain: IntervalTests.scalar(15) },
				'7@x': { domain: IntervalTests.bottom() },
				'9@x': { domain: IntervalTests.scalar(15) }
			});

			testIntervalDomain(`
				x <- c(13)
				if (x < 10) {
				  x = x + 1
				} else if (x < 20) {
				  x = x + 2
				} else {
				  x = x + 3
				}
				print(x)
			`, {
				'1@x': { domain: IntervalTests.scalar(13), matching: DomainMatchingType.Overapproximation }, // OA due to vectorization of x@1
				'3@x': { domain: IntervalTests.bottom(), matching: DomainMatchingType.Overapproximation }, // OA due to vectorization of x@1
				'5@x': { domain: IntervalTests.scalar(15), matching: DomainMatchingType.Overapproximation }, // OA due to vectorization of x@1
				'7@x': { domain: IntervalTests.bottom(), matching: DomainMatchingType.Overapproximation }, // OA due to vectorization of x@1
				'9@x': { domain: IntervalTests.scalar(15), matching: DomainMatchingType.Overapproximation } // OA due to vectorization of x@1
			});

			testIntervalDomain(`
				x <- 1
				y <- 2
				if (x < 10) {
					if (x * y < 5) {
						x <- 2 * y + x
					} else {
						x <- -1
					}
					
					if (x - y > 0) {
						y = x - y
					} else {
						y = x + y
					}
				}
				x;y;
			`, {
				'1@x':  { domain: IntervalTests.scalar(1) },
				'2@y':  { domain: IntervalTests.scalar(2) },
				'5@x':  { domain: IntervalTests.scalar(5) },
				'7@x':  { domain: IntervalTests.bottom() },
				'11@y': { domain: IntervalTests.scalar(3) },
				'13@y': { domain: IntervalTests.bottom() },
				'16@x': { domain: IntervalTests.scalar(5), matching: DomainMatchingType.Overapproximation }, // OA as there is a read edge from 16@x to 1@x, although else branch is bottom
				'16@y': { domain: IntervalTests.scalar(3), matching: DomainMatchingType.Overapproximation } // OA as there is a read edge from 16@y to 2@y, although else branch is bottom
			});
		});
	});

	describe('for semantics', () => {
		testIntervalDomain(`
			x <- 0
			b <- c("1", "2", "3")
			for (a in b) {
				x = x+1
			}
			x
		`, {
			'1@x': { domain: IntervalTests.scalar(0) },
			'4@x': { domain: IntervalTests.interval(1, 3), matching: DomainMatchingType.Overapproximation },
			'6@x': { domain: IntervalTests.interval(1, 3), matching: DomainMatchingType.Overapproximation },
		});
	});

	describe('unknown side effects', () => {
		testIntervalDomain(`
			x <- length(a)
			if (x < 3) {
				x = x-1
				assign(paste("timepoint_", count, sep=""), df$precincts.results)
				x
			}
			x
		`, {
			'1@x': { domain: IntervalTests.interval(0, Infinity) },
			'3@x': { domain: IntervalTests.interval(-1, 2) },
			'5@x': { domain: IntervalTests.interval(-1, 2), matching: DomainMatchingType.Overapproximation },
			'7@x': { domain: IntervalTests.interval(-1, Infinity), matching: DomainMatchingType.Overapproximation },
		});

		describe('unknown side effects inside loops are currently not handled correctly', { fails: true }, () => {
			testIntervalDomain(`
				x <- 0
				b <- c("1", "2", "3")
				for (a in b) {
					x = x+1
					assign(paste("x", "", sep=""), 8)
				}
				x
			`, {
				// In the second iteration, the unknown side effect is forgotten, and we assume that x resolves only to l.1: 0 (but in fact would resolve to l.5: 8)
				'4@x': { domain: IntervalTests.interval(1, 9), matching: DomainMatchingType.Overapproximation },
				'7@x': { domain: IntervalTests.scalar(8) }
			});

			testIntervalDomain(`
				x <- 0
				while (x < 3) {
					x = x+1
					assign(paste("x", "", sep=""), x + 1)
				}
				x
			`, {
				'3@x': { domain: IntervalTests.interval(1, 3), matching: DomainMatchingType.Overapproximation },
				'6@x': { domain: IntervalTests.scalar(4) },
			});

			testIntervalDomain(`
				x <- 0
				repeat {
					x = x+1
					if (x >= 3) {
						break
					}
					assign(paste("x", "", sep=""), x + 1)
				}
				x
			`, {
				'3@x': { domain: IntervalTests.interval(1, 3), matching: DomainMatchingType.Overapproximation },
				'9@x': { domain: IntervalTests.scalar(3) },
			});
		});
	});

	describe('user defined function', () => {
		testIntervalDomain(`
			x <- function(y) {
				if (y <= 5) {
					x <- 3
				} else {
					x <- -3
				}
				y+x
			}
			z <- x(5)
		`, {
			'2@y': { domain: IntervalTests.top() },
			'3@x': { domain: IntervalTests.scalar(3) },
			'5@x': { domain: IntervalTests.scalar(-3) },
			'7@x': { domain: IntervalTests.interval(-3, 3) },
			'9@z': { domain: IntervalTests.scalar(8), matching: DomainMatchingType.Overapproximation },
		});
	});
});
