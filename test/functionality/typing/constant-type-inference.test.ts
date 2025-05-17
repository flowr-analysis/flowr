import { describe } from 'vitest';
import { RDataTypeTag } from '../../../src/typing/types';
import { assertInferredType } from '../_helper/typing/assert-inferred-type';

describe('Infer types for currently supported R expressions', () => {
	describe.each([
		{ description: 'logical constant',        input: 'TRUE',            expectedType: { tag: RDataTypeTag.Logical as const } },
		{ description: 'integer constant',        input: '42',              expectedType: { tag: RDataTypeTag.Integer as const } },
		{ description: 'double constant',         input: '42.5',            expectedType: { tag: RDataTypeTag.Double as const } },
		{ description: 'complex number constant', input: '42i',             expectedType: { tag: RDataTypeTag.Complex as const } },
		{ description: 'string constant',         input: '"Hello, world!"', expectedType: { tag: RDataTypeTag.String as const } },
		{ description: 'empty expression list',   input: '{}',              expectedType: { tag: RDataTypeTag.Null as const } },
	])('Infer $expectedType for $description', ({ input, expectedType }) => assertInferredType(input, expectedType));

	describe('Infer no type information for currently unsupported R expressions', () => {
		assertInferredType('1 + 2', { tag: RDataTypeTag.Any });
		assertInferredType('x <- 42', { tag: RDataTypeTag.Any });
		assertInferredType('print("Hello, world!")', { tag: RDataTypeTag.Any });
	});
});