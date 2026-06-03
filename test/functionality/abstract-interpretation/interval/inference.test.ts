import { describe } from 'vitest';
import type { IntervalSlicingCriterionExpected } from './interval';
import { DomainMatchingType, IntervalTests, testIntervalDomain } from './interval';
import { Identifier } from '../../../../src/dataflow/environments/identifier';
import { isUndefined } from '../../../../src/util/assert';

export type IntervalInferenceOperatorTestCase = readonly [arguments: string[], expected: Map<Identifier, IntervalSlicingCriterionExpected>][];

export const constantNumericTestCases: readonly [value: string, expected: IntervalSlicingCriterionExpected][] = [
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

export const constantNonNumericTestCases: readonly [value: string, expected: IntervalSlicingCriterionExpected][] = [
	['"Hallo"', { domain: IntervalTests.top() }],
	['TRUE', { domain: IntervalTests.top() }],
	['FALSE', { domain: IntervalTests.top() }],
	['NULL', { domain: IntervalTests.top() }],
	['"3"', { domain: IntervalTests.top() }],
	['c(1, 2, 3)', { domain: IntervalTests.top() }],
] as const;

export const binaryOperatorSpecialCases: IntervalInferenceOperatorTestCase = [
	[[''], new Map([
		['+', { domain: IntervalTests.bottom() }],
		['-', { domain: IntervalTests.bottom() }],
		['*', { domain: IntervalTests.bottom() }],
		['/', { domain: IntervalTests.bottom() }],
		['^', { domain: IntervalTests.bottom() }],
		['%%', { domain: IntervalTests.bottom() }],
	])],
	[['3'], new Map([
		['+', { domain: IntervalTests.scalar(3) }],
		['-', { domain: IntervalTests.scalar(-3) }],
		['*', { domain: IntervalTests.bottom() }],
		['/', { domain: IntervalTests.bottom() }],
		['^', { domain: IntervalTests.bottom() }],
		['%%', { domain: IntervalTests.bottom() }],
	])],
	[['3', ''], new Map([
		['+', { domain: IntervalTests.bottom() }],
		['-', { domain: IntervalTests.bottom() }],
		['*', { domain: IntervalTests.bottom() }],
		['/', { domain: IntervalTests.bottom() }],
		['^', { domain: IntervalTests.bottom() }],
		['%%', { domain: IntervalTests.bottom() }],
	])],
	[['', '7'], new Map([
		['+', { domain: IntervalTests.bottom() }],
		['-', { domain: IntervalTests.bottom() }],
		['*', { domain: IntervalTests.bottom() }],
		['/', { domain: IntervalTests.bottom() }],
		['^', { domain: IntervalTests.bottom() }],
		['%%', { domain: IntervalTests.bottom() }],
	])],
	[['', ''], new Map([
		['+', { domain: IntervalTests.bottom() }],
		['-', { domain: IntervalTests.bottom() }],
		['*', { domain: IntervalTests.bottom() }],
		['/', { domain: IntervalTests.bottom() }],
		['^', { domain: IntervalTests.bottom() }],
		['%%', { domain: IntervalTests.bottom() }],
	])],
	[['3', '4', ''], new Map([
		['+', { domain: IntervalTests.bottom() }],
		['-', { domain: IntervalTests.bottom() }],
		['*', { domain: IntervalTests.bottom() }],
		['/', { domain: IntervalTests.bottom() }],
		['^', { domain: IntervalTests.bottom() }],
		['%%', { domain: IntervalTests.bottom() }],
	])]
] as const;

export const binaryInfixOperatorSpecialCases: IntervalInferenceOperatorTestCase = [
	[['', '7'], new Map([
		['+', { domain: IntervalTests.scalar(7) }],
		['-', { domain: IntervalTests.scalar(-7) }]
	])]
] as const;

export const binaryOperatorSuccessTestCases: IntervalInferenceOperatorTestCase = [
	[['0', '0'], new Map([
		['+', { domain: IntervalTests.scalar(0) }],
		['-', { domain: IntervalTests.scalar(0) }],
		['*', { domain: IntervalTests.scalar(0) }],
		['/', { domain: IntervalTests.top() }],
		['^', { domain: IntervalTests.scalar(1) }],
		['%%', { domain: IntervalTests.top() }],
	])],
	[['2.5', '0'], new Map([
		['+', { domain: IntervalTests.scalar(2.5) }],
		['-', { domain: IntervalTests.scalar(2.5) }],
		['*', { domain: IntervalTests.scalar(0) }],
		['/', { domain: IntervalTests.scalar(Number.POSITIVE_INFINITY), matching: DomainMatchingType.Overapproximation }],
		['^', { domain: IntervalTests.scalar(1) }],
		['%%', { domain: IntervalTests.top() }],
	])],
	[['0', '-5'], new Map([
		['+', { domain: IntervalTests.scalar(-5) }],
		['-', { domain: IntervalTests.scalar(5) }],
		['*', { domain: IntervalTests.scalar(0) }],
		['/', { domain: IntervalTests.scalar(0) }],
		['^', { domain: IntervalTests.scalar(Number.POSITIVE_INFINITY) }],
		['%%', { domain: IntervalTests.scalar(0%(-5)) }],
	])],
	[['2', '5'], new Map([
		['+', { domain: IntervalTests.scalar(2+5) }],
		['-', { domain: IntervalTests.scalar(2-5) }],
		['*', { domain: IntervalTests.scalar(2*5) }],
		['/', { domain: IntervalTests.scalar(2/5) }],
		['^', { domain: IntervalTests.scalar(2**5) }],
		['%%', { domain: IntervalTests.scalar(2%5) }]
	])],
	[['384', '92'], new Map([
		['+', { domain: IntervalTests.scalar(384+92) }],
		['-', { domain: IntervalTests.scalar(384-92) }],
		['*', { domain: IntervalTests.scalar(384*92) }],
		['/', { domain: IntervalTests.scalar(384/92) }],
		['^', { domain: IntervalTests.scalar(384**92) }],
		['%%', { domain: IntervalTests.scalar(384%92) }]
	])],
	[['(-5)', '18'], new Map([
		['+', { domain: IntervalTests.scalar((-5)+18) }],
		['-', { domain: IntervalTests.scalar((-5)-18) }],
		['*', { domain: IntervalTests.scalar((-5)*18) }],
		['/', { domain: IntervalTests.scalar((-5)/18) }],
		['^', { domain: IntervalTests.scalar((-5)**18) }],
		['%%', { domain: IntervalTests.scalar((-5)%18) }]
	])],
	[['(-15)', '-2'], new Map([
		['+', { domain: IntervalTests.scalar((-15)+(-2)) }],
		['-', { domain: IntervalTests.scalar((-15)-(-2)) }],
		['*', { domain: IntervalTests.scalar((-15)*(-2)) }],
		['/', { domain: IntervalTests.scalar((-15)/(-2)) }],
		['^', { domain: IntervalTests.scalar((-15)**(-2)) }],
		['%%', { domain: IntervalTests.scalar((-15)%(-2)) }]
	])],
	[['2.7', '1.3'], new Map([
		['+', { domain: IntervalTests.scalar(2.7+1.3) }],
		['-', { domain: IntervalTests.scalar(2.7-1.3) }],
		['*', { domain: IntervalTests.scalar(2.7*1.3) }],
		['/', { domain: IntervalTests.scalar(2.7/1.3) }],
		['^', { domain: IntervalTests.scalar(2.7**1.3), matching: DomainMatchingType.Overapproximation }],
		['%%', { domain: IntervalTests.scalar(2.7%1.3) }]
	])],
	[['2', '1.3'], new Map([
		['+', { domain: IntervalTests.scalar(2+1.3) }],
		['-', { domain: IntervalTests.scalar(2-1.3) }],
		['*', { domain: IntervalTests.scalar(2*1.3) }],
		['/', { domain: IntervalTests.scalar(2/1.3) }],
		['^', { domain: IntervalTests.scalar(2**1.3), matching: DomainMatchingType.Overapproximation }],
		['%%', { domain: IntervalTests.scalar(2%1.3) }]
	])],
	[['5', '-3'], new Map([
		['+', { domain: IntervalTests.scalar(5+(-3)) }],
		['-', { domain: IntervalTests.scalar(5-(-3)) }],
		['*', { domain: IntervalTests.scalar(5*(-3)) }],
		['/', { domain: IntervalTests.scalar(5/(-3), 16) }],
		['^', { domain: IntervalTests.scalar(5**(-3)) }],
		['%%', { domain: IntervalTests.scalar(5%(-3)) }]
	])],
	[['(-2)', '4'], new Map([
		['+', { domain: IntervalTests.scalar((-2)+4) }],
		['-', { domain: IntervalTests.scalar((-2)-4) }],
		['*', { domain: IntervalTests.scalar((-2)*4) }],
		['/', { domain: IntervalTests.scalar((-2)/4) }],
		['^', { domain: IntervalTests.scalar((-2)**4) }],
		['%%', { domain: IntervalTests.scalar((-2)%4) }]
	])],
	[['(-3)', '-6'], new Map([
		['+', { domain: IntervalTests.scalar((-3)+(-6)) }],
		['-', { domain: IntervalTests.scalar((-3)-(-6)) }],
		['*', { domain: IntervalTests.scalar((-3)*(-6)) }],
		['/', { domain: IntervalTests.scalar((-3)/(-6)) }],
		['^', { domain: IntervalTests.scalar((-3)**(-6)) }],
		['%%', { domain: IntervalTests.scalar((-3)%(-6)) }]
	])],
	[['1e10', '1e-5'], new Map([
		['+', { domain: IntervalTests.scalar(1e10+1e-5) }],
		['-', { domain: IntervalTests.scalar(1e10-1e-5) }],
		['*', { domain: IntervalTests.scalar(1e10*1e-5) }],
		['/', { domain: IntervalTests.scalar(1e10/1e-5) }],
		['^', { domain: IntervalTests.scalar(1e10**1e-5), matching: DomainMatchingType.Overapproximation }],
		['%%', { domain: IntervalTests.scalar(1e10%1e-5) }]
	])],
	[['Inf', '0'], new Map([
		['+', { domain: IntervalTests.scalar(Infinity) }],
		['-', { domain: IntervalTests.scalar(Infinity) }],
		['*', { domain: IntervalTests.top() }],
		['/', { domain: IntervalTests.scalar(Infinity), matching: DomainMatchingType.Overapproximation }],
		['^', { domain: IntervalTests.scalar(1) }],
		['%%', { domain: IntervalTests.top() }]
	])],
	[['Inf', '5'], new Map([
		['+', { domain: IntervalTests.scalar(Infinity + 5) }],
		['-', { domain: IntervalTests.scalar(Infinity - 5) }],
		['*', { domain: IntervalTests.scalar(Infinity * 5) }],
		['/', { domain: IntervalTests.scalar(Infinity) }],
		['^', { domain: IntervalTests.scalar(Infinity) }],
		['%%', { domain: IntervalTests.top() }]
	])],
	[['Inf', '-3'], new Map([
		['+', { domain: IntervalTests.scalar(Infinity+(-3)) }],
		['-', { domain: IntervalTests.scalar(Infinity-(-3)) }],
		['*', { domain: IntervalTests.scalar(Infinity*(-3)) }],
		['/', { domain: IntervalTests.scalar(Number.NEGATIVE_INFINITY) }],
		['^', { domain: IntervalTests.scalar(0) }],
		['%%', { domain: IntervalTests.top() }]
	])],
	[['87', 'Inf'], new Map([
		['+', { domain: IntervalTests.scalar(87+Infinity) }],
		['-', { domain: IntervalTests.scalar(87-Infinity) }],
		['*', { domain: IntervalTests.scalar(87*Infinity) }],
		['/', { domain: IntervalTests.scalar(0) }],
		['^', { domain: IntervalTests.scalar(Infinity) }],
		['%%', { domain: IntervalTests.scalar(87) }],
	])],
	[['Inf', 'Inf'], new Map([
		['+', { domain: IntervalTests.scalar(Infinity+Infinity) }],
		['-', { domain: IntervalTests.top() }],
		['*', { domain: IntervalTests.scalar(Infinity*Infinity) }],
		['/', { domain: IntervalTests.top() }],
		['^', { domain: IntervalTests.scalar(Infinity) }],
		['%%', { domain: IntervalTests.top() }]
	])],
	[['(-Inf)', 'Inf'], new Map([
		['+', { domain: IntervalTests.top() }],
		['-', { domain: IntervalTests.scalar((-Infinity)-Infinity) }],
		['*', { domain: IntervalTests.scalar((-Infinity)*Infinity) }],
		['/', { domain: IntervalTests.top() }],
		['^', { domain: IntervalTests.top() }],
		['%%', { domain: IntervalTests.top() }]
	])],
	[['(-Inf)', '(-Inf)'], new Map([
		['+', { domain: IntervalTests.scalar((-Infinity)+(-Infinity)) }],
		['-', { domain: IntervalTests.top() }],
		['*', { domain: IntervalTests.scalar((-Infinity)*(-Infinity)) }],
		['/', { domain: IntervalTests.top() }],
		['^', { domain: IntervalTests.top() }],
		['%%', { domain: IntervalTests.top() }]
	])],
	[['NaN', '3'], new Map([
		['+', { domain: IntervalTests.top() }],
		['-', { domain: IntervalTests.top() }],
		['*', { domain: IntervalTests.top() }],
		['/', { domain: IntervalTests.top() }],
		['^', { domain: IntervalTests.top() }],
		['%%', { domain: IntervalTests.top() }]
	])],
	[['3', '"Hallo"'], new Map([
		['+', { domain: IntervalTests.top() }],
		['-', { domain: IntervalTests.top() }],
		['*', { domain: IntervalTests.top() }],
		['/', { domain: IntervalTests.top() }],
		['^', { domain: IntervalTests.top() }],
		['%%', { domain: IntervalTests.top() }]
	])],
	[['`+`()', '7'], new Map([
		['+', { domain: IntervalTests.bottom() }],
		['-', { domain: IntervalTests.bottom() }],
		['*', { domain: IntervalTests.bottom() }],
		['/', { domain: IntervalTests.bottom() }],
		['^', { domain: IntervalTests.bottom() }],
		['%%', { domain: IntervalTests.bottom() }]
	])],
	[['7', '`+`()'], new Map([
		['+', { domain: IntervalTests.bottom() }],
		['-', { domain: IntervalTests.bottom() }],
		['*', { domain: IntervalTests.bottom() }],
		['/', { domain: IntervalTests.bottom() }],
		['^', { domain: IntervalTests.bottom() }],
		['%%', { domain: IntervalTests.bottom() }]
	])],
	[['5', 'ifelse(c, -2, 4)'], new Map([
		['+', { domain: IntervalTests.interval(5-2, 5+4) }],
		['-', { domain: IntervalTests.interval(5-4, 5+2) }],
		['*', { domain: IntervalTests.interval(-10, 20) }],
		['/', { domain: IntervalTests.interval(Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY) }],
		['^', { domain: IntervalTests.top() }],
		['%%', { domain: IntervalTests.top() }]
	])],
	[['5', 'ifelse(c, 1, 4)'], new Map([
		['+', { domain: IntervalTests.interval(6, 9) }],
		['-', { domain: IntervalTests.interval(1, 4) }],
		['*', { domain: IntervalTests.interval(5, 20) }],
		['/', { domain: IntervalTests.interval(5/4, 5) }],
		['^', { domain: IntervalTests.interval(5, 5**4), matching: DomainMatchingType.Overapproximation }],
		['%%', { domain: IntervalTests.interval(0, 4) }]
	])],
	[['5', 'ifelse(c, -1, -4)'], new Map([
		['+', { domain: IntervalTests.interval(1, 4) }],
		['-', { domain: IntervalTests.interval(6, 9) }],
		['*', { domain: IntervalTests.interval(-20, -5) }],
		['/', { domain: IntervalTests.interval(-5, 5/(-4)) }],
		['^', { domain: IntervalTests.interval(5**(-4), 5**(-1)), matching: DomainMatchingType.Overapproximation }],
		['%%', { domain: IntervalTests.interval(-4, 0) }]
	])],
	[['ifelse(c, -2, 4)', '5'], new Map([
		['+', { domain: IntervalTests.interval(-2+5, 4+5) }],
		['-', { domain: IntervalTests.interval((-2)-5, 4-5) }],
		['*', { domain: IntervalTests.interval(-10, 20) }],
		['/', { domain: IntervalTests.interval((-2)/5, 4/5) }],
		['^', { domain: IntervalTests.interval((-2)**5, 4**5) }],
		['%%', { domain: IntervalTests.interval(0, 4) }]
	])],
	[['ifelse(c, 1, 4)', '5'], new Map([
		['+', { domain: IntervalTests.interval(6, 9) }],
		['-', { domain: IntervalTests.interval(-4, -1) }],
		['*', { domain: IntervalTests.interval(5, 20) }],
		['/', { domain: IntervalTests.interval(1/5, 4/5) }],
		['^', { domain: IntervalTests.interval(1, 4**5) }],
		['%%', { domain: IntervalTests.interval(0, 4) }]
	])],
	[['ifelse(c, -1, -4)', '5'], new Map([
		['+', { domain: IntervalTests.interval(1, 4) }],
		['-', { domain: IntervalTests.interval(-9, -6) }],
		['*', { domain: IntervalTests.interval(-20, -5) }],
		['/', { domain: IntervalTests.interval((-4)/5, (-1)/5) }],
		['^', { domain: IntervalTests.interval((-4)**5, (-1)**5) }],
		['%%', { domain: IntervalTests.interval(0, 4) }]
	])]
] as const;

export const lengthTestCases: [value: string, expected: IntervalSlicingCriterionExpected][] = [
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

describe('Interval Inference', () => {
	describe('expression semantics', () => {
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

		describe.each(['+', '-', '*', '/', '^', '%%'])('%s infix semantics', (identifier) => {
			for(const [args, expected] of binaryOperatorSuccessTestCases.concat(binaryInfixOperatorSpecialCases)) {
				const slicingCriterionExpected: IntervalSlicingCriterionExpected | undefined = expected.get(identifier);
				if(!isUndefined(slicingCriterionExpected)) {
					testIntervalDomain(`x <- ${args[0] ?? ''} ${Identifier.toString(identifier)} ${args[1] ?? ''}`, { '1@x': slicingCriterionExpected });
				}
			}
		});

		describe.each(['+', '-', '*', '/', '^', '%%'])('%s function semantics', (identifier) => {
			for(const [args, expected] of binaryOperatorSuccessTestCases.concat(binaryOperatorSpecialCases)) {
				const slicingCriterionExpected: IntervalSlicingCriterionExpected | undefined = expected.get(identifier);
				if(!isUndefined(slicingCriterionExpected)) {
					testIntervalDomain(`x <- \`${Identifier.toString(identifier)}\`(${args.join(', ')})`, { '1@x': slicingCriterionExpected });
				}
			}
		});

		describe('length semantics', () => {
			for(const [value, expected] of lengthTestCases) {
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

		describe('sum semantics', () => {
			const testCases: [arguments: string[], expected: IntervalSlicingCriterionExpected][] = [
				[['1', 'na.rm=TRUE'], { domain: IntervalTests.scalar(1) }],
				[['1', 'NA', 'na.rm=FALSE'], { domain: IntervalTests.top() }],
				[['1', '2', '3', 'na.rm=TRUE'], { domain: IntervalTests.scalar(6) }],
				[['1', '2', '3', 'na.rm=FALSE'], { domain: IntervalTests.scalar(6) }],
				[['1', 'NA', '3', 'na.rm=FALSE'], { domain: IntervalTests.top() }],
				[['1', 'NA', '3', 'na.rm=TRUE'], { domain: IntervalTests.scalar(4), matching: DomainMatchingType.Overapproximation }],
			];
			describe.each(testCases)('args: %s, result: %s', (args, expected) => {
				testIntervalDomain(`
					x <- sum(${args.join(',')})
				`, {
					'1@x': expected
				});
			});
		});

		describe('max semantics', () => {
			const testCases: [arguments: string[], expected: IntervalSlicingCriterionExpected][] = [
				// Copy the test cases from below
				[['1', '2', '3'], { domain: IntervalTests.scalar(3) }],
				[['1', 'NA', '3'], { domain: IntervalTests.top() }],
				[['1', 'NA', '3', 'na.rm=TRUE'], { domain: IntervalTests.scalar(3), matching: DomainMatchingType.Overapproximation }],
				[['c(1,2,3)'], { domain: IntervalTests.scalar(3), matching: DomainMatchingType.Overapproximation }],
				[['c(1,2,3)', 'na.rm=TRUE'], { domain: IntervalTests.scalar(3), matching: DomainMatchingType.Overapproximation }]
			];

			describe.each(testCases)('args: %s, result: %s', (args, expected) => {
				testIntervalDomain(`
					x <- max(${args.join(',')})
				`, {
					'1@x': expected
				});
			});
		});

		describe('abs', () => {
			const testCases: [arguments: string[], expected: IntervalSlicingCriterionExpected][] = [
				// Copy the test cases from below
				[[], { domain: IntervalTests.bottom() }],
				[['1', '2'], { domain: IntervalTests.bottom() }],
				[['1'], { domain: IntervalTests.scalar(1) }],
				[['-1'], { domain: IntervalTests.scalar(1) }],
				[['ifelse(c, -5, 2)'], { domain: IntervalTests.interval(2, 5) }],
				[['c(1,2,3)'], { domain: IntervalTests.top() }]
			];

			describe.each(testCases)('args: %s, result: %s', (args, expected) => {
				testIntervalDomain(`
					x <- abs(${args.join(',')})
				`, {
					'1@x': expected
				});
			});
		});

		describe('log', () => {
			const testCases: [argument: string[], expected: IntervalSlicingCriterionExpected][] = [
				[['0'], { domain: IntervalTests.scalar(Number.NEGATIVE_INFINITY) }],
				[['-1'], { domain: IntervalTests.top() }],
				[['4'], { domain: IntervalTests.scalar(Math.log(4)) }],
				[['ifelse(c, -4, 2)'], { domain: IntervalTests.top() }],
				[['ifelse(c, 0, 5)'], { domain: IntervalTests.interval(Number.NEGATIVE_INFINITY, Math.log(5)) }],
				[['0', 'base=2'], { domain: IntervalTests.scalar(Number.NEGATIVE_INFINITY) }],
				[['-1', 'base=2'], { domain: IntervalTests.top() }],
				[['4', 'base=2'], { domain: IntervalTests.scalar(Math.log(4)/Math.log(2)) }],
				[['ifelse(c, -4, 2)', 'base=2'], { domain: IntervalTests.top() }],
				[['ifelse(c, 0, 5)', 'base=2'], { domain: IntervalTests.interval(Number.NEGATIVE_INFINITY, Math.log(5)/Math.log(2)) }]
			];

			describe.each(testCases)('args: %s, result: %s', (args, expected) => {
				testIntervalDomain(`
					x <- log(${args.join(', ')})
				`, {
					'1@x': expected
				});
			});
		});

		describe('round', () => {
			const testCases: [argument: string[], expected: IntervalSlicingCriterionExpected][] = [
				[['0'], { domain: IntervalTests.scalar(0) }],
				[['-1'], { domain: IntervalTests.scalar(-1) }],
				[['4'], { domain: IntervalTests.scalar(4) }],
				[['ifelse(c, -4.2, 2.5)'], { domain: IntervalTests.interval(-4, 3) }],
				[['ifelse(c, 0.1112, 5.2)'], { domain: IntervalTests.interval(0, 5) }],
				[['0.2851', 'digits=2'], { domain: IntervalTests.scalar(0.29) }],
				[['-1.779', '2'], { domain: IntervalTests.scalar(-1.78) }],
				[['4.555', 'ifelse(c, 1, 2)'], { domain: IntervalTests.interval(4.56, 4.6), matching: DomainMatchingType.Overapproximation }],
				[['digits=-1', '255'], { domain: IntervalTests.scalar(260) }],
				[['2', 'x=12.8888'], { domain: IntervalTests.scalar(12.89) }],
				[['digits=ifelse(c, -3, 4)', '888888.888888'], { domain: IntervalTests.scalar(888888.8889, 889000), matching: DomainMatchingType.Overapproximation }]
			];

			describe.each(testCases)('args: %s, result: %s', (args, expected) => {
				testIntervalDomain(`
					x <- round(${args.join(', ')})
				`, {
					'1@x': expected
				});
			});
		});

		describe('sign', () => {
			const testCases: [argument: string[], expected: IntervalSlicingCriterionExpected][] = [
				[[], { domain: IntervalTests.bottom() }],
				[['0.2851', '2'], { domain: IntervalTests.bottom() }],
				[['0'], { domain: IntervalTests.scalar(0) }],
				[['-1'], { domain: IntervalTests.scalar(-1) }],
				[['4'], { domain: IntervalTests.scalar(1) }],
				[['ifelse(c, -4.2, 2.5)'], { domain: IntervalTests.interval(-1, 1) }],
				[['ifelse(c, 0.1112, 5.2)'], { domain: IntervalTests.scalar(1) }],
				[['ifelse(c, 0, 2)'], { domain: IntervalTests.interval(0, 1) }],
				[['ifelse(c, -12, 0)'], { domain: IntervalTests.interval(-1, 0) }],
				[['ifelse(c, -200, -0.01)'], { domain: IntervalTests.scalar(-1) }]
			];

			describe.each(testCases)('args: %s, result: %s', (args, expected) => {
				testIntervalDomain(`
					x <- sign(${args.join(', ')})
				`, {
					'1@x': expected
				});
			});
		});

		describe('sqrt', () => {
			const testCases: [argument: string[], expected: IntervalSlicingCriterionExpected][] = [
				[[], { domain: IntervalTests.bottom() }],
				[['0.2851', '2'], { domain: IntervalTests.bottom() }],
				[['0'], { domain: IntervalTests.scalar(0) }],
				[['-1'], { domain: IntervalTests.top() }],
				[['4'], { domain: IntervalTests.scalar(2) }],
				[['ifelse(c, -4.2, 2.5)'], { domain: IntervalTests.top() }],
				[['ifelse(c, 0.1112, 5.2)'], { domain: IntervalTests.interval(Math.sqrt(0.1112), Math.sqrt(5.2)) }],
				[['ifelse(c, 0, 2)'], { domain: IntervalTests.interval(0, Math.sqrt(2)) }],
				[['ifelse(c, 4, 9)'], { domain: IntervalTests.interval(2, 3) }],
			];

			describe.each(testCases)('args: %s, result: %s', (args, expected) => {
				testIntervalDomain(`
					x <- sqrt(${args.join(', ')})
				`, {
					'1@x': expected
				});
			});
		});

		describe('runif', () => {
			const testCases: [argument: string[], expected: IntervalSlicingCriterionExpected][] = [
				[[], { domain: IntervalTests.bottom() }],
				[['Hallo'], { domain: IntervalTests.bottom(), matching: DomainMatchingType.Overapproximation }],
				[['-1'], { domain: IntervalTests.bottom() }],
				[['2, x=3'], { domain: IntervalTests.bottom() }],
				[['0'], { domain: IntervalTests.top() }],
				[['0.2851', '2', '5'], { domain: IntervalTests.top() }],
				[['n=2, 3'], { domain: IntervalTests.top() }],
				[['4'], { domain: IntervalTests.top() }],
				[['n=1, -3'], { domain: IntervalTests.interval(-3, 0) }],
				[['1', 'ifelse(c, -4.2, 2.5)', '4'], { domain: IntervalTests.interval(-4.2, 4) }],
				[['1', 'ifelse(c, -2, 3)', 'ifelse(c, 6, 7)'], { domain: IntervalTests.interval(-2, 7) }],
				[['1', 'max=3'], { domain: IntervalTests.interval(0, 3) }],
				[['1', 'max=3', 'min=-1'], { domain: IntervalTests.interval(-1, 3) }],
				[['max=3', '1', 'min=-1'], { domain: IntervalTests.interval(-1, 3) }],
				[['max=3', 'min=-1', 'n=1'], { domain: IntervalTests.interval(-1, 3) }],
				[['1', 'ifelse(c, 0.1112, 5.2)', 'ifelse(c, 3, 6)'], { domain: IntervalTests.interval(0.1112, 6), matching: DomainMatchingType.Overapproximation }],
			];

			describe.each(testCases)('args: %s, result: %s', (args, expected) => {
				testIntervalDomain(`
					x <- runif(${args.join(', ')})
				`, {
					'1@x': expected
				});
			});
		});

		describe('as.numeric', () => {
			const testCases: [argument: string[], expected: IntervalSlicingCriterionExpected][] = [
				[[], { domain: IntervalTests.top() }],
				[['Hallo'], { domain: IntervalTests.bottom(), matching: DomainMatchingType.Overapproximation }],
				[['n=2, 3'], { domain: IntervalTests.bottom() }],
				[['2, x=3'], { domain: IntervalTests.scalar(2) }],
				[['x=2, 3'], { domain: IntervalTests.scalar(2) }],
				[['0.2851', '2'], { domain: IntervalTests.scalar(0.2851) }],
				[['0'], { domain: IntervalTests.scalar(0) }],
				[['-1'], { domain: IntervalTests.scalar(-1) }],
				[['4'], { domain: IntervalTests.scalar(4) }],
				[['ifelse(c, -4.2, 2.5)'], { domain: IntervalTests.interval(-4.2, 2.5) }],
				[['ifelse(c, 0.1112, 5.2)'], { domain: IntervalTests.interval(0.1112, 5.2) }],
				[['ifelse(c, 0, 2)'], { domain: IntervalTests.interval(0, 2) }],
				[['ifelse(c, 4, 9)'], { domain: IntervalTests.interval(4, 9) }],
			];

			describe.each(testCases)('args: %s, result: %s', (args, expected) => {
				testIntervalDomain(`
					x <- as.numeric(${args.join(', ')})
				`, {
					'1@x': expected
				});
			});
		});

		describe('as.integer', () => {
			const testCases: [argument: string[], expected: IntervalSlicingCriterionExpected][] = [
				[[], { domain: IntervalTests.top() }],
				[['Hallo'], { domain: IntervalTests.bottom(), matching: DomainMatchingType.Overapproximation }],
				[['n=2, 3'], { domain: IntervalTests.bottom() }],
				[['2, x=3'], { domain: IntervalTests.scalar(2) }],
				[['x=2, 3'], { domain: IntervalTests.scalar(2) }],
				[['0.2851', '2'], { domain: IntervalTests.scalar(0) }],
				[['0'], { domain: IntervalTests.scalar(0) }],
				[['-1'], { domain: IntervalTests.scalar(-1) }],
				[['4'], { domain: IntervalTests.scalar(4) }],
				[['ifelse(c, -4.2, 2.5)'], { domain: IntervalTests.interval(-4, 2) }],
				[['ifelse(c, 0.1112, 5.2)'], { domain: IntervalTests.interval(0, 5) }],
				[['ifelse(c, 0, 2)'], { domain: IntervalTests.interval(0, 2) }],
				[['ifelse(c, -1.678392, -9.2313)'], { domain: IntervalTests.interval(-9, -1) }],
			];

			describe.each(testCases)('args: %s, result: %s', (args, expected) => {
				testIntervalDomain(`
					x <- as.integer(${args.join(', ')})
				`, {
					'1@x': expected
				});
			});
		});

		describe('sin', () => {
			const testCases: [argument: string[], expected: IntervalSlicingCriterionExpected][] = [
				[[], { domain: IntervalTests.bottom() }],
				[['Hallo'], { domain: IntervalTests.bottom(), matching: DomainMatchingType.Overapproximation }],
				[['2, 3'], { domain: IntervalTests.bottom() }],
				[['2'], { domain: IntervalTests.scalar(Math.sin(2)), matching: DomainMatchingType.Overapproximation }],
				[['0'], { domain: IntervalTests.scalar(Math.sin(0)), matching: DomainMatchingType.Overapproximation }],
				[['-1.5'], { domain: IntervalTests.scalar(Math.sin(-1)), matching: DomainMatchingType.Overapproximation }],
				[['ifelse(c, -5, 5)'], { domain: IntervalTests.interval(-1, 1) }],
				[['ifelse(c, 0, 0.5)'], { domain: IntervalTests.interval(Math.sin(0), Math.sin(0.5)), matching: DomainMatchingType.Overapproximation }],
				[['ifelse(c, -0.1112, 0.1)'], { domain: IntervalTests.interval(Math.sin(-0.1112), Math.sin(0.1)), matching: DomainMatchingType.Overapproximation }],
			];

			describe.each(testCases)('args: %s, result: %s', (args, expected) => {
				testIntervalDomain(`
					x <- sin(${args.join(', ')})
				`, {
					'1@x': expected
				});
			});
		});

		describe('cos', () => {
			const testCases: [argument: string[], expected: IntervalSlicingCriterionExpected][] = [
				[[], { domain: IntervalTests.bottom() }],
				[['Hallo'], { domain: IntervalTests.bottom(), matching: DomainMatchingType.Overapproximation }],
				[['2, 3'], { domain: IntervalTests.bottom() }],
				[['2'], { domain: IntervalTests.scalar(Math.cos(2)), matching: DomainMatchingType.Overapproximation }],
				[['0'], { domain: IntervalTests.scalar(Math.cos(0)), matching: DomainMatchingType.Overapproximation }],
				[['-1.5'], { domain: IntervalTests.scalar(Math.cos(-1)), matching: DomainMatchingType.Overapproximation }],
				[['ifelse(c, -5, 5)'], { domain: IntervalTests.interval(-1, 1) }],
				[['x=ifelse(c, -5, 5)'], { domain: IntervalTests.interval(-1, 1) }],
				[['ifelse(c, 0, 0.5)'], { domain: IntervalTests.interval(Math.cos(0.5), Math.cos(0)), matching: DomainMatchingType.Overapproximation }],
				[['ifelse(c, -0.1112, 0.1)'], { domain: IntervalTests.interval(Math.cos(-0.1112), Math.cos(0)), matching: DomainMatchingType.Overapproximation }],
			];

			describe.each(testCases)('args: %s, result: %s', (args, expected) => {
				testIntervalDomain(`
					x <- cos(${args.join(', ')})
				`, {
					'1@x': expected
				});
			});
		});

		describe('nrow', () => {
			const testCases: [argument: string[], expected: IntervalSlicingCriterionExpected][] = [
				[[], { domain: IntervalTests.bottom() }],
				[['Hallo'], { domain: IntervalTests.top(), matching: DomainMatchingType.Underapproximation }],
				[['2, 3'], { domain: IntervalTests.bottom() }],
				[['data.frame(), data.frame()'], { domain: IntervalTests.bottom() }],
				[['2'], { domain: IntervalTests.top() }],
				[['data.frame(c(1,2,3), c(1,2))'], { domain: IntervalTests.scalar(3), matching: DomainMatchingType.Overapproximation }],
				[['data.frame(c(1), c(2,3), c(1,2,3,4))'], { domain: IntervalTests.scalar(4), matching: DomainMatchingType.Overapproximation }],
			];

			describe.each(testCases)('args: %s, result: %s', (args, expected) => {
				testIntervalDomain(`
					x <- nrow(${args.join(', ')})
				`, {
					'1@x': expected
				});
			});
		});

		describe('NROW', () => {
			const testCases: [argument: string[], expected: IntervalSlicingCriterionExpected][] = [
				[[], { domain: IntervalTests.bottom() }],
				[['Hallo'], { domain: IntervalTests.scalar(1), matching: DomainMatchingType.Overapproximation }],
				[['2, 3'], { domain: IntervalTests.bottom() }],
				[['data.frame(), data.frame()'], { domain: IntervalTests.bottom() }],
				[['2'], { domain: IntervalTests.scalar(1) }],
				[['c(1,2,3)'], { domain: IntervalTests.scalar(3), matching: DomainMatchingType.Overapproximation }],
				[['data.frame(c(1,2,3), c(1,2))'], { domain: IntervalTests.scalar(3), matching: DomainMatchingType.Overapproximation }],
				[['data.frame(c(1), c(2,3), c(1,2,3,4))'], { domain: IntervalTests.scalar(4), matching: DomainMatchingType.Overapproximation }],
			];

			describe.each(testCases)('args: %s, result: %s', (args, expected) => {
				testIntervalDomain(`
					x <- NROW(${args.join(', ')})
				`, {
					'1@x': expected
				});
			});
		});

		describe('ncol', () => {
			const testCases: [argument: string[], expected: IntervalSlicingCriterionExpected][] = [
				[[], { domain: IntervalTests.bottom() }],
				[['Hallo'], { domain: IntervalTests.top(), matching: DomainMatchingType.Underapproximation }],
				[['2, 3'], { domain: IntervalTests.bottom() }],
				[['data.frame(), data.frame()'], { domain: IntervalTests.bottom() }],
				[['2'], { domain: IntervalTests.top() }],
				[['data.frame(c(1,2,3), c(1,2))'], { domain: IntervalTests.scalar(2), matching: DomainMatchingType.Overapproximation }],
				[['data.frame(c(1), c(2,3), c(1,2,3,4))'], { domain: IntervalTests.scalar(3), matching: DomainMatchingType.Overapproximation }],
			];

			describe.each(testCases)('args: %s, result: %s', (args, expected) => {
				testIntervalDomain(`
					x <- ncol(${args.join(', ')})
				`, {
					'1@x': expected
				});
			});
		});

		describe('NCOL', () => {
			const testCases: [argument: string[], expected: IntervalSlicingCriterionExpected][] = [
				[[], { domain: IntervalTests.bottom() }],
				[['Hallo'], { domain: IntervalTests.scalar(1), matching: DomainMatchingType.Overapproximation }],
				[['2, 3'], { domain: IntervalTests.bottom() }],
				[['data.frame(), data.frame()'], { domain: IntervalTests.bottom() }],
				[['2'], { domain: IntervalTests.scalar(1) }],
				[['c(1,2,3)'], { domain: IntervalTests.scalar(1), matching: DomainMatchingType.Overapproximation }],
				[['data.frame(c(1,2,3), c(1,2))'], { domain: IntervalTests.scalar(2), matching: DomainMatchingType.Overapproximation }],
				[['data.frame(c(1), c(2,3), c(1,2,3,4))'], { domain: IntervalTests.scalar(3), matching: DomainMatchingType.Overapproximation }],
			];

			describe.each(testCases)('args: %s, result: %s', (args, expected) => {
				testIntervalDomain(`
					x <- NCOL(${args.join(', ')})
				`, {
					'1@x': expected
				});
			});
		});

		describe.each([
			['min', Math.min],
			['mean', (...values: number[]) => {
				if(values.length === 0) {
					return 0;
				}
				return values.reduce((a, b) => a + b, 0) / values.length;
			}],
			['median', (...values: number[]) => {
				if(values.length === 0) {
					return 0;
				}
				const sorted = values.slice().sort((a, b) => a - b);
				const mid = Math.floor(sorted.length / 2);
				if(sorted.length % 2 === 0) {
					return (sorted[mid - 1] + sorted[mid]) / 2;
				} else {
					return sorted[mid];
				}
			}]
		])('%s', (rFnName, jsFn) => {
			const testCases: [argument: string[], expected: IntervalSlicingCriterionExpected][] = [
				[[], { domain: IntervalTests.bottom() }],
				[['2'], { domain: IntervalTests.scalar(jsFn(2)), matching: DomainMatchingType.Overapproximation }],
				[['1', '2', '3'], { domain: IntervalTests.scalar(jsFn(1, 2, 3)), matching: DomainMatchingType.Overapproximation }],
				[['1', 'NA', '3'], { domain: IntervalTests.top() }],
				[['1', 'NA', '3', 'na.rm=TRUE'], { domain: IntervalTests.scalar(jsFn(1, 3)), matching: DomainMatchingType.Overapproximation }],
				[['c(1,2,3)'], { domain: IntervalTests.scalar(jsFn(1, 2, 3)), matching: DomainMatchingType.Overapproximation }],
				[['c(1,2,3)', 'na.rm=TRUE'], { domain: IntervalTests.scalar(jsFn(1, 2, 3)), matching: DomainMatchingType.Overapproximation }]
			];

			describe.each(testCases)('args: %s, result: %s', (args, expected) => {
				testIntervalDomain(`
					x <- ${rFnName}(${args.join(', ')})
				`, {
					'1@x': expected
				});
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
		describe('and semantics', () => {
			testIntervalDomain(`
				x <- ifelse(c, 1, 3)
				y <- 2
				z <- ifelse(c, 2, 4)
				
				if(x == y && x == z) {
					print(x, y, z)
				} else {
					print(x, y, z)
				}
			`, {
				'1@x': { domain: IntervalTests.interval(1, 3) },
				'2@y': { domain: IntervalTests.scalar(2) },
				'3@z': { domain: IntervalTests.interval(2, 4) },
				'6@x': { domain: IntervalTests.scalar(2) },
				'6@y': { domain: IntervalTests.scalar(2) },
				'6@z': { domain: IntervalTests.scalar(2), matching: DomainMatchingType.Overapproximation },
				'8@x': { domain: IntervalTests.interval(1, 3) },
				'8@y': { domain: IntervalTests.scalar(2) },
				'8@z': { domain: IntervalTests.interval(2, 4) },
			});
		});

		describe('or semantics', () => {
			testIntervalDomain(`
				x <- ifelse(c, 1, 3)
				y <- 2
				z <- ifelse(c, 2, 4)
				
				if(x == y || x == z) {
					print(x, y, z)
				} else {
					print(x, y, z)
				}
			`, {
				'1@x': { domain: IntervalTests.interval(1, 3) },
				'2@y': { domain: IntervalTests.scalar(2) },
				'3@z': { domain: IntervalTests.interval(2, 4) },
				'6@x': { domain: IntervalTests.interval(2, 3) },
				'6@y': { domain: IntervalTests.scalar(2) },
				'6@z': { domain: IntervalTests.interval(2, 4) },
				'8@x': { domain: IntervalTests.interval(1, 3) },
				'8@y': { domain: IntervalTests.scalar(2) },
				'8@z': { domain: IntervalTests.interval(2, 4) },
			});
		});

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

		describe('is.finite', () => {
			const testCases: [arguments: string, expected: IntervalSlicingCriterionExpected][] = [
				// Copy the test cases from below
				['""', { domain: IntervalTests.bottom(), matching: DomainMatchingType.Overapproximation }],
				['c(1,2,3)', { domain: IntervalTests.top() }],
				['Inf', { domain: IntervalTests.bottom() }],
				['-Inf', { domain: IntervalTests.bottom() }],
				['1', { domain: IntervalTests.scalar(1) }],
				['-1', { domain: IntervalTests.scalar(-1) }],
				['ifelse(c, -5, 2)', { domain: IntervalTests.interval(-5, 2) }],
				['ifelse(c, -Inf, 3)', { domain: IntervalTests.interval(Number.NEGATIVE_INFINITY, 3) }],
				['ifelse(c, -Inf, Inf)', { domain: IntervalTests.interval(Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY) }]
			];

			describe.each(testCases)('arg: %s, result: %s', (arg, expected) => {
				testIntervalDomain(`
					x <- ${arg}
					if(is.finite(x)) {
						x
					}
				`, {
					'3@x': expected
				});
			});
		});

		describe('is.infinite', () => {
			const testCases: [arguments: string, expected: IntervalSlicingCriterionExpected][] = [
				// Copy the test cases from below
				['""', { domain: IntervalTests.bottom(), matching: DomainMatchingType.Overapproximation }],
				['c(1,2,3)', { domain: IntervalTests.bottom(), matching: DomainMatchingType.Overapproximation }],
				['1', { domain: IntervalTests.bottom() }],
				['-1', { domain: IntervalTests.bottom() }],
				['ifelse(c, -5, 2)', { domain: IntervalTests.bottom() }],
				['Inf', { domain: IntervalTests.scalar(Number.POSITIVE_INFINITY) }],
				['-Inf', { domain: IntervalTests.scalar(Number.NEGATIVE_INFINITY) }],
				['ifelse(c, -Inf, 3)', { domain: IntervalTests.scalar(Number.NEGATIVE_INFINITY) }],
				['ifelse(c, Inf, 3)', { domain: IntervalTests.scalar(Number.POSITIVE_INFINITY) }],
				['ifelse(c, -Inf, Inf)', { domain: IntervalTests.interval(Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY) }]
			];

			describe.each(testCases)('arg: %s, result: %s', (arg, expected) => {
				testIntervalDomain(`
					x <- ${arg}
					if(is.infinite(x)) {
						x
					}
				`, {
					'3@x': expected
				});
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

	describe('unknown side effects', { fails: true }, () => {
		testIntervalDomain(`
			x <- length(a)
			if (x < 3) {
				x = x-1
				assign(paste("timepoint_", count, sep=""), df$precincts.results)
				assign(paste("x", "", sep=""), 5)
				x
			}
			x
		`, {
			'6@x': { domain: IntervalTests.scalar(5) },
			'8@x': { domain: IntervalTests.interval(3, Infinity) },
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
				'4@x': { domain: IntervalTests.interval(1, 9) },
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
				'3@x': { domain: IntervalTests.interval(1, 3) },
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
				'3@x': { domain: IntervalTests.interval(1, 3) },
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

	describe('Fixpoint iteration for loop with function call with unknown side effect', () => {
		// Problem 1: Fixpoint iteration is not applied or at least only for the part after the call with unknown side effect.
		// Problem 2: onVariableDefinition asserts that a variable has not been assigned before if it is not present in the current state.
		//            However, as the assigned variable might be set to top in the current state (being undefined), we have to check the trace instead.
		//            This way, the assigned variable does not appear as potential orign in the second loop iteration for the case that x <- x + 1.
		// Problem 3: Neither assign nor paste are declared as function with unknown side effects which might cause underapproximations.

		// Potential fix for 1: We have to check whether any variable in the loop body has changed to assess whether we need
		//                      to re-run the loop, so that not only the state after the loop is a correct overapproximation
		//                      but also all states within the loop are a correct overapproximation.
		//                      Potentially it might be sufficient to just run the loop one more time instead or alternatively
		//                      only check those states right before the function call with unknown side effect as they should
		//                      contain all changed information of the predecessors
		// Fix for 2: Simply replace "this.currentState.get(vertex.id) === undefined" with "this.trace.get(vertex.id) === undefined"

		describe('Remaining issues', { fails: true }, () => {
			// Iterates only one time over the loop as load() clears the trace (unknown sideeffect),
			// so the old and new state are the same (empty) after the first iteration
			// Therefore, underapproximates to [1, 1] in l.3 when it should overapproximate to Top
			// (or be [1, 4] if load does not override x).
			testIntervalDomain(`
				x <- 0
				while (x <= 3) {
					x <- x + 1
					load("test.rda")
				}
			`, {
				'3@x': { domain: IntervalTests.interval(1, 4), matching: DomainMatchingType.Overapproximation },
			});

			// Due to the paste call in the assign, flowr cannot resolve that x is reassigned to -1.
			// The absint framework does not label assign nor paste as function with unknown side effect.
			// Consequently, the framework ignores this assignment and infers [1, 4] for l.3 when it should be [0, 1]:
			// 1 from the first iteration where x <- 0 + 1 and 0 from the following iterations where x <- -1 + 1.
			testIntervalDomain(`
				x <- 0
				while (x <= 3) {
					x <- x + 1
					assign(paste("x"), -1)
				}
			`, {
				'3@x': { domain: IntervalTests.interval(0, 1) },
			});
		});

		// Iterates two times over the loop as the y <- 1 assignment introduces new information after the load(),
		// which stabilizes after one additional iteration.
		// Additionally, the origin of the right x in l.3 does not resolve to the left x in l.3 in the second iteration,
		// as the onVariableDefinition labels the left x as unassigned in the second iteration as the state has been
		// cleared, although it has been assigned in the iteration before
		// (this can be fixed by checking the trace instead of the currentState in the onVariableDefinition function).
		// Without the fix, underapproximates to [1, 1] when it should overapproximate to Top
		// (or be [1, 4] if load does not override x).
		// With the fix, overapproximate to Top in the second iteration.
		testIntervalDomain(`
			x <- 0
			while (x <= 3) {
				x <- x + 1
				load("test.rda")
				y <- 1
			}
		`, {
			'3@x': { domain: IntervalTests.interval(1, 4), matching: DomainMatchingType.Overapproximation },
		});
	});
});
