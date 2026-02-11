import { describe } from 'vitest';
import type { SlicingCriterionExpected } from './interval';
import { DomainMatchingType, IntervalTests, testIntervalDomain } from './interval';
import { Identifier } from '../../../../src/dataflow/environments/identifier';
import { isUndefined } from '../../../../src/util/assert';

describe('Interval Inference', () => {
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

	const binaryOperatorTestCases: readonly [l: string, r: string, expected: Map<Identifier, SlicingCriterionExpected>][] = [
		['', '7', new Map([
			[Identifier.make('+'), { domain: IntervalTests.scalar(7) }],
			[Identifier.make('-'), { domain: IntervalTests.scalar(-7) }]
		])],
		['0', '0', new Map([
			[Identifier.make('+'), { domain: IntervalTests.scalar(0) }],
			[Identifier.make('-'), { domain: IntervalTests.scalar(0) }],
			[Identifier.make('*'), { domain: IntervalTests.scalar(0) }]
		])],
		['2.5', '0', new Map([
			[Identifier.make('+'), { domain: IntervalTests.scalar(2.5) }],
			[Identifier.make('-'), { domain: IntervalTests.scalar(2.5) }],
			[Identifier.make('*'), { domain: IntervalTests.scalar(0) }]
		])],
		['0', '-5', new Map([
			[Identifier.make('+'), { domain: IntervalTests.scalar(-5) }],
			[Identifier.make('-'), { domain: IntervalTests.scalar(5) }],
			[Identifier.make('*'), { domain: IntervalTests.scalar(0) }]
		])],
		['2', '5', new Map([
			[Identifier.make('+'), { domain: IntervalTests.scalar(7) }],
			[Identifier.make('-'), { domain: IntervalTests.scalar(-3) }],
			[Identifier.make('*'), { domain: IntervalTests.scalar(10) }]
		])],
		['384', '92', new Map([
			[Identifier.make('+'), { domain: IntervalTests.scalar(476) }],
			[Identifier.make('-'), { domain: IntervalTests.scalar(292) }],
			[Identifier.make('*'), { domain: IntervalTests.scalar(35328) }]
		])],
		['-5', '18', new Map([
			[Identifier.make('+'), { domain: IntervalTests.scalar(13) }],
			[Identifier.make('-'), { domain: IntervalTests.scalar(-23) }],
			[Identifier.make('*'), { domain: IntervalTests.scalar(-90) }]
		])],
		['-15', '-2', new Map([
			[Identifier.make('+'), { domain: IntervalTests.scalar(-17) }],
			[Identifier.make('-'), { domain: IntervalTests.scalar(-13) }],
			[Identifier.make('*'), { domain: IntervalTests.scalar(30) }]
		])],
		['2.7', '1.3', new Map([
			[Identifier.make('+'), { domain: IntervalTests.scalar(4) }],
			[Identifier.make('-'), { domain: IntervalTests.scalar(1.4, 16) }],
			[Identifier.make('*'), { domain: IntervalTests.scalar(3.51, 16) }]
		])],
		['2', '1.3', new Map([
			[Identifier.make('+'), { domain: IntervalTests.scalar(3.3) }],
			[Identifier.make('-'), { domain: IntervalTests.scalar(0.7) }],
			[Identifier.make('*'), { domain: IntervalTests.scalar(2.6) }]
		])],
		['5', '-3', new Map([
			[Identifier.make('+'), { domain: IntervalTests.scalar(2) }],
			[Identifier.make('-'), { domain: IntervalTests.scalar(8) }],
			[Identifier.make('*'), { domain: IntervalTests.scalar(-15) }]
		])],
		['-2', '4', new Map([
			[Identifier.make('+'), { domain: IntervalTests.scalar(2) }],
			[Identifier.make('-'), { domain: IntervalTests.scalar(-6) }],
			[Identifier.make('*'), { domain: IntervalTests.scalar(-8) }]
		])],
		['-3', '-6', new Map([
			[Identifier.make('+'), { domain: IntervalTests.scalar(-9) }],
			[Identifier.make('-'), { domain: IntervalTests.scalar(3) }],
			[Identifier.make('*'), { domain: IntervalTests.scalar(18) }]
		])],
		['1e10', '1e-5', new Map([
			[Identifier.make('+'), { domain: IntervalTests.scalar(10000000000.00001) }],
			[Identifier.make('-'), { domain: IntervalTests.scalar(9999999999.99999) }],
			[Identifier.make('*'), { domain: IntervalTests.scalar(1e5, 16) }]
		])],
		['Inf', '0', new Map([
			[Identifier.make('+'), { domain: IntervalTests.scalar(Infinity) }],
			[Identifier.make('-'), { domain: IntervalTests.scalar(Infinity) }],
			[Identifier.make('*'), { domain: IntervalTests.top() }]
		])],
		['Inf', '5', new Map([
			[Identifier.make('+'), { domain: IntervalTests.scalar(Infinity) }],
			[Identifier.make('-'), { domain: IntervalTests.scalar(Infinity) }],
			[Identifier.make('*'), { domain: IntervalTests.scalar(Infinity) }]
		])],
		['Inf', '-3', new Map([
			[Identifier.make('+'), { domain: IntervalTests.scalar(Infinity) }],
			[Identifier.make('-'), { domain: IntervalTests.scalar(Infinity) }],
			[Identifier.make('*'), { domain: IntervalTests.scalar(-Infinity) }]
		])],
		['87', 'Inf', new Map([
			[Identifier.make('+'), { domain: IntervalTests.scalar(Infinity) }],
			[Identifier.make('-'), { domain: IntervalTests.scalar(-Infinity) }],
			[Identifier.make('*'), { domain: IntervalTests.scalar(Infinity) }]
		])],
		['Inf', 'Inf', new Map([
			[Identifier.make('+'), { domain: IntervalTests.scalar(Infinity) }],
			[Identifier.make('-'), { domain: IntervalTests.top() }],
			[Identifier.make('*'), { domain: IntervalTests.scalar(Infinity) }]
		])],
		['(-Inf)', 'Inf', new Map([
			[Identifier.make('+'), { domain: IntervalTests.top() }],
			[Identifier.make('-'), { domain: IntervalTests.scalar(-Infinity) }],
			[Identifier.make('*'), { domain: IntervalTests.scalar(-Infinity) }]
		])],
		['(-Inf)', '(-Inf)', new Map([
			[Identifier.make('+'), { domain: IntervalTests.scalar(-Infinity) }],
			[Identifier.make('-'), { domain: IntervalTests.top() }],
			[Identifier.make('*'), { domain: IntervalTests.scalar(Infinity) }]
		])],
		['NaN', '3', new Map([
			[Identifier.make('+'), { domain: IntervalTests.top() }],
			[Identifier.make('-'), { domain: IntervalTests.top() }],
			[Identifier.make('*'), { domain: IntervalTests.top() }]
		])],
		['3', '"Hallo"', new Map([
			[Identifier.make('+'), { domain: IntervalTests.top() }],
			[Identifier.make('-'), { domain: IntervalTests.top() }],
			[Identifier.make('*'), { domain: IntervalTests.top() }]
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

	describe.each([Identifier.make('+'), Identifier.make('-'), Identifier.make('*')])('%s semantics', (identifier) => {
		for(const [l, r, expected] of binaryOperatorTestCases) {
			const slicingCriterionExpected: SlicingCriterionExpected | undefined = expected.get(identifier);
			if(!isUndefined(slicingCriterionExpected)) {
				testIntervalDomain(`x <- ${l} ${Identifier.toString(identifier)} ${r}`, { '1@x': slicingCriterionExpected });
			}
		}
	});

	describe('length semantics', () => {
		const testCases: [value: string, expected: SlicingCriterionExpected][] = [
			['0', { domain: IntervalTests.scalar(1) }],
			['-232', { domain: IntervalTests.scalar(1) }],
			['Inf', { domain: IntervalTests.scalar(1) }],
			['-Inf', { domain: IntervalTests.scalar(1) }],
			['NaN', { domain: IntervalTests.interval(0, Infinity) }],
			['c(1, 2, 3)', { domain: IntervalTests.interval(0, Infinity) }],
			['"Hallo"', { domain: IntervalTests.interval(0, Infinity) }],
			['TRUE', { domain: IntervalTests.interval(0, Infinity) }],
			['NULL', { domain: IntervalTests.interval(0, Infinity) }],
		] as const;

		for(const [value, expected] of testCases) {
			testIntervalDomain(`x <- length(${value})`, { '1@x': expected });
		}
	});

	describe('basic combined calculation', () => {
		testIntervalDomain('x <- 3 + 5 * 7 - 3', { '1@x': { domain: IntervalTests.scalar(35) } });
		testIntervalDomain('x <- (3 + 2) * (7 - 2 * 2)', { '1@x': { domain: IntervalTests.scalar(15) } });
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
			'4@result':  { domain: IntervalTests.scalar(18.6) },
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

	// We cannot process condition/while yet
	describe('while semantics', () => {
		testIntervalDomain(`
			x <- 1
			while (x < 10) {
				x <- x + 1
				x <- x - 1
			}
			print(x)
		`, {
			'3@x': { domain: IntervalTests.scalar(2), matching: DomainMatchingType.Overapproximation },
			'4@x': { domain: IntervalTests.scalar(1), matching: DomainMatchingType.Overapproximation },
			'6@x': { domain: IntervalTests.bottom(), matching: DomainMatchingType.Overapproximation }
		});
	});

	describe('condition semantics', () => {
		testIntervalDomain(`
			x <- 0
			if (x < 5) {
				x <- x + 1
			} else {
				x <- x - 1
			}
			print(x)
		`, {
			'1@x': { domain: IntervalTests.scalar(0) },
			'3@x': { domain: IntervalTests.scalar(1) },
			'5@x': { domain: IntervalTests.bottom(), matching: DomainMatchingType.Overapproximation },
			'7@x': { domain: IntervalTests.scalar(1), matching: DomainMatchingType.Overapproximation }
		});
	});
});