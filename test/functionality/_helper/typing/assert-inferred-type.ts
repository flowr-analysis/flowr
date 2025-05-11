import { expect, test } from 'vitest';
import { TreeSitterExecutor } from '../../../../src/r-bridge/lang-4.x/tree-sitter/tree-sitter-executor';
import { createDataflowPipeline } from '../../../../src/core/steps/pipeline/default-pipelines';
import { requestFromInput } from '../../../../src/r-bridge/retriever';
import type { RDataType } from '../../../../src/typing/types';
import { inferDataTypes } from '../../../../src/typing/infer';

export function assertInferredType(
	input: string,
	expectedType: RDataType,
): void {
	test(`Infer ${expectedType.tag} for ${input}`, async() => {
		const executor = new TreeSitterExecutor();
		const result = await createDataflowPipeline(executor, { request: requestFromInput(input) }).allRemainingSteps();
		const typedAst = inferDataTypes(result.normalize.ast, result.dataflow);
		expect(typedAst.info.inferredType).toEqual(expectedType);
	});
}