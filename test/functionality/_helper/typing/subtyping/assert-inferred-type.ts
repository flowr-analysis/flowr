import { describe, expect, test } from 'vitest';
import { TreeSitterExecutor } from '../../../../../src/r-bridge/lang-4.x/tree-sitter/tree-sitter-executor';
import { createDataflowPipeline } from '../../../../../src/core/steps/pipeline/default-pipelines';
import { requestFromInput } from '../../../../../src/r-bridge/retriever';
import type { DataType, DataTypeInfo } from '../../../../../src/typing/types';
import { RTypeIntersection, RTypeUnion, RTypeVariable } from '../../../../../src/typing/types';
import { inferDataTypes } from '../../../../../src/typing/subtyping/infer';
import { type FlowrSearch } from '../../../../../src/search/flowr-search-builder';
import { runSearch } from '../../../../../src/search/flowr-search-executor';
import type { ParentInformation } from '../../../../../src/r-bridge/lang-4.x/ast/model/processing/decorate';
import type { RNode } from '../../../../../src/r-bridge/lang-4.x/ast/model/model';
import { defaultConfigOptions } from '../../../../../src/config';
import type { UnresolvedDataType } from '../../../../../src/typing/subtyping/types';

export function assertInferredType(input: string, expectedType: { expectedType: DataType } | { lowerBound?: DataType, upperBound?: DataType }, knownTypes?: Map<string, Set<UnresolvedDataType>>): void {
	assertInferredTypes(input, knownTypes, expectedType);
}

export function assertInferredTypes(
	input: string,
	knownTypes?: Map<string, Set<UnresolvedDataType>>,
	...expectations: ({ query?: FlowrSearch } & ({ expectedType: DataType } | { lowerBound?: DataType, upperBound?: DataType }))[]
): void {
	describe(`Infer types for ${input}`, async() => {
		const executor = new TreeSitterExecutor();
		const result = await createDataflowPipeline(executor, { request: requestFromInput(input) }, defaultConfigOptions).allRemainingSteps();
		inferDataTypes(result.normalize, result.dataflow, knownTypes);

		const expectedTypes = expectations.map(({ query, ...rest }) => ({
			query,
			expectedType: 'expectedType' in rest
				? rest.expectedType
				: new RTypeVariable(rest.lowerBound ?? new RTypeUnion(), rest.upperBound ?? new RTypeIntersection())
		}));

		describe.each(expectedTypes)('Infer $expectedType.tag for query $query', ({ query, expectedType }) => {
			let node: RNode<ParentInformation & DataTypeInfo>;
			if(query !== undefined) {
				const searchResult = runSearch(query, { config: defaultConfigOptions, ...result });
				const searchElements = searchResult.getElements();
				expect(searchElements).toHaveLength(1);
				node = searchElements[0].node as RNode<ParentInformation & DataTypeInfo>;
			} else {
				node = result.normalize.idMap.get(result.dataflow.exitPoints[0].nodeId) as RNode<ParentInformation & DataTypeInfo>;
			}

			test(`Infer ${expectedType.tag} for ${node.lexeme}`, () => {
				expect(node.info.inferredType).toEqual(expectedType);
			});
		});
	});
}