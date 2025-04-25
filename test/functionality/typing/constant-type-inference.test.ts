import { describe } from 'vitest';
import { RDataType, TypeInferencer } from '../../../src/typing/type-inferencer';
import { assertInferredType } from '../_helper/typing/assert-inferred-type';

describe('Infer types for currently supported R expressions', () => {
	const inferencer = new TypeInferencer();
	
	describe.each([
		{ description: 'logical constant',        input: 'TRUE',            expectedType: RDataType.Logical },
		{ description: 'numeric constant',        input: '42',              expectedType: RDataType.Numeric },
		{ description: 'complex number constant', input: '42i',             expectedType: RDataType.Complex },
		{ description: 'string constant',         input: '"Hello, world!"', expectedType: RDataType.String },
		{ description: 'empty expression list',   input: '{}',              expectedType: RDataType.Null },
	])('Infer $expectedType for $description', ({ input, expectedType }) => assertInferredType(input, expectedType, inferencer));

	describe('Infer no type information for currently unsupported R expressions', () => {
		assertInferredType('1 + 2', undefined, inferencer);
		assertInferredType('x <- 42', undefined, inferencer);
		assertInferredType('print("Hello, world!")', undefined, inferencer);
	});
});