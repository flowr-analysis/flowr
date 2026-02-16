import { IntervalDomain } from '../../../../src/abstract-interpretation/domains/interval-domain';
import { FlowrAnalyzerBuilder } from '../../../../src/project/flowr-analyzer-builder';
import { NumericInferenceVisitor } from '../../../../src/abstract-interpretation/interval/numeric-inference';
import { beforeAll, expect, test } from 'vitest';
import type { SingleSlicingCriterion } from '../../../../src/slicing/criterion/parse';
import { slicingCriterionToId } from '../../../../src/slicing/criterion/parse';
import type { NormalizedAst, ParentInformation } from '../../../../src/r-bridge/lang-4.x/ast/model/processing/decorate';
import type { RProject } from '../../../../src/r-bridge/lang-4.x/ast/model/nodes/r-project';
import type { NodeId } from '../../../../src/r-bridge/lang-4.x/ast/model/processing/node-id';
import { DEFAULT_SIGNIFICANT_FIGURES } from '../../../../src/abstract-interpretation/domains/abstract-domain';
import { assertUnreachable, isUndefined } from '../../../../src/util/assert';

/**
 * Helper for creating interval values and expected results for testing the interval domain inference.
 */
export const IntervalTests = {
	/**
	 * Helper function to create an interval value for the interval domain.
	 * @param start - Lower bound of the interval.
	 * @param end - Upper bound of the interval. If not provided, it defaults to the same value as start, creating a scalar interval.
	 * @param significantFigures - The number of significant figures to consider for comparing the interval bounds (undefined means exact comparison). Defaults to `DEFAULT_SIGNIFICANT_FIGURES`.
	 * @returns An interval value represented as a tuple of [lowerBound, upperBound].
	 * @throws Error if the start value is greater than the end value, as this would represent an invalid interval.
	 */
	interval(this: void, start: number, end = start, significantFigures: number | undefined = DEFAULT_SIGNIFICANT_FIGURES): IntervalDomain {
		if(start > end) {
			throw new Error(`Invalid interval with start ${start} greater than end ${end}`);
		}

		return new IntervalDomain([start, end], significantFigures);
	},

	/**
	 * Helper function to create a scalar interval value for the interval domain, where the lower and upper bounds are the same.
	 * @param value - The value of the scalar interval, which will be used as both the lower and upper bound.
	 * @param significantFigures - The number of significant figures to consider for comparing the interval bounds (undefined means exact comparison). Defaults to `DEFAULT_SIGNIFICANT_FIGURES`.
	 * @returns A scalar interval value represented as a tuple of [value, value].
	 */
	scalar(this: void, value: number, significantFigures: number | undefined = DEFAULT_SIGNIFICANT_FIGURES): IntervalDomain {
		return IntervalTests.interval(value, value, significantFigures);
	},

	/**
	 * Helper function for the Top element.
	 * @returns `undefined`, representing the top element of the interval domain.
	 */
	top(this: void): undefined {
		return undefined;
	},

	/**
	 * Helper function for the Bottom element.
	 * @returns The bottom element of the interval domain.
	 */
	bottom(this: void): IntervalDomain {
		return IntervalDomain.bottom();
	}
};

export enum DomainMatchingType {
	Exact = 'exact',
	Overapproximation = 'overapproximation'
}

export type SlicingCriterionExpected = { domain: IntervalDomain | undefined, matching?: DomainMatchingType };

export type IntervalTestExpected = { [key: SingleSlicingCriterion]: SlicingCriterionExpected };

/**
 * Executes the {@link NumericInferenceVisitor} on the given code and tests the inferred interval values for each slicing criterion against the expected result.
 * @param code - The code snippet to analyze.
 * @param expected - An object mapping each slicing criterion to the expected interval domain (or `undefined` for top) that should be inferred by the visitor.
 */
export function testIntervalDomain(code: string, expected: IntervalTestExpected) {
	let ast: NormalizedAst<ParentInformation, RProject<ParentInformation>>;
	let visitor: NumericInferenceVisitor;

	beforeAll(async() => {
		const analyzer = await new FlowrAnalyzerBuilder().setEngine('tree-sitter').build();

		analyzer.addRequest(code.trim());

		ast = await analyzer.normalize();
		const dfg = (await analyzer.dataflow()).graph;
		const cfg = await analyzer.controlflow();
		const ctx = analyzer.inspectContext();

		visitor = new NumericInferenceVisitor({
			normalizedAst: ast,
			dfg:           dfg,
			controlFlow:   cfg,
			ctx:           ctx
		});

		visitor.start();
	});

	test.each(
		// Append the test name manually because we need to access a property of criterionExpected, which cannot be done using vitest's test.each syntax.
		(Object.entries(expected) as [criterion: SingleSlicingCriterion, criterionExpected: SlicingCriterionExpected][])
			.map(([criterion, criterionExpected]) => [`should infer ${criterionExpected.matching ?? DomainMatchingType.Exact}: ${criterionExpected.domain?.toString()} for ${criterion} at ${code.trim().replaceAll('\n', ' \\n ')}`, criterion, criterionExpected] as const)
	)('$0',
		(_: string, criterion: SingleSlicingCriterion, criterionExpected: SlicingCriterionExpected) => {
			const targetId: NodeId = slicingCriterionToId(criterion, ast.idMap);

			const inferredIntervalDomain = visitor.getAbstractValue(targetId);

			if(isUndefined(criterionExpected.matching)) {
				criterionExpected.matching = DomainMatchingType.Exact;
			}

			const errorContext = `expected inferred value ${inferredIntervalDomain?.toString()} to be ${criterionExpected.matching} 
			match for ${criterionExpected.domain?.toString()} in final state ${visitor.getEndState().toString()} for ${code.trim().replaceAll('\n', ' \\n ')}`;

			if(!isUndefined(inferredIntervalDomain) && !isUndefined(criterionExpected.domain)) {
				if(criterionExpected.matching === DomainMatchingType.Exact) {
					expect(criterionExpected.domain.equals(inferredIntervalDomain), 'Result differs: ' + errorContext).toBe(true);
				} else if(criterionExpected.matching === DomainMatchingType.Overapproximation) {
					expect(criterionExpected.domain.leq(inferredIntervalDomain), 'Result differs: ' + errorContext).toBe(true);
				} else {
					assertUnreachable(criterionExpected.matching);
				}
			} else {
				// At least one of the domains is undefined (Top)
				if(criterionExpected.matching === DomainMatchingType.Exact) {
					// Expect both to be undefined (Top)
					expect(inferredIntervalDomain?.value, 'Result differs: ' + errorContext).toBe(criterionExpected.domain?.value);
				} else if(criterionExpected.matching === DomainMatchingType.Overapproximation) {
					// At least one domain is undefined (Top), so the inferred domain has to be undefined (Top) to be an overapproximation of the expected domain.
					expect(inferredIntervalDomain, 'Result differs: ' + errorContext).toBeUndefined();
				} else {
					assertUnreachable(criterionExpected.matching);
				}
			}
		});
}