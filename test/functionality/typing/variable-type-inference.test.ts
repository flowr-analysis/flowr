import { describe } from 'vitest';
import { RDataTypeTag } from '../../../src/typing/types';
import { assertInferredType, assertInferredTypes } from '../_helper/typing/assert-inferred-type';
import { Q } from '../../../src/search/flowr-search-builder';

describe('Infer types for variables', () => {
	assertInferredTypes(
		'x <- 42; x',
		{ query: Q.var('x').first().build(), expectedType: { tag: RDataTypeTag.Integer as const } },
		{ query: Q.criterion('1@<-').build(), expectedType: { tag: RDataTypeTag.Integer as const } },
		{ query: Q.var('x').last().build(), expectedType: { tag: RDataTypeTag.Integer as const } }
	);
	assertInferredType('y', { tag: RDataTypeTag.Null });
});