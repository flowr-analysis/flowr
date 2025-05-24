import { describe } from 'vitest';
import { RDataTypeTag } from '../../../src/typing/types';
import { assertInferredType, assertInferredTypes } from '../_helper/typing/assert-inferred-type';
import { Q } from '../../../src/search/flowr-search-builder';
import { RType } from '../../../src/r-bridge/lang-4.x/ast/model/type';

describe('Infer types for loops', () => {
	describe.each([
		{ input: 'while(FALSE) { print("Testing is fun!") }', expectedType: { tag: RDataTypeTag.Null as const } },
		{ input: 'while(TRUE) { break }',                     expectedType: { tag: RDataTypeTag.Null as const } },
		{ input: 'for(i in 1:10) { print(i) }',   expectedType: { tag: RDataTypeTag.Null as const } },
		{ input: 'repeat { print("I love testing!") }',       expectedType: { tag: RDataTypeTag.Never as const } },
	])('Infer $expectedType for $input', ({ input, expectedType }) => assertInferredType(input, expectedType));

	assertInferredTypes(
		'while(1 > 2) { print("No more testing!") }',
		{ query: Q.all().filter(RType.BinaryOp).build(), expectedType: { tag: RDataTypeTag.Logical as const } }
	);
});