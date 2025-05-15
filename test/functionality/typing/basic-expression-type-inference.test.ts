import { describe } from 'vitest';
import { RDataTypeTag } from '../../../src/typing/types';
import { assertInferredType, assertInferredTypes } from '../_helper/typing/assert-inferred-type';
import { Q } from '../../../src/search/flowr-search-builder';

describe('Infer types for currently supported R expressions', () => {
	// Test type inference for constants
	describe.each([
		{ description: 'logical constant',        input: 'TRUE',            expectedType: { tag: RDataTypeTag.Logical as const } },
		{ description: 'integer constant',        input: '42',              expectedType: { tag: RDataTypeTag.Integer as const } },
		{ description: 'double constant',         input: '42.5',            expectedType: { tag: RDataTypeTag.Double as const } },
		{ description: 'complex number constant', input: '42i',             expectedType: { tag: RDataTypeTag.Complex as const } },
		{ description: 'string constant',         input: '"Hello, world!"', expectedType: { tag: RDataTypeTag.String as const } },
		{ description: 'empty expression list',   input: '{}',              expectedType: { tag: RDataTypeTag.Null as const } }
	])('Infer $expectedType for $description', ({ input, expectedType }) => assertInferredType(input, expectedType));

	// Test type inference for variables
	describe('Infer types for variables', () => {
		assertInferredTypes(
			'x <- 42; x',
			{ query: Q.var('x').first().build(), expectedType: { tag: RDataTypeTag.Integer as const } },
			{ query: Q.criterion('1@<-').build(), expectedType: { tag: RDataTypeTag.Integer as const } },
			{ query: Q.var('x').last().build(), expectedType: { tag: RDataTypeTag.Integer as const } }
		);
		assertInferredType('y', { tag: RDataTypeTag.Null });
	});

	// Test type inference for currently unsupported R expressions
	describe('Infer no type information for currently unsupported R expressions', () => {
		assertInferredType('1 + 2',                  { tag: RDataTypeTag.Any });
		assertInferredType('print("Hello, world!")', { tag: RDataTypeTag.Any });
	});
});