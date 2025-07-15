import { describe, expect, test } from 'vitest';
import { TreeSitterExecutor } from '../../../../src/r-bridge/lang-4.x/tree-sitter/tree-sitter-executor';
import { createDataflowPipeline } from '../../../../src/core/steps/pipeline/default-pipelines';
import { requestFromInput } from '../../../../src/r-bridge/retriever';
import type { RDataType } from '../../../../src/typing/unification/types';
import { inferDataTypes } from '../../../../src/typing/unification/infer';
import type { FlowrSearch } from '../../../../src/search/flowr-search-builder';
import { runSearch } from '../../../../src/search/flowr-search-executor';

export function assertInferredType(input: string, expectedType: RDataType): void {
	test(`Infer ${expectedType.tag} for ${input}`, async() => {
		const executor = new TreeSitterExecutor();
		const result = await createDataflowPipeline(executor, { request: requestFromInput(input) }).allRemainingSteps();
		const typedAst = inferDataTypes(result.normalize, result.dataflow);
		const rootNode = typedAst.ast;
		expect(rootNode.info.inferredType).toEqual(expectedType);
	});
}
export function assertInferredTypes(
	input: string,
	...expectations: { query: FlowrSearch, expectedType: RDataType }[]
): void {
	describe(`Infer types for ${input}`, async() => {
		const executor = new TreeSitterExecutor();
		const result = await createDataflowPipeline(executor, { request: requestFromInput(input) }).allRemainingSteps();
		inferDataTypes(result.normalize, result.dataflow);

		describe.each(expectations)('Infer $expectedType.tag for query $query', ({ query, expectedType }) => {
			const searchResult = runSearch(query, result);
			expect(searchResult).toHaveLength(1);
			const node = searchResult[0].node;

			test(`Infer ${expectedType.tag} for ${node.lexeme}`, () => {
				expect(node.info.inferredType).toEqual(expectedType);
			});
		});
	});
}