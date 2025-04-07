import { describe, expect, test } from 'vitest';
import { retrieveNormalizedAst, withShell } from '../_helper/shell';
import { RDataType, TypeInferencer } from '../../../src/typing/type-inferencer';

describe.sequential('Infer types for R expressions', withShell(shell => {
	const inferencer = new TypeInferencer();
	
	describe.each([
		{ description: 'logical constant', input: 'TRUE',            expectedType: RDataType.Logical },
		{ description: 'numeric constant', input: '42',              expectedType: RDataType.Numeric },
		{ description: 'string constant',  input: '"Hello, world!"', expectedType: RDataType.String },
	])('Infer $expectedType for $description', ({ input, expectedType }) => {
		test(`Infer ${expectedType} for ${input}`, async() => {
			const ast = await retrieveNormalizedAst(shell, input).then(promise => promise.ast);
			const inferredType = inferencer.fold(ast);
			expect(inferredType).toBe(expectedType);
		});
	});
}));