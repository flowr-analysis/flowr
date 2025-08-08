import { describe } from 'vitest';
import { RComplexType, RIntegerType } from '../../../../src/typing/types';
import { assertInferredTypes } from '../../_helper/typing/subtyping/assert-inferred-type';
import { Q } from '../../../../src/search/flowr-search-builder';

describe('Infer types for variables', () => {
	assertInferredTypes(
		'x <- 42; x',
		undefined,
		{ query: Q.var('x').first().build(),  lowerBound: new RIntegerType(), upperBound: new RComplexType() },
		{ query: Q.criterion('1@<-').build(), lowerBound: new RIntegerType(), upperBound: new RComplexType() },
		{ query: Q.var('x').last().build(),   lowerBound: new RIntegerType(), upperBound: new RComplexType() },
	);
});