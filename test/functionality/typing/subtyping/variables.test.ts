import { describe } from 'vitest';
import { RDoubleType } from '../../../../src/typing/types';
import { assertInferredTypes } from '../../_helper/typing/subtyping/assert-inferred-type';
import { Q } from '../../../../src/search/flowr-search-builder';

describe('Infer types for variables', () => {
	assertInferredTypes(
		'x <- 42; x',
		undefined,
		{ query: Q.var('x').first().build(),  expectedType: new RDoubleType() },
		{ query: Q.criterion('1@<-').build(), expectedType: new RDoubleType() },
		{ query: Q.var('x').last().build(),   expectedType: new RDoubleType() },
	);
});