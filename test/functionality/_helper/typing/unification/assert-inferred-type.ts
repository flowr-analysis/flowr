import { describe, expect, test } from 'vitest';
import { TreeSitterExecutor } from '../../../../../src/r-bridge/lang-4.x/tree-sitter/tree-sitter-executor';
import { createDataflowPipeline } from '../../../../../src/core/steps/pipeline/default-pipelines';
import { requestFromInput } from '../../../../../src/r-bridge/retriever';
import type { DataType } from '../../../../../src/typing/types';
import { inferDataTypes } from '../../../../../src/typing/unification/infer';
import type { FlowrSearch } from '../../../../../src/search/flowr-search-builder';
import { runSearch } from '../../../../../src/search/flowr-search-executor';
import { defaultConfigOptions } from '../../../../../src/config';

export function assertInferredType(input: string, expectedType: DataType): void {
	test(`Infer ${expectedType.tag} for ${input}`, async() => {
		const executor = new TreeSitterExecutor();
		const result = await createDataflowPipeline(executor, { request: requestFromInput(input) }, defaultConfigOptions).allRemainingSteps();
		const typedAst = inferDataTypes(result.normalize, result.dataflow);
		const rootNode = typedAst.ast;
		expect(rootNode.info.inferredType).toEqual(expectedType);
	});
}
export function assertInferredTypes(
	input: string,
	...expectations: { query: FlowrSearch, expectedType: DataType }[]
): void {
	describe(`Infer types for ${input}`, async() => {
		const executor = new TreeSitterExecutor();
		const result = await createDataflowPipeline(executor, { request: requestFromInput(input) }, defaultConfigOptions).allRemainingSteps();
		inferDataTypes(result.normalize, result.dataflow);

		describe.each(expectations)('Infer $expectedType.tag for query $query', ({ query, expectedType }) => {
			const searchResult = runSearch(query, { config: defaultConfigOptions, ...result });
			const searchElements = searchResult.getElements();
			expect(searchElements).toHaveLength(1);
			const node = searchElements[0].node;

			test(`Infer ${expectedType.tag} for ${node.lexeme}`, () => {
				expect(node.info.inferredType).toEqual(expectedType);
			});
		});
	});
}