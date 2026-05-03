import { beforeAll, expect, test } from 'vitest';
import { DomainMatchingType } from '../interval/interval';
import { Bottom, BottomSymbol } from '../../../../src/abstract-interpretation/domains/lattice';
import { FlowrAnalyzerBuilder } from '../../../../src/project/flowr-analyzer-builder';
import {
	NumericPentagonInferenceVisitor
} from '../../../../src/abstract-interpretation/pentagon/numeric-pentagon-inference';
import type { IntervalDomain } from '../../../../src/abstract-interpretation/domains/interval-domain';
import type { NormalizedAst, ParentInformation } from '../../../../src/r-bridge/lang-4.x/ast/model/processing/decorate';
import { SlicingCriterion } from '../../../../src/slicing/criterion/parse';
import type { RProject } from '../../../../src/r-bridge/lang-4.x/ast/model/nodes/r-project';
import type { NodeId } from '../../../../src/r-bridge/lang-4.x/ast/model/processing/node-id';
import { assertUnreachable, isNotUndefined, isUndefined } from '../../../../src/util/assert';
import {
	UpperBoundsValueDomain
} from '../../../../src/abstract-interpretation/pentagon/upper-bounds/upper-bounds-value-domain';

/**
 * Helper for creating upper-bounds based on slicing criteria for testing the pentagon domain inference.
 * This can also be used to create the lower-bounds sets.
 */
export const UpperBoundsTests = {
	/**
	 * Creates the required pair of slicing criteria sets.
	 * @param includes - Slicing criteria for every variable that is included in the upper-bounds set.
	 * @param notIncludes - Slicing criteria for every variable that is not allowed to appear in the upper-bounds set.
	 */
	bounds(this: void, includes: SlicingCriterion[], notIncludes?: SlicingCriterion[]): { includes: ReadonlySet<SlicingCriterion>, notIncludes: ReadonlySet<SlicingCriterion> } {
		return { includes: new Set(includes), notIncludes: new Set(notIncludes ?? []) };
	},

	/**
	 * @returns The top element for upper-bounds.
	 */
	top(this: void): { includes: ReadonlySet<SlicingCriterion>, notIncludes: ReadonlySet<SlicingCriterion> } {
		return { includes: new Set(), notIncludes: new Set() };
	},

	/**
	 * @returns The bottom element for upper-bounds.
	 */
	bottom(this: void): typeof Bottom {
		return Bottom;
	},
};

export type PentagonSlicingCriterionExpected = { interval: IntervalDomain | undefined, intervalMatching?: DomainMatchingType, upperBounds: { includes: ReadonlySet<SlicingCriterion>, notIncludes: ReadonlySet<SlicingCriterion> } | typeof Bottom, lowerBounds?: { includes: ReadonlySet<SlicingCriterion>, notIncludes: ReadonlySet<SlicingCriterion> } };
export type PentagonTestExpected = { [key: SlicingCriterion]: PentagonSlicingCriterionExpected };

/**
 * Executes the {@link NumericPentagonInferenceVisitor} on the given code and tests the inferred pentagon values for each slicing criterion against the expected result.
 * @param code - The code snippet to analyze.
 * @param expected - An object mapping each slicing criterion to the expected interval, upper-bounds and lower-bounds, that should be inferred by the visitor. For the upper-/lower-bounds it is checked whether the nodeIds represented by the slicing criteria are included/excluded in the upper bounds.
 */
export function testPentagonDomain(code: string, expected: PentagonTestExpected) {
	let ast: NormalizedAst<ParentInformation, RProject<ParentInformation>>;
	let visitor: NumericPentagonInferenceVisitor;

	beforeAll(async() => {
		const analyzer = await new FlowrAnalyzerBuilder().setEngine('tree-sitter').build();

		analyzer.addRequest(code.trim());

		ast = await analyzer.normalize();
		const dfg = (await analyzer.dataflow()).graph;
		const cfg = await analyzer.controlflow();
		const ctx = analyzer.inspectContext();

		visitor = new NumericPentagonInferenceVisitor({
			normalizedAst: ast,
			dfg:           dfg,
			controlFlow:   cfg,
			ctx:           ctx
		});

		visitor.start();
	});

	test.each(
		// Append the test name manually because we need to access a property of criterionExpected, which cannot be done using vitest's test.each syntax.
		(Object.entries(expected) as [criterion: SlicingCriterion, criterionExpected: PentagonSlicingCriterionExpected][])
			.map(([criterion, criterionExpected]) => [`should infer ${criterionExpected.intervalMatching ?? DomainMatchingType.Exact}: ${criterionExpected.interval?.toString()} and include upper-bounds {${criterionExpected.upperBounds === Bottom ? BottomSymbol : criterionExpected.upperBounds.includes.values().toArray().join(', ')}}/exclude {${criterionExpected.upperBounds === Bottom ? BottomSymbol : criterionExpected.upperBounds.notIncludes.values().toArray().join(', ')}} for ${criterion} at ${code.trim().replaceAll('\n', ' \\n ')}`, criterion, criterionExpected] as const)
	)('$0',
		(_: string, criterion: SlicingCriterion, criterionExpected: PentagonSlicingCriterionExpected) => {
			// Check interval part
			const targetId: NodeId = SlicingCriterion.parse(criterion, ast.idMap);

			const inferredPentagonDomain = visitor.getAbstractValue(targetId);

			if(isUndefined(criterionExpected.intervalMatching)) {
				criterionExpected.intervalMatching = DomainMatchingType.Exact;
			}

			const intervalErrorContext = `expected inferred value ${inferredPentagonDomain?.value.interval.toString()} to be ${criterionExpected.intervalMatching} 
			match for ${criterionExpected.interval?.toString()} in final state ${visitor.getEndState().toString()} for ${code.trim().replaceAll('\n', ' \\n ')}`;

			if(isNotUndefined(inferredPentagonDomain?.value.interval) && isNotUndefined(criterionExpected.interval)) {
				if(criterionExpected.intervalMatching === DomainMatchingType.Exact) {
					expect(criterionExpected.interval.equals(inferredPentagonDomain.value.interval), 'Result differs: ' + intervalErrorContext).toBe(true);
				} else if(criterionExpected.intervalMatching === DomainMatchingType.Overapproximation) {
					expect(criterionExpected.interval.leq(inferredPentagonDomain.value.interval), 'Result differs: ' + intervalErrorContext).toBe(true);
					expect(criterionExpected.interval.equals(inferredPentagonDomain.value.interval), 'Result is not an overapproximation but an exact match.').toBe(false);
				} else {
					assertUnreachable(criterionExpected.intervalMatching);
				}
			} else {
				// At least one of the domains is undefined (Top)
				if(criterionExpected.intervalMatching === DomainMatchingType.Exact) {
					// Expect both to be undefined (Top)
					expect(inferredPentagonDomain?.value.interval.value, 'Result differs: ' + intervalErrorContext).toBe(criterionExpected.interval?.value);
				} else if(criterionExpected.intervalMatching === DomainMatchingType.Overapproximation) {
					// At least one domain is undefined (Top), so the inferred domain has to be undefined (Top) to be an overapproximation of the expected domain.
					expect(inferredPentagonDomain?.value.interval, 'Result differs: ' + intervalErrorContext).toBeUndefined();
					expect(inferredPentagonDomain?.value.interval.value, 'Result is not an overapproximation but an exact match.').not.toBe(criterionExpected.interval?.value);
				} else {
					assertUnreachable(criterionExpected.intervalMatching);
				}
			}

			// Check if upper bounds are included
			if((isUndefined(inferredPentagonDomain) && criterionExpected.intervalMatching === DomainMatchingType.Overapproximation)) {
				// Assume no info to be the allowed overapproximation => therefore we cannot have any upper bounds info, so we skip the test
				return;
			}

			let expectedUpperBoundsValueDomain;
			const upperBoundsCriterionMapping = new Map<NodeId, SlicingCriterion>();
			if(criterionExpected.upperBounds === Bottom) {
				expectedUpperBoundsValueDomain = new UpperBoundsValueDomain(Bottom);
			} else {
				criterionExpected.upperBounds.includes.values().forEach(ubCriterion => {
					const nodeId = SlicingCriterion.parse(ubCriterion, ast.idMap);
					const nodeOrigins = visitor.getVariableOrigins(nodeId);
					if(nodeOrigins.length <= 1) {
						const nodeOrigin = nodeOrigins.length === 1 ? nodeOrigins[0] : nodeId;
						upperBoundsCriterionMapping.set(nodeOrigin, ubCriterion);
					} else {
						throw new Error(`Invalid upper-bounds slicing criterion ${ubCriterion} - the node has multiple origins: {${nodeOrigins.join(', ')}}`);
					}
				});
				expectedUpperBoundsValueDomain = new UpperBoundsValueDomain(new Set(upperBoundsCriterionMapping.keys()));
			}

			const upperBoundsErrorContext = `expected inferred value ${inferredPentagonDomain?.value.upperBounds.toString()} to include ${expectedUpperBoundsValueDomain.toString()}
			in final state ${visitor.getEndState().toString()} for "${code.trim().replaceAll('\n', ' \\n ')}" with mapping
			{${upperBoundsCriterionMapping.entries().map(([node, criterion]) => node.toString() + ' -> ' + criterion.toString()).toArray().join(', ')}}`;

			if(isUndefined(criterionExpected.interval)) {
				expect(inferredPentagonDomain?.value.upperBounds, 'Result differs: expected inferred upper-bounds to be undefined but was ' + inferredPentagonDomain?.value.upperBounds.toString()).toBeUndefined();
			} else {
				expect(inferredPentagonDomain?.value.upperBounds.leq(expectedUpperBoundsValueDomain), 'Result differs: ' + upperBoundsErrorContext).toBe(true);

				if(criterionExpected.upperBounds !== Bottom) {
					for(const excludedSlicingCriterion of criterionExpected.upperBounds.notIncludes) {
						const excludedNodeId = SlicingCriterion.parse(excludedSlicingCriterion, ast.idMap);
						const excludedNodeOrigins = visitor.getVariableOrigins(excludedNodeId);
						if(excludedNodeOrigins.length <= 1) {
							const excludedNodeOrigin = excludedNodeOrigins.length === 1 ? excludedNodeOrigins[0] : excludedNodeId;
							expect(inferredPentagonDomain?.value.upperBounds.has(excludedNodeOrigin), `Result differs: expected inferred value ${inferredPentagonDomain?.value.upperBounds.toString()} not to include ${excludedNodeOrigin} (${excludedSlicingCriterion})`).toBe(false);
						} else {
							throw new Error(`Invalid upper-bounds slicing criterion ${excludedSlicingCriterion} - the node has multiple origins: {${excludedNodeOrigins.join(', ')}}`);
						}
					}
				}
			}

			if(isNotUndefined(criterionExpected.lowerBounds)) {
				// Check whether targetId is included in the upper bounds of all lower bounds (or excluded respectively)
				const targetNodeOrigins = visitor.getVariableOrigins(targetId);
				if(targetNodeOrigins.length > 1) {
					throw new Error(`Element cannot have lower bound - the element has multiple origins: {${targetNodeOrigins.join(', ')}}`);
				}
				const targetNodeOrigin = targetNodeOrigins.length === 1 ? targetNodeOrigins[0] : targetId;

				const state = visitor.getAbstractState(targetId);
				for(const lowerBoundCriterion of criterionExpected.lowerBounds.includes.values()) {
					const lowerBoundNodeId = SlicingCriterion.parse(lowerBoundCriterion, ast.idMap);
					const lowerBoundValue = visitor.getAbstractValue(lowerBoundNodeId, state);
					expect(lowerBoundValue?.value.upperBounds.has(targetNodeOrigin), `Result differs: expected inferred upper-bounds for ${lowerBoundCriterion}: ${lowerBoundValue?.value.upperBounds.toString()} to include ${targetNodeOrigin}`).toBe(true);
				}
				for(const lowerBoundCriterion of criterionExpected.lowerBounds.notIncludes.values()) {
					const lowerBoundNodeId = SlicingCriterion.parse(lowerBoundCriterion, ast.idMap);
					const lowerBoundValue = visitor.getAbstractValue(lowerBoundNodeId, state);
					expect(lowerBoundValue?.value.upperBounds.has(targetNodeOrigin), `Result differs: expected inferred upper-bounds for ${lowerBoundCriterion}: ${lowerBoundValue?.value.upperBounds.toString()} not to include ${targetNodeOrigin} (${criterion})`).toBe(false);
				}
			}
		});
}