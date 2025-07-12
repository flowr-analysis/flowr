import { describe } from 'vitest';
import { RTypeIntersection, RIntegerType, RLanguageType, RListType, RLogicalType, RTypeUnion, RNullType, RStringType, RTypeVariable, RAtomicVectorType } from '../../../src/subtyping/types';
import { assertInferredType, assertInferredTypes } from '../_helper/subtyping/assert-inferred-type';
import { Q } from '../../../src/search/flowr-search-builder';

describe('Infer types for builtin functions', () => {
	assertInferredType('rm(x)', { expectedType: new RNullType() });

	assertInferredTypes(
		'x <- 42\nget("x")',
		{ query: Q.criterion('1@x').build(),   lowerBound: new RIntegerType() },
		{ query: Q.criterion('2@get').build(), lowerBound: new RIntegerType() },
		{ query: Q.criterion('2@"x"').build(), upperBound: new RStringType() }
	);

	assertInferredTypes(
		'eval(quote(TRUE))',
		{ query: Q.criterion('1@eval').build(),  lowerBound: new RTypeUnion(), upperBound: new RTypeIntersection() },
		{ query: Q.criterion('1@quote').build(), expectedType: new RLanguageType() },
		{ query: Q.criterion('1@TRUE').build(),  expectedType: new RLogicalType() }
	);
	
	assertInferredType('list(1, 2, 3)', { expectedType: new RListType(new RTypeVariable(new RIntegerType(), new RTypeIntersection())) });

	assertInferredTypes(
		'c("Hello", "Flo", "!")',
		{ query: Q.criterion('1@c').build(),       expectedType: new RAtomicVectorType(new RTypeVariable(new RStringType(), new RTypeIntersection())) },
		{ query: Q.criterion('1@"Hello"').build(), expectedType: new RStringType() },
	);
});