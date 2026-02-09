import { IntervalDomain } from '../../../../src/abstract-interpretation/domains/interval-domain';
import { FlowrAnalyzerBuilder } from '../../../../src/project/flowr-analyzer-builder';
import { StateAbstractDomain } from '../../../../src/abstract-interpretation/domains/state-abstract-domain';
import { NumericInferenceVisitor } from '../../../../src/abstract-interpretation/interval/numeric-inference';
import { assert, beforeAll, expect, test } from 'vitest';
import type { SingleSlicingCriterion } from '../../../../src/slicing/criterion/parse';
import { slicingCriterionToId } from '../../../../src/slicing/criterion/parse';
import type { NormalizedAst, ParentInformation } from '../../../../src/r-bridge/lang-4.x/ast/model/processing/decorate';
import type { RProject } from '../../../../src/r-bridge/lang-4.x/ast/model/nodes/r-project';
import type { NodeId } from '../../../../src/r-bridge/lang-4.x/ast/model/processing/node-id';
import type { AbstractDomainValue } from '../../../../src/abstract-interpretation/domains/abstract-domain';
import { isUndefined } from '../../../../src/util/assert';
import { Bottom } from '../../../../src/abstract-interpretation/domains/lattice';

/**
 * Helper function to create an interval value for the interval domain.
 * @param start - Lower bound of the interval.
 * @param end - Upper bound of the interval. If not provided, it defaults to the same value as start, creating a scalar interval.
 * @returns An interval value represented as a tuple of [lowerBound, upperBound].
 * @throws Error if the start value is greater than the end value, as this would represent an invalid interval.
 */
export function interval(start: number, end = start): AbstractDomainValue<IntervalDomain> {
	if(start > end) {
		throw new Error(`Invalid interval with start ${start} greater than end ${end}`);
	}

	return [start, end];
}

/**
 * Helper function to create a scalar interval value for the interval domain, where the lower and upper bounds are the same.
 * @param value - The value of the scalar interval, which will be used as both the lower and upper bound.
 * @returns A scalar interval value represented as a tuple of [value, value].
 */
export function scalar(value: number): AbstractDomainValue<IntervalDomain> {
	return interval(value);
}

/**
 * Helper function for the Top element.
 * @returns `undefined`, representing the top element of the interval domain.
 */
export function top(): undefined {
	return undefined;
}

/**
 * Helper function for the Bottom element.
 * @returns The bottom element of the interval domain.
 */
export function bottom(): AbstractDomainValue<IntervalDomain> {
	return Bottom;
}

/**
 * Executes the {@link NumericInferenceVisitor} on the given code and tests the inferred interval values for each slicing criterion against the expected result.
 * @param code - The code snippet to analyze.
 * @param expected - An object mapping each slicing criterion to the expected interval value (or `undefined` for top) that should be inferred by the visitor.
 */
export function testIntervalDomain(code: string, expected: {
	[key: SingleSlicingCriterion]: AbstractDomainValue<IntervalDomain> | undefined
}) {
	let ast: NormalizedAst<ParentInformation, RProject<ParentInformation>>;
	let visitor: NumericInferenceVisitor;

	beforeAll(async() => {
		const analyzer = await new FlowrAnalyzerBuilder().setEngine('tree-sitter').build();

		analyzer.addRequest(code.trim());

		ast = await analyzer.normalize();
		const dfg = (await analyzer.dataflow()).graph;
		const cfg = await analyzer.controlflow();
		const ctx = analyzer.inspectContext();
		const domain = new StateAbstractDomain<IntervalDomain>(StateAbstractDomain.bottom<IntervalDomain>().value);

		visitor = new NumericInferenceVisitor({
			normalizedAst: ast,
			dfg:           dfg,
			controlFlow:   cfg,
			ctx:           ctx,
			domain:        domain
		});

		visitor.start();
	});

	test.each(
		Object.entries(expected) as [criterion: SingleSlicingCriterion, expectedInterval: AbstractDomainValue<IntervalDomain> | undefined][]
	)(
		`should infer $1 for $0 at ${code.trim().replaceAll('\n', ' \\n ')}`,
		(criterion: SingleSlicingCriterion, expectedInterval: AbstractDomainValue<IntervalDomain> | undefined) => {
			const targetId: NodeId = slicingCriterionToId(criterion, ast.idMap);

			const inferred = visitor.getAbstractValue(targetId);
			const expected = isUndefined(expectedInterval) ? undefined : new IntervalDomain(expectedInterval);

			const errorContext = `expected actual value ${inferred?.toString()} to equal ${expected?.toString()} in final state ${JSON.stringify(visitor.getEndState().toJson())}`;

			if(!isUndefined(inferred) && !isUndefined(expected) && inferred.isValue() && expected.isValue()) {
				const [inferredLower, inferredUpper] = inferred.value;
				const [expectedLower, expectedUpper] = expected.value;

				if(!isFinite(inferredLower) || !isFinite(expectedLower)) {
					expect(inferredLower, 'Lower bound is incorrect: ' + errorContext).toEqual(expectedLower);
				} else {
					assert.closeTo(inferredLower, expectedLower, Number.EPSILON, 'Lower bound is incorrect: ' + errorContext);
				}

				if(!isFinite(inferredUpper) || !isFinite(expectedUpper)) {
					expect(inferredUpper, 'Upper bound is incorrect: ' + errorContext).toEqual(expectedUpper);
				} else {
					assert.closeTo(inferredUpper, expectedUpper, Number.EPSILON, 'Upper bound is incorrect: ' + errorContext);
				}
			} else {
				expect(
					inferred?.value,
					'Result differs: ' + errorContext
				).toEqual(expectedInterval);
			}
		});
}