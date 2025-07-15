import { describe } from 'vitest';
import { RDoubleType, RLanguageType, RListType, RLogicalType, RNullType, RStringType, RUnknownType } from '../../../../src/typing/unification/types';
import { assertInferredType, assertInferredTypes } from '../../_helper/typing/unification/assert-inferred-type';
import { Q } from '../../../../src/search/flowr-search-builder';

describe('Infer types for builtin functions', () => {
	assertInferredType('rm(x)', new RNullType());

	assertInferredTypes(
		'x <- 42\nget("x")',
		{ query: Q.criterion('1@x').build(),   expectedType: new RDoubleType() },
		{ query: Q.criterion('2@get').build(), expectedType: new RDoubleType() },
		{ query: Q.criterion('2@"x"').build(), expectedType: new RStringType() }
	);

	assertInferredTypes(
		'eval(quote(TRUE))',
		{ query: Q.criterion('1@eval').build(),  expectedType: new RUnknownType() },
		{ query: Q.criterion('1@quote').build(), expectedType: new RLanguageType() },
		{ query: Q.criterion('1@TRUE').build(),  expectedType: new RLogicalType() }
	);
	
	assertInferredType('list(1, 2, 3)', new RListType(new RDoubleType()));

	assertInferredTypes(
		'c("Hello", "Flo", "!")',
		{ query: Q.criterion('1@c').build(),       expectedType: new RStringType() },
		{ query: Q.criterion('1@"Hello"').build(), expectedType: new RStringType() },
	);
});