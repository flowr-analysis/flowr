import { describe } from 'vitest';
import { RLogicalType, RTypeUnion, RNullType, RStringType } from '../../../../src/typing/types';
import { assertInferredType, assertInferredTypes } from '../../_helper/typing/subtyping/assert-inferred-type';
import { Q } from '../../../../src/search/flowr-search-builder';
import { RType } from '../../../../src/r-bridge/lang-4.x/ast/model/type';

describe('Infer types for if statements', () => {
	describe.each([
		{ input: 'if(FALSE) { TRUE }',                     expectedType: new RNullType() },
		{ input: 'if(TRUE) { "Hi" } else { NULL }',        lowerBound: new RStringType() },
		{ input: 'if(stop("stop here")) { 1 } else { 2 }', expectedType: new RTypeUnion() },
	])('Infer $expectedType for $input', ({ input, ...expectedType }) => assertInferredType(input, expectedType));

	assertInferredTypes(
		'a <- if(1 > 2) { "Yes" } else { "Nope" }',
		{ query: Q.all().filter(RType.BinaryOp).first().build(), lowerBound: new RStringType() },
		{ query: Q.all().filter(RType.BinaryOp).last().build(),  upperBound: new RLogicalType() },
	);
});