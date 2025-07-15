import { describe } from 'vitest';
import { RDoubleType, RErrorType, RListType, RLogicalType, RNullType } from '../../../../src/typing/unification/types';
import { assertInferredTypes } from '../../_helper/typing/unification/assert-inferred-type';
import { Q } from '../../../../src/search/flowr-search-builder';
import { RType } from '../../../../src/r-bridge/lang-4.x/ast/model/type';

describe('Infer types for subsetting expressions', () => {
	assertInferredTypes(
		'v <- c(1, 2, 3); v[2]',
		{ query: Q.var('v').last().build(),                    expectedType: new RDoubleType() },
		{ query: Q.all().filter(RType.Access).first().build(), expectedType: new RDoubleType() },
	);
	
	assertInferredTypes(
		'l <- list(1, 2, 3); l[2]',
		{ query: Q.var('l').last().build(),                    expectedType: new RListType(new RDoubleType()) },
		{ query: Q.all().filter(RType.Access).first().build(), expectedType: new RListType(new RDoubleType()) },
	);
	
	assertInferredTypes(
		'v <- c(1, 2, 3); v[]',
		{ query: Q.var('v').last().build(),                    expectedType: new RDoubleType() },
		{ query: Q.all().filter(RType.Access).first().build(), expectedType: new RDoubleType() },
	);
	
	assertInferredTypes(
		'l <- list(1, 2, 3); l[]',
		{ query: Q.var('l').last().build(),                    expectedType: new RListType(new RDoubleType()) },
		{ query: Q.all().filter(RType.Access).first().build(), expectedType: new RListType(new RDoubleType()) },
	);
	
	assertInferredTypes(
		'v <- c(1, 2, 3); v[[2]]',
		{ query: Q.var('v').last().build(),                    expectedType: new RDoubleType() },
		{ query: Q.all().filter(RType.Access).first().build(), expectedType: new RDoubleType() },
	);
	
	assertInferredTypes(
		'l <- list(1, 2, 3); l[[2]]',
		{ query: Q.var('l').last().build(),                    expectedType: new RListType(new RDoubleType()) },
		{ query: Q.all().filter(RType.Access).first().build(), expectedType: new RDoubleType() },
	);
	
	assertInferredTypes(
		'l <- list(1, x = 2, 3); l$x',
		{ query: Q.var('l').last().build(),                    expectedType: new RListType(new RDoubleType()) },
		{ query: Q.all().filter(RType.Access).first().build(), expectedType: new RDoubleType() },
	);
	
	assertInferredTypes(
		'l <- list(1, 2, 3); l$a',
		{ query: Q.var('l').last().build(),                    expectedType: new RListType(new RDoubleType()) },
		{ query: Q.all().filter(RType.Access).first().build(), expectedType: new RDoubleType() },
	);
	
	assertInferredTypes(
		'l <- list(TRUE, a = 42, NULL); l$a',
		{ query: Q.var('l').last().build(),                    expectedType: new RListType(new RErrorType(new RErrorType(new RLogicalType(), new RDoubleType()), new RNullType())) },
		{ query: Q.all().filter(RType.Access).first().build(), expectedType: new RErrorType(new RErrorType(new RLogicalType(), new RDoubleType()), new RNullType()) },
	);
});