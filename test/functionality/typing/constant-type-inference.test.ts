import { describe, expect, test } from 'vitest';
import { retrieveNormalizedAst, withShell } from '../_helper/shell';
import { RDataType, TypeInferencer } from '../../../src/typing/type-inferencer';

describe.sequential('Infer types for currently supported R expressions', withShell(shell => {
	const inferencer = new TypeInferencer();
	
	describe.each([
		{ description: 'logical constant',       input: 'TRUE',            expectedType: RDataType.Logical },
		{ description: 'numeric constant',       input: '42',              expectedType: RDataType.Numeric },
		{ description: 'string constant',        input: '"Hello, world!"', expectedType: RDataType.String },
		{ description: 'empty expression list',  input: '{}',              expectedType: RDataType.Null },
	])('Infer $expectedType for $description', ({ input, expectedType }) => {
		test(`Infer ${expectedType} for ${input}`, async() => {
			const ast = await retrieveNormalizedAst(shell, input).then(promise => promise.ast);
			const inferredType = inferencer.fold(ast);
			expect(inferredType).toBe(expectedType);
		});
	});

	describe('Infer no type information for currently unsupported R expressions', () => {
		test('Infer no type information for binary operations', async() => {
			const ast = await retrieveNormalizedAst(shell, '1 + 2').then(promise => promise.ast);
			const inferredType = inferencer.fold(ast);
			expect(inferredType).toBe(undefined);
		});

		test('Infer no type information for function calls', async() => {
			const ast = await retrieveNormalizedAst(shell, 'print("foo")').then(promise => promise.ast);
			const inferredType = inferencer.fold(ast);
			expect(inferredType).toBe(undefined);
		});
	});
}));