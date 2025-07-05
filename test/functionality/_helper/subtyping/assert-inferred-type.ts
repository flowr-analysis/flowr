import { describe, expect, test } from 'vitest';
import { TreeSitterExecutor } from '../../../../src/r-bridge/lang-4.x/tree-sitter/tree-sitter-executor';
import { createDataflowPipeline } from '../../../../src/core/steps/pipeline/default-pipelines';
import { requestFromInput } from '../../../../src/r-bridge/retriever';
import { RAnyType, RNoneType, RTypeVariable, type RDataType } from '../../../../src/subtyping/types';
import type { DataTypeInfo } from '../../../../src/subtyping/infer';
import { inferDataTypes } from '../../../../src/subtyping/infer';
import { type FlowrSearch } from '../../../../src/search/flowr-search-builder';
import { runSearch } from '../../../../src/search/flowr-search-executor';
import type { ParentInformation } from '../../../../src/r-bridge/lang-4.x/ast/model/processing/decorate';
import type { RNode } from '../../../../src/r-bridge/lang-4.x/ast/model/model';

export function assertInferredType(input: string, expectedType: { expectedType: RDataType } | { lowerBound?: RDataType, upperBound?: RDataType }): void {
	assertInferredTypes(input, expectedType);
}
export function assertInferredTypes(
	input: string,
	...expectations: ({ query?: FlowrSearch } & ({ expectedType: RDataType } | { lowerBound?: RDataType, upperBound?: RDataType }))[]
): void {
	describe(`Infer types for ${input}`, async() => {
		const executor = new TreeSitterExecutor();
		const result = await createDataflowPipeline(executor, { request: requestFromInput(input) }).allRemainingSteps();
		inferDataTypes(result.normalize, result.dataflow);

		const expectedTypes = expectations.map(({ query, ...rest }) => ({
			query,
			expectedType: 'expectedType' in rest
				? rest.expectedType
				: new RTypeVariable(rest.lowerBound ?? new RNoneType(), rest.upperBound ?? new RAnyType())
		}));

		describe.each(expectedTypes)('Infer $expectedType.tag for query $query', ({ query, expectedType }) => {
			let node: RNode<ParentInformation & DataTypeInfo>;
			if(query !== undefined) {
				const searchResult = runSearch(query, result);
				expect(searchResult).toHaveLength(1);
				node = searchResult[0].node as RNode<ParentInformation & DataTypeInfo>;
			} else {
				node = result.normalize.idMap.get(result.dataflow.exitPoints[0].nodeId) as RNode<ParentInformation & DataTypeInfo>;
			}

			test(`Infer ${expectedType.tag} for ${node.lexeme}`, () => {
				expect(node.info.inferredType).toEqual(expectedType);
			});
		});
	});
}