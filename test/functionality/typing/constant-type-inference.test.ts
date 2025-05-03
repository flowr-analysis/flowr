import { describe } from 'vitest';
import { TypeInferencer } from '../../../src/typing/type-inferencer';
import { RDataTypeTag } from '../../../src/typing/types';
import { assertInferredType } from '../_helper/typing/assert-inferred-type';

describe('Infer types for currently supported R expressions', () => {
	const inferencer = new TypeInferencer();
	
	describe.each([
		{ description: 'logical constant',        input: 'TRUE',            expectedType: { tag: RDataTypeTag.Logical } },
		{ description: 'integer constant',        input: '42',              expectedType: { tag: RDataTypeTag.Integer } },
		{ description: 'double constant',         input: '42.5',            expectedType: { tag: RDataTypeTag.Double } },
		{ description: 'complex number constant', input: '42i',             expectedType: { tag: RDataTypeTag.Complex } },
		{ description: 'string constant',         input: '"Hello, world!"', expectedType: { tag: RDataTypeTag.String } },
		{ description: 'empty expression list',   input: '{}',              expectedType: { tag: RDataTypeTag.Null } },
	])('Infer $expectedType for $description', ({ input, expectedType }) => assertInferredType(input, expectedType, inferencer));

	describe('Infer no type information for currently unsupported R expressions', () => {
		assertInferredType('1 + 2', { tag: RDataTypeTag.Any }, inferencer);
		assertInferredType('x <- 42', { tag: RDataTypeTag.Any }, inferencer);
		assertInferredType('print("Hello, world!")', { tag: RDataTypeTag.Any }, inferencer);
	});
});