import { describe } from 'vitest';
import { RDoubleType, RLogicalType, RNullType, RStringType } from '../../../src/typing/types';
import { assertInferredType, assertInferredTypes } from '../_helper/typing/assert-inferred-type';
import { Q } from '../../../src/search/flowr-search-builder';
import { RType } from '../../../src/r-bridge/lang-4.x/ast/model/type';

describe('Infer types for if statements', () => {
	describe.each([
		{ input: 'if(FALSE) { TRUE }',                     expectedType: new RNullType() },
		{ input: 'if(TRUE) { 1 } else { NULL }',           expectedType: new RDoubleType() },
		{ input: 'if(stop("stop here")) { 1 } else { 2 }', expectedType: new RDoubleType() },
	])('Infer $expectedType for $input', ({ input, expectedType }) => assertInferredType(input, expectedType));

	assertInferredTypes(
		'a <- if(1 > 2) { "Yes" } else { "Nope" }',
		{ query: Q.all().filter(RType.BinaryOp).first().build(), expectedType: new RStringType() },
		{ query: Q.all().filter(RType.BinaryOp).last().build(),  expectedType: new RLogicalType() },
	);
});