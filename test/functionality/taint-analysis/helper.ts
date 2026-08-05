import { assert } from 'vitest';
import type { SlicingCriterion } from '../../../src/slicing/criterion/parse';
import { FlowrAnalyzerBuilder } from '../../../src/project/flowr-analyzer-builder';
import { Record } from '../../../src/util/record';
import {
	getInferredValueForCriterionFromStateDomain
} from '../abstract-interpretation/inference';
import { guard } from '../../../src/util/assert';
import type {
	AnyPredefinedTaintAnalysisName
} from '../../../src/taint-analysis/predefined/predefined';
import { predefinedTaintAnalyses } from '../../../src/taint-analysis/predefined/predefined';
import type { TaintAnalysisDefinition } from '../../../src/taint-analysis/builder/taint-analysis-definition';
import { CompositeTaintAnalysisDefinition } from '../../../src/taint-analysis/builder/taint-analysis-definition';
import type { MultiValueDomain } from '../../../src/abstract-interpretation/domains/multi-value-state-domain';
import type { TaintProduct } from '../../../src/taint-analysis/composite-taint-visitor';

export type TaintAnalysisExpectation = Record<SlicingCriterion, symbol | undefined>;

/** Expectation for a composite taint analysis mapping each criterion to the expected taint per component analysis. */
export type CompositeTaintExpectation = Record<SlicingCriterion, Record<string, symbol | undefined>>;

/**
 * Helper function for conducting a singular taint analysis and asserting the expected taints.
 * @param code - The code to analyse
 * @param analysis - Taint analysis definition (single or composite)
 * @param expectation - Expected taints
 */
export async function testTaintAnalysis(code: string, analysis: TaintAnalysisDefinition | CompositeTaintAnalysisDefinition<string>, expectation: TaintAnalysisExpectation) {
	if(analysis instanceof CompositeTaintAnalysisDefinition) {
		throw new TypeError('testTaintAnalysis does not support composite analyses. Use testCompositeTaintAnalysis instead.');
	}
	await testTaintAnalyses(code, new Set([[analysis.name, analysis, expectation]]));
}

/**
 * Helper function for conducting a singular predefined taint analysis and asserting the expected taints.
 * @param code - The code to analyse
 * @param name - Taint analysis name
 * @param expectation - Expected taints
 */
export async function testPredefinedTaintAnalysis(code: string, name: AnyPredefinedTaintAnalysisName, expectation: TaintAnalysisExpectation) {
	await testTaintAnalysis(code, predefinedTaintAnalyses[name], expectation);
}

/**
 * Helper function for conducting a multiple taint analyses and asserting the expected taints per analysis.
 * @param code - The code to analyse
 * @param analyses - Map of analyses and their corresponding expectations
 */
export async function testTaintAnalyses(code: string, analyses: Set<[string, TaintAnalysisDefinition, TaintAnalysisExpectation]>) {
	const analyzer = await new FlowrAnalyzerBuilder()
		.setEngine('tree-sitter')
		.build();

	analyzer.addRequest(code.trim());
	const analysis = analyzer.taint<string[]>();

	for(const [_name, def, _expectation] of analyses) {
		analysis.add(def);
	}

	const results = await analysis.run();

	assert.equal(results.size, analyses.size);

	for(const [name, def, expected] of analyses) {
		const result = results.get(name);
		guard(result, 'Expected taint analysis scale results are missing');

		for(const [criterion, expectedValue] of Record.entries(expected)) {
			const actualDomain = getInferredValueForCriterionFromStateDomain((await analyzer.normalize()).idMap, result.domains, criterion);
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

/**
 * Helper function for conducting a composite taint analysis and asserting the expected per-component taints.
 * @param code - The code to analyse
 * @param composite - The composite taint analysis definition (created via {@link TaintAnalysisDefinition.compose})
 * @param expectation - Expected taints per component analysis for each criterion
 */
export async function testCompositeTaintAnalysis(
	code: string,
	composite: CompositeTaintAnalysisDefinition<string>,
	expectation: CompositeTaintExpectation
) {
	const analyzer = await new FlowrAnalyzerBuilder()
		.setEngine('tree-sitter')
		.build();

	analyzer.addRequest(code.trim());
	const analysis = analyzer.taint<string[]>();
	analysis.addComposite(composite);

	const results = await analysis.run();
	const result = results.get(composite.name);
	guard(result, 'Expected composite taint analysis results are missing');

	for(const [criterion, expectedComponents] of Record.entries(expectation)) {
		const product = getInferredValueForCriterionFromStateDomain((await analyzer.normalize()).idMap, result.domains, criterion) as MultiValueDomain<TaintProduct>;

		for(const [name, expectedValue] of Record.entries(expectedComponents)) {
			const actualValue = product?.value[name]?.value;
			assert.equal(actualValue, expectedValue,
				`Expected inferred taint for criterion "${criterion}" of component "${name}" to be ${String(expectedValue?.toString())}, but got ${String(actualValue?.toString())}`);
		}
	}
}