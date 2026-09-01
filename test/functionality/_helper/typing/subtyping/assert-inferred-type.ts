import { describe, expect, test } from 'vitest';
import { TreeSitterExecutor } from '../../../../../src/r-bridge/lang-4.x/tree-sitter/tree-sitter-executor';
import { FlowrAnalyzerBuilder } from '../../../../../src/project/flowr-analyzer-builder';
import type { DataType, DataTypeInfo } from '../../../../../src/typing/types';
import { RTypeIntersection, RTypeUnion, RTypeVariable } from '../../../../../src/typing/types';
import { inferDataTypes } from '../../../../../src/typing/subtyping/infer';
import type { FlowrSearch } from '../../../../../src/search/flowr-search-builder';
import type { NormalizedAst, ParentInformation } from '../../../../../src/r-bridge/lang-4.x/ast/model/processing/decorate';
import type { RNode } from '../../../../../src/r-bridge/lang-4.x/ast/model/model';
import type { KnownTypes } from '../../../../../src/typing/adapter/known-types';
import { prettyPrintDataType } from '../../../../../src/typing/pretty-print';

/**
 * Asserts the type the subtyping inference gives the code's last exit point.
 */
export function assertInferredType(input: string, expectedType: { expectedType: DataType } | { lowerBound?: DataType, upperBound?: DataType }, knownTypes?: KnownTypes): void {
	assertInferredTypes(input, knownTypes, expectedType);
}

/**
 * Asserts the types the subtyping inference gives the nodes the given searches select, the code's last exit
 * point for an expectation naming no search.
 */
export function assertInferredTypes(
	input: string,
	knownTypes?: KnownTypes,
	...expectations: ({ query?: FlowrSearch } & ({ expectedType: DataType } | { lowerBound?: DataType, upperBound?: DataType }))[]
): void {
	describe(`Infer types for ${input}`, async() => {
		const analyzer = await new FlowrAnalyzerBuilder().setParser(new TreeSitterExecutor()).build();
		analyzer.addRequest(input);
		const normalize = await analyzer.normalize();
		const dataflow = await analyzer.dataflow();
		inferDataTypes(normalize as NormalizedAst<ParentInformation & { typeVariable?: undefined }>, dataflow, analyzer.inspectContext(), knownTypes);

		const expectedTypes = expectations.map(({ query, ...rest }) => ({
			query,
			expectedType: 'expectedType' in rest
				? rest.expectedType
				: new RTypeVariable(rest.lowerBound ?? new RTypeUnion(), rest.upperBound ?? new RTypeIntersection())
		}));

		/* the searches have to be resolved up front, `describe.each` may not await inside its callback */
		const resolved = await Promise.all(expectedTypes.map(async({ query, expectedType }) => {
			let node: RNode<ParentInformation & DataTypeInfo>;
			if(query !== undefined) {
				const searchElements = (await analyzer.runSearch(query)).getElements();
				expect(searchElements).toHaveLength(1);
				node = searchElements[0].node as RNode<ParentInformation & DataTypeInfo>;
			} else {
				node = normalize.idMap.get(dataflow.exitPoints[0].nodeId) as RNode<ParentInformation & DataTypeInfo>;
			}
			return { expectedType, node };
		}));

		test.each(resolved)('Infer $expectedType.tag for $node.lexeme', ({ expectedType, node }) => {
			console.debug(`$${node.info.id} [${node.lexeme}]: {${prettyPrintDataType(node.info.inferredType)}}`);
			expect(node.info.inferredType).toEqual(expectedType);
		});
	});
}
