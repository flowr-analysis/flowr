import { describe } from 'vitest';
import { RTypeIntersection, RIntegerType, RLanguageType, RListType, RLogicalType, RNullType, RStringType, RTypeVariable, RAtomicVectorType, RComplexType } from '../../../../src/typing/types';
import { assertInferredType, assertInferredTypes } from '../../_helper/typing/subtyping/assert-inferred-type';
import { Q } from '../../../../src/search/flowr-search-builder';

describe('Infer types for builtin functions', () => {
	assertInferredType('rm(x)', { expectedType: new RNullType() });

	assertInferredTypes(
		'x <- 42\nget("x")',
		{ query: Q.criterion('1@x').build(),   lowerBound: new RIntegerType(), upperBound: new RComplexType() },
		{ query: Q.criterion('2@get').build(), lowerBound: new RIntegerType(), upperBound: new RComplexType() },
		{ query: Q.criterion('2@"x"').build(), upperBound: new RStringType() }
	);

	assertInferredTypes(
		'eval(quote(TRUE))',
		{ query: Q.criterion('1@eval').build(),  expectedType: new RTypeVariable() },
		{ query: Q.criterion('1@quote').build(), expectedType: new RLanguageType() },
		{ query: Q.criterion('1@TRUE').build(),  expectedType: new RLogicalType() }
	);
	
	const elementType = new RTypeVariable(new RIntegerType(), new RTypeIntersection());
	assertInferredType('list(1, 2, 3)', { expectedType: new RListType(elementType, new Map([[0, elementType], [1, elementType], [2, elementType]])) });

	assertInferredTypes(
		'c("Hello", "Flo", "!")',
		{ query: Q.criterion('1@c').build(),       expectedType: new RAtomicVectorType(new RTypeVariable(new RStringType(), new RTypeIntersection())) },
		{ query: Q.criterion('1@"Hello"').build(), expectedType: new RStringType() },
	);
});