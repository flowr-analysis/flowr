import { describe } from 'vitest';
import { RIntegerType } from '../../../../src/typing/subtyping/types';
import { assertInferredTypes } from '../../_helper/typing/subtyping/assert-inferred-type';
import { Q } from '../../../../src/search/flowr-search-builder';

describe('Infer types for variables', () => {
	assertInferredTypes(
		'x <- 42; x',
		{ query: Q.var('x').first().build(),  lowerBound: new RIntegerType() },
		{ query: Q.criterion('1@<-').build(), lowerBound: new RIntegerType() },
		{ query: Q.var('x').last().build(),   lowerBound: new RIntegerType() }
	);
});