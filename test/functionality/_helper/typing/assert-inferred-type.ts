import { expect, test } from 'vitest';
import { TreeSitterExecutor } from '../../../../src/r-bridge/lang-4.x/tree-sitter/tree-sitter-executor';
import type { TypeInferencer, TypingInfo } from '../../../../src/typing/type-inferencer';
import { createNormalizePipeline } from '../../../../src/core/steps/pipeline/default-pipelines';
import { requestFromInput } from '../../../../src/r-bridge/retriever';

export function assertInferredType(
	input: string,
	expectedType: TypingInfo,
	inferencer: TypeInferencer<unknown>,
): void {
	test(`Infer ${expectedType} for ${input}`, async() => {
		const executor = new TreeSitterExecutor();
		const ast = await createNormalizePipeline(executor, { request: requestFromInput(input) })
			.allRemainingSteps()
			.then(promise => promise.normalize.ast);
		const inferredType = inferencer.fold(ast);
		expect(inferredType).toBe(expectedType);
	});
}