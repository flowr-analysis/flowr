import { describe } from 'vitest';
import { RDoubleType, RNullType } from '../../../src/typing/types';
import { assertInferredType, assertInferredTypes } from '../_helper/typing/assert-inferred-type';
import { Q } from '../../../src/search/flowr-search-builder';

describe('Infer types for variables', () => {
	assertInferredTypes(
		'x <- 42; x',
		{ query: Q.var('x').first().build(),  expectedType: new RDoubleType() },
		{ query: Q.criterion('1@<-').build(), expectedType: new RDoubleType() },
		{ query: Q.var('x').last().build(),   expectedType: new RDoubleType() }
	);
	assertInferredType('y', new RNullType());
});