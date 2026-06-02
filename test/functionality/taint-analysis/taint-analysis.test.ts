import { describe, test } from 'vitest';
import { TaintAnalysisDefinition } from '../../../src/taint-analysis/builder/taint-analysis-definition';
import { Identifier } from '../../../src/dataflow/environments/identifier';
import { FiniteDomainBuilder } from '../../../src/taint-analysis/builder/domain';
import { Bottom, Top } from '../../../src/abstract-interpretation/domains/lattice';
import { testTaintAnalysis } from './helper';

const taint1 = Symbol('taint1');
const taint2 = Symbol('taint2');
const taint3 = Symbol('taint3');

const lattice = new FiniteDomainBuilder()
	.addLeqOrder(Bottom, [taint1, taint2])
	.addLeqOrder(taint1, taint3)
	.addLeqOrder(taint2, taint3)
	.addLeqOrder(taint3, Top)
	.build();

const argumentTaintAnalysis = new TaintAnalysisDefinition('arguments-eval', lattice)
	.to([{
		identifier: Identifier.make('myTestFunc'),
		condition:
			{
				argValues: [
					{ pos: 1, name: 'myArg1', default: true },
					{ pos: 2, name: 'myArg2', default: true },
				],
				argTaints: [
					{ pos: 0 }
				],
				condition: ([arg1, arg2], [taint]) => {
					if(arg1 && arg2) {
						return taint3;
					} else if(arg1) {
						return taint1;
					} else if(arg2) {
						return taint2;
					} else {
						return taint;
					}
				}
			}
	}]);

function argumentTest(
	baseDescription: string,
	arg1Value: boolean | undefined,
	arg2Value: boolean | undefined,
	expectedTaint: symbol | undefined
) {
	const expectedResult = { '1@x': expectedTaint };

	if(arg1Value === undefined && arg2Value === undefined) {
		test(`${baseDescription} (default arguments)`, async() => {
			await testTaintAnalysis('x <- myTestFunc(x)', argumentTaintAnalysis, expectedResult);
		});
	} else {
		const arg1Str = arg1Value !== undefined ? String(arg1Value).toUpperCase() : '';
		const arg2Str = arg2Value !== undefined ? String(arg2Value).toUpperCase() : '';

		test(`${baseDescription} (positional)`, async() => {
			await testTaintAnalysis(`x <- myTestFunc(x, ${arg1Str}, ${arg2Str})`, argumentTaintAnalysis, expectedResult);
		});

		test(`${baseDescription} (explicitly named, order 1)`, async() => {
			await testTaintAnalysis(`x <- myTestFunc(x, myArg1=${arg1Str}, myArg2=${arg2Str})`, argumentTaintAnalysis, expectedResult);
		});

		test(`${baseDescription} (explicitly named, order 2)`, async() => {
			await testTaintAnalysis(`x <- myTestFunc(x, myArg2=${arg2Str}, myArg1=${arg1Str})`, argumentTaintAnalysis, expectedResult);
		});
	}
}

describe('Taint Analysis', () => {
	describe('Argument Evaluation', () => {
		argumentTest('default args', undefined, undefined, taint3);
		argumentTest('both args true', true, true, taint3);
		argumentTest('arg1 true and arg2 false', true, false, taint1);
		argumentTest('arg1 false and arg2 true', false, true, taint2);
		argumentTest('both args false', false, false, undefined);
	});
});