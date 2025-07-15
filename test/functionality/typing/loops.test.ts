import { describe } from 'vitest';
import { RLogicalType, RNullType, RUnknownType } from '../../../src/typing/unification/types';
import { assertInferredType, assertInferredTypes } from '../_helper/typing/assert-inferred-type';
import { Q } from '../../../src/search/flowr-search-builder';
import { RType } from '../../../src/r-bridge/lang-4.x/ast/model/type';

describe('Infer types for loops', () => {
	describe.each([
		{ input: 'while(FALSE) { print("Testing is fun!") }',                         expectedType: new RNullType() },
		{ input: 'while(TRUE) { next }',                                              expectedType: new RUnknownType() },
		{ input: 'while(1 < 2) { print("Hi Flo!") }',                                 expectedType: new RNullType() },
		{ input: 'while(TRUE) { break }',                                             expectedType: new RNullType() },
		{ input: 'for(i in NULL) { print("I would like to write a test for that") }', expectedType: new RNullType() },
		{ input: 'for(i in 1:10) { print(i) }',                                       expectedType: new RNullType() },
		{ input: 'repeat { print("I love testing!") }',                               expectedType: new RUnknownType() },
		{ input: 'repeat { break }',                                                  expectedType: new RNullType() },
	])('Infer $expectedType for $input', ({ input, expectedType }) => assertInferredType(input, expectedType));

	assertInferredTypes(
		'while(1 > 2) { print("Testing is done!") }',
		{ query: Q.all().filter(RType.BinaryOp).build(), expectedType: new RLogicalType() },
	);
});