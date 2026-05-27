import { assert, test } from 'vitest';
import { scaleDomain } from '../../../src/taint-analysis/predefined/scale-analysis';
import type { SlicingCriterion } from '../../../src/slicing/criterion/parse';
import { FlowrAnalyzerBuilder } from '../../../src/project/flowr-analyzer-builder';
import { Record } from '../../../src/util/record';
import { getInferredValueForCriterion } from '../abstract-interpretation/inference';
import { guard } from '../../../src/util/assert';
import type { PredefinedTaintAnalysis } from '../../../src/taint-analysis/predefined/predefined';
import type { TaintAnalysis } from '../../../src/taint-analysis/builder/taint-analysis';
import type { TaintAnalysisDefinition } from '../../../src/taint-analysis/builder/taint-analysis-definition';

export type TaintAnalysisExpectation = Record<SlicingCriterion, symbol | undefined>;

/**
 * Helper function for conducting a singular taint analysis and asserting the expected taints.
 * @param code - The code to analyse
 * @param analysis - Taint analysis definition
 * @param expectation - Expected taints
 */
export async function testTaintAnalysis(code: string, analysis: TaintAnalysisDefinition<string>, expectation: TaintAnalysisExpectation) {
	await testTaintAnalyses(code, [analysis], new Map([[analysis.name, expectation]]));
}

/**
 * Helper function for conducting a singular predefined taint analysis and asserting the expected taints.
 * @param code - The code to analyse
 * @param name - Taint analysis name
 * @param expectation - Expected taints
 */
export async function testPredefinedTaintAnalysis(code: string, name: PredefinedTaintAnalysis, expectation: TaintAnalysisExpectation) {
	await testPredefinedTaintAnalyses(code, new Map([[name, expectation]]));
}

// TODO Simplify/consolidate the following two functions
/**
 * Helper function for conducting a multiple taint analyses and asserting the expected taints per analysis.
 * @param code - The code to analyse
 * @param analyses - List of taint analysis definitions
 * @param expectations - Expected results of the taint analyses
 */
export async function testTaintAnalyses(code: string, analyses: TaintAnalysisDefinition<string>[], expectations: Map<string, TaintAnalysisExpectation>) {
	const analyzer = await new FlowrAnalyzerBuilder()
		.setEngine('tree-sitter')
		.build();

	analyzer.addRequest(code.trim());
	const analysis = analyzer.taint() as unknown as TaintAnalysis<[string]>;

	for(const def of analyses) {
		analysis.add(def);
	}

	const result = await analysis.run();

	assert.equal(result.size, expectations.size);

	for(const [name, expected] of expectations.entries()) {
		const visitor = result.get(name);
		guard(visitor, 'Expected taint analysis scale results are missing');

		for(const [criterion, expectation] of Record.entries(expected)) {
			const actual = getInferredValueForCriterion(visitor, criterion);
			if(actual && expectation) {
				const inferred = scaleDomain.create(expectation);
				assert.ok(actual.equals(inferred),
					`Expected inferred taint for criterion "${criterion} to be ${expectation.toString()}, but got ${actual.toString()}`);
			} else {
				assert.ok(actual === undefined && expectation === undefined, `Expected inferred value for criterion "${criterion}" to be ${expectation === undefined ? 'undefined' : 'defined'}, but got ${actual?.toString()}`);
			}
		}
	}
}

/**
 * Helper function for conducting a multiple taint analyses and asserting the expected taints per analysis.
 * @param code - The code to analyse
 * @param analyses - Record of taint analysis names and their expected results
 */
export async function testPredefinedTaintAnalyses(code: string, analyses: Map<PredefinedTaintAnalysis, TaintAnalysisExpectation>) {
	const analyzer = await new FlowrAnalyzerBuilder()
		.setEngine('tree-sitter')
		.build();

	analyzer.addRequest(code.trim());
	const analysis = analyzer.taint() as unknown as TaintAnalysis<[PredefinedTaintAnalysis]>;

	for(const name of analyses.keys()) {
		analysis.addPredefined(name);
	}

	const result = await analysis.run();

	assert.equal(result.size, analyses.size);

	test(code, () => {
		for(const [name, expected] of analyses.entries()) {
			const visitor = result.get(name);
			guard(visitor, 'Expected taint analysis scale results are missing');

			for(const [criterion, expectation] of Record.entries(expected)) {
				const actual = getInferredValueForCriterion(visitor, criterion);

				if(actual && expectation) {
					const inferred = scaleDomain.create(expectation);
					assert.ok(actual.equals(inferred),
						`Expected inferred taint for criterion "${criterion} to be ${expectation.toString()}, but got ${actual.toString()}`);
				} else {
					assert.ok(actual === undefined && expectation === undefined, `Expected inferred value for criterion "${criterion}" to be ${expectation === undefined ? 'undefined' : 'defined'}, but got ${actual?.toString()}`);
				}
			}
		}
	});
}