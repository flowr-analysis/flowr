import { describe } from 'vitest';
import { interval, scalar, testIntervalDomain, top } from './interval';
import type { IntervalDomain } from '../../../../src/abstract-interpretation/domains/interval-domain';
import type { AbstractDomainValue } from '../../../../src/abstract-interpretation/domains/abstract-domain';
import { Identifier } from '../../../../src/dataflow/environments/identifier';

describe('Interval Inference', () => {
	const constantNumericTestCases: [value: string, expected: AbstractDomainValue<IntervalDomain> | undefined][] = [
		['0', scalar(0)],
		['5', scalar(5)],
		['2L', scalar(2)],
		['Inf', scalar(Infinity)],
		['-Inf', scalar(-Infinity)],
		['1e10', scalar(1e10)],
		['-1e-5', scalar(-1e-5)],
		['-5', scalar(-5)],
		['-10L', scalar(-10)],
		['3.14', scalar(3.14)],
		['-12.54', scalar(-12.54)],
		['2i', top()],
		['NaN', top()],
	] as const;

	const constantNonNumericTestCases: [value: string, expected: AbstractDomainValue<IntervalDomain> | undefined][] = [
		['"Hallo"', top()],
		['TRUE', top()],
		['FALSE', top()],
		['NULL', top()],
		['"3"', top()],
		['c(1, 2, 3)', top()],
	] as const;

	const binaryOperatorTestCases: [l: string, r: string, expected: Map<Identifier, AbstractDomainValue<IntervalDomain> | undefined>][] = [
		['', '7', new Map([
			[Identifier.make('+'), scalar(7)],
			[Identifier.make('-'), scalar(-7)]
		])],
		['0', '0', new Map([
			[Identifier.make('+'), scalar(0)],
			[Identifier.make('-'), scalar(0)],
			[Identifier.make('*'), scalar(0)]
		])],
		['2.5', '0', new Map([
			[Identifier.make('+'), scalar(2.5)],
			[Identifier.make('-'), scalar(2.5)],
			[Identifier.make('*'), scalar(0)]
		])],
		['0', '-5', new Map([
			[Identifier.make('+'), scalar(-5)],
			[Identifier.make('-'), scalar(5)],
			[Identifier.make('*'), scalar(0)]
		])],
		['2', '5', new Map([
			[Identifier.make('+'), scalar(7)],
			[Identifier.make('-'), scalar(-3)],
			[Identifier.make('*'), scalar(10)]
		])],
		['384', '92', new Map([
			[Identifier.make('+'), scalar(476)],
			[Identifier.make('-'), scalar(292)],
			[Identifier.make('*'), scalar(35328)]
		])],
		['-5', '18', new Map([
			[Identifier.make('+'), scalar(13)],
			[Identifier.make('-'), scalar(-23)],
			[Identifier.make('*'), scalar(-90)]
		])],
		['-15', '-2', new Map([
			[Identifier.make('+'), scalar(-17)],
			[Identifier.make('-'), scalar(-13)],
			[Identifier.make('*'), scalar(30)]
		])],
		['2.7', '1.3', new Map([
			[Identifier.make('+'), scalar(4)],
			[Identifier.make('-'), scalar(1.4)],
			[Identifier.make('*'), scalar(3.51)]
		])],
		['2', '1.3', new Map([
			[Identifier.make('+'), scalar(3.3)],
			[Identifier.make('-'), scalar(0.7)],
			[Identifier.make('*'), scalar(2.6)]
		])],
		['5', '-3', new Map([
			[Identifier.make('+'), scalar(2)],
			[Identifier.make('-'), scalar(8)],
			[Identifier.make('*'), scalar(-15)]
		])],
		['-2', '4', new Map([
			[Identifier.make('+'), scalar(2)],
			[Identifier.make('-'), scalar(-6)],
			[Identifier.make('*'), scalar(-8)]
		])],
		['-3', '-6', new Map([
			[Identifier.make('+'), scalar(-9)],
			[Identifier.make('-'), scalar(3)],
			[Identifier.make('*'), scalar(18)]
		])],
		['1e10', '1e-5', new Map([
			[Identifier.make('+'), scalar(1e10 + 1e-5)],
			[Identifier.make('-'), scalar(1e10 - 1e-5)],
			[Identifier.make('*'), scalar(1e5)]
		])],
		['Inf', '0', new Map([
			[Identifier.make('+'), scalar(Infinity)],
			[Identifier.make('-'), scalar(Infinity)],
			[Identifier.make('*'), top()]
		])],
		['Inf', '5', new Map([
			[Identifier.make('+'), scalar(Infinity)],
			[Identifier.make('-'), scalar(Infinity)],
			[Identifier.make('*'), scalar(Infinity)]
		])],
		['Inf', '-3', new Map([
			[Identifier.make('+'), scalar(Infinity)],
			[Identifier.make('-'), scalar(Infinity)],
			[Identifier.make('*'), scalar(-Infinity)]
		])],
		['87', 'Inf', new Map([
			[Identifier.make('+'), scalar(Infinity)],
			[Identifier.make('-'), scalar(-Infinity)],
			[Identifier.make('*'), scalar(Infinity)]
		])],
		['Inf', 'Inf', new Map([
			[Identifier.make('+'), scalar(Infinity)],
			[Identifier.make('-'), top()],
			[Identifier.make('*'), scalar(Infinity)]
		])],
		['(-Inf)', 'Inf', new Map([
			[Identifier.make('+'), top()],
			[Identifier.make('-'), scalar(-Infinity)],
			[Identifier.make('*'), scalar(-Infinity)]
		])],
		['(-Inf)', '(-Inf)', new Map([
			[Identifier.make('+'), scalar(-Infinity)],
			[Identifier.make('-'), top()],
			[Identifier.make('*'), scalar(Infinity)]
		])],
		['NaN', '3', new Map([
			[Identifier.make('+'), top()],
			[Identifier.make('-'), top()],
			[Identifier.make('*'), top()]
		])],
		['3', '"Hallo"', new Map([
			[Identifier.make('+'), top()],
			[Identifier.make('-'), top()],
			[Identifier.make('*'), top()]
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
			if(expected.has(identifier)) {
				testIntervalDomain(`x <- ${l} ${Identifier.toString(identifier)} ${r}`, { '1@x': expected.get(identifier) });
			}
		}
	});

	describe('length semantics', () => {
		const testCases: [value: string, expected: AbstractDomainValue<IntervalDomain> | undefined][] = [
			['0', scalar(1)],
			['-232', scalar(1)],
			['Inf', scalar(1)],
			['-Inf', scalar(1)],
			['NaN', interval(0, Infinity)],
			['c(1, 2, 3)', interval(0, Infinity)],
			['"Hallo"', interval(0, Infinity)],
			['TRUE', interval(0, Infinity)],
			['NULL', interval(0, Infinity)],
		] as const;

		for(const [value, expected] of testCases) {
			testIntervalDomain(`x <- length(${value})`, { '1@x': expected });
		}
	});

	describe('basic combined calculation', () => {
		testIntervalDomain('x <- 3 + 5 * 7 - 3', { '1@x': scalar(35) });
		testIntervalDomain('x <- (3 + 2) * (7 - 2 * 2)', { '1@x': scalar(15) });
		testIntervalDomain(`
			x <- 3
			y <- -4
			z <- 2.4
			result <- x * 3 - y * z
			zero <- 5 * 0
			invalid <- Inf * zero
		`, {
			'1@x':       scalar(3),
			'2@y':       scalar(-4),
			'3@z':       scalar(2.4),
			'4@result':  scalar(18.6),
			'5@zero':    scalar(0),
			'6@invalid': undefined
		});
	});

	// We cannot process interprocedural calls yet
	describe.skip('user defined function calls return numeric values', () => {
		for(const [value, expected] of constantNumericTestCases.concat(constantNonNumericTestCases)) {
			testIntervalDomain(`
				f <- function() ${value}
				x <- f()
			`, { '2@x': expected });
		}
	});

	// We cannot process condition/while yet
	describe.skip('while semantics', () => {
		testIntervalDomain(`
			x <- 1
			while (x < 10) {
				x <- x + 1
				x <- x - 1
			}
			print(x)
		`, { '3@x': scalar(2), '4@x': scalar(1), '6@x': scalar(10) });
	});
});