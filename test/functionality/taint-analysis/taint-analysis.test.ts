import { describe } from 'vitest';
import { TaintAnalysisDefinition } from '../../../src/taint-analysis/builder/taint-analysis-definition';
import { Identifier } from '../../../src/dataflow/environments/identifier';
import { FiniteDomainBuilder } from '../../../src/taint-analysis/builder/domain';
import { Bottom, Top } from '../../../src/abstract-interpretation/domains/lattice';
import type { TaintAnalysisExpectation } from './helper';
import { testTaintAnalysis } from './helper';

const taint1 = Symbol('taint1');
const taint2 = Symbol('taint2');
const taint3 = Symbol('taint3');

const lattice = new FiniteDomainBuilder()
	.addElements(taint1, taint2, taint3)
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


const testArgAnalysis =
	async(testCases: { code: string[], expectation: TaintAnalysisExpectation }[]) => {
		for(const testCase of testCases) {
			for(const snippet of testCase.code) {
				await testTaintAnalysis(snippet, argumentTaintAnalysis, testCase.expectation);
			}
		}
	};

describe('Taint Analysis', () => {
	describe('Argument Evaluation', async() => {
		await testArgAnalysis([
			{
				code: [
					//'x <- myTestFunc(x)',
					//'x <- myTestFunc(x, T, T)',
					'x <- myTestFunc(x, myArg1=True, myArg2=True)',
					//'x <- myTestFunc(x, myArg2=T, myArg1=T)',
				],
				expectation: {
					'1@x': taint3
				}
			},
			{
				code: [
					//'x <- myTestFunc(x, T, F)',
					//'x <- myTestFunc(x, myArg1=T, myArg2=F)',
					//'x <- myTestFunc(x, myArg2=F, myArg1=T)',
				],
				expectation: {
					'1@x': taint1
				}
			},
			{
				code: [
					//'x <- myTestFunc(x, F, T)',
					//'x <- myTestFunc(x, myArg1=F, myArg2=T)',
					//'x <- myTestFunc(x, myArg2=T, myArg1=F)',
				],
				expectation: {
					'1@x': taint2
				}
			},
			{
				code: [
					//'x <- myTestFunc(x, F, F)',
					//'x <- myTestFunc(x, myArg1=F, myArg2=F)',
					//'x <- myTestFunc(x, myArg2=F, myArg1=F)',
				],
				expectation: {
					'1@x': Top
				}
			}
		]);
	});
});