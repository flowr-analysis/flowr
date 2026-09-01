import { describe, expect, test } from 'vitest';
import { TreeSitterExecutor } from '../../../../../src/r-bridge/lang-4.x/tree-sitter/tree-sitter-executor';
import { FlowrAnalyzerBuilder } from '../../../../../src/project/flowr-analyzer-builder';
import type { DataType, DataTypeInfo } from '../../../../../src/typing/types';
import { inferDataTypesWithUnification } from '../../../../../src/typing/unification/infer';
import type { FlowrSearch } from '../../../../../src/search/flowr-search-builder';
import type { NormalizedAst, ParentInformation } from '../../../../../src/r-bridge/lang-4.x/ast/model/processing/decorate';
import type { RNode } from '../../../../../src/r-bridge/lang-4.x/ast/model/model';

/** the normalized ast and dataflow of `input`, with the unification-inferred types already decorated onto it */
async function inferFor(input: string) {
	const analyzer = await new FlowrAnalyzerBuilder().setParser(new TreeSitterExecutor()).build();
	analyzer.addRequest(input);
	const normalize = await analyzer.normalize();
	const dataflow = await analyzer.dataflow();
	const typedAst = inferDataTypesWithUnification(normalize as NormalizedAst<ParentInformation & { typeVariable?: undefined }>, dataflow, analyzer.inspectContext());
	return { analyzer, typedAst, dataflow };
}

/**
 * Asserts the type the unification inference gives the root of the code.
 */
export function assertInferredType(input: string, expectedType: DataType): void {
	test(`Infer ${expectedType.tag} for ${input}`, async() => {
		const { typedAst, dataflow } = await inferFor(input);
		const root = typedAst.idMap.get(dataflow.exitPoints[0].nodeId) as RNode<ParentInformation & DataTypeInfo>;
		expect(root.info.inferredType).toEqual(expectedType);
	});
}
/**
 * Asserts the types the unification inference gives the nodes the given searches select.
 */
export function assertInferredTypes(
	input: string,
	...expectations: { query: FlowrSearch, expectedType: DataType }[]
): void {
	describe(`Infer types for ${input}`, async() => {
		const { analyzer } = await inferFor(input);

		describe.each(expectations)('Infer $expectedType.tag for query $query', ({ query, expectedType }) => {
			test(`Infer ${expectedType.tag}`, async() => {
				const searchElements = (await analyzer.runSearch(query)).getElements();
				expect(searchElements).toHaveLength(1);
				const node = searchElements[0].node as RNode<ParentInformation & DataTypeInfo>;
				expect(node.info.inferredType).toEqual(expectedType);
			});
		});
	});
}
