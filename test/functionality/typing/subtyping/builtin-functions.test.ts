import { describe } from 'vitest';
import { RTypeIntersection, RListType, RStringType, RTypeVariable, RAtomicVectorType, RDoubleType } from '../../../../src/typing/types';
import { assertInferredType, assertInferredTypes } from '../../_helper/typing/subtyping/assert-inferred-type';
import { Q } from '../../../../src/search/flowr-search-builder';

describe('Infer types for builtin functions', () => {
	assertInferredTypes(
		'x <- 42\nget("x")',
		undefined,
		{ query: Q.criterion('1@x').build(),   expectedType: new RDoubleType() },
		{ query: Q.criterion('2@get').build(), expectedType: new RDoubleType() },
		{ query: Q.criterion('2@"x"').build(), upperBound: new RStringType() }
	);

	const elementType = new RTypeVariable(new RDoubleType(), new RTypeIntersection());
	assertInferredType('list(1, 2, 3)', { expectedType: new RListType(elementType, new Map([[0, elementType], [1, elementType], [2, elementType]])) });

	assertInferredTypes(
		'c("Hello", "Flo", "!")',
		undefined,
		{ query: Q.criterion('1@c').build(),       expectedType: new RAtomicVectorType(new RTypeVariable(new RStringType(), new RTypeIntersection())) },
		{ query: Q.criterion('1@"Hello"').build(), expectedType: new RStringType() },
	);
});