import { assert } from 'vitest';
import type { SlicingCriterion } from '../../../src/slicing/criterion/parse';
import { FlowrAnalyzerBuilder } from '../../../src/project/flowr-analyzer-builder';
import { Record } from '../../../src/util/record';
import { getInferredValueForCriterion } from '../abstract-interpretation/inference';
import { guard } from '../../../src/util/assert';
import type { AnyPredefinedAnalysisName } from '../../../src/taint-analysis/predefined/predefined';
import { predefinedTaintAnalyses } from '../../../src/taint-analysis/predefined/predefined';
import type { AnyTaintAnalysis } from '../../../src/taint-analysis/builder/taint-analysis';
import type { TaintAnalysisDefinition } from '../../../src/taint-analysis/builder/taint-analysis-definition';

export type TaintAnalysisExpectation = Record<SlicingCriterion, symbol | undefined>;

/**
 * Helper function for conducting a singular taint analysis and asserting the expected taints.
 * @param code - The code to analyse
 * @param analysis - Taint analysis definition
 * @param expectation - Expected taints
 */
export async function testTaintAnalysis(code: string, analysis: TaintAnalysisDefinition<string>, expectation: TaintAnalysisExpectation) {
	await testTaintAnalyses(code, new Set([[analysis.name, analysis, expectation]]));
}

/**
 * Helper function for conducting a singular predefined taint analysis and asserting the expected taints.
 * @param code - The code to analyse
 * @param name - Taint analysis name
 * @param expectation - Expected taints
 */
export async function testPredefinedTaintAnalysis(code: string, name: AnyPredefinedAnalysisName, expectation: TaintAnalysisExpectation) {
	await testTaintAnalysis(code, predefinedTaintAnalyses[name], expectation);
}

/**
 * Helper function for conducting a multiple taint analyses and asserting the expected taints per analysis.
 * @param code - The code to analyse
 * @param analyses - Map of analyses and their corresponding expectations
 */
export async function testTaintAnalyses(code: string, analyses: Set<[string, TaintAnalysisDefinition<string>, TaintAnalysisExpectation]>) {
	const analyzer = await new FlowrAnalyzerBuilder()
		.setEngine('tree-sitter')
		.build();

	analyzer.addRequest(code.trim());
	const analysis = analyzer.taint() as unknown as AnyTaintAnalysis;

	for(const [_name, def, _expectation] of analyses) {
		analysis.add(def);
	}

	const results = await analysis.run();

	assert.equal(results.size, analyses.size);

	for(const [name, def, expected] of analyses) {
		const result = results.get(name);
		guard(result, 'Expected taint analysis scale results are missing');

		for(const [criterion, expectedValue] of Record.entries(expected)) {
			const actualDomain = getInferredValueForCriterion(result.visitor, criterion);
			const expectedDomain = def.domain.create(expectedValue);
			if(expectedValue === undefined) {
				assert.ok(actualDomain?.value === undefined, `Expected inferred taint for criterion "${criterion}" to be undefined`);
			} else {
				assert.ok(actualDomain?.equals(expectedDomain),
					`Expected inferred taint for criterion "${criterion}" to be ${expectedValue.toString()}, but got ${actualDomain?.toString()}`);
			}
		}
	}
}