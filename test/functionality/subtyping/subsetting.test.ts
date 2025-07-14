import { describe } from 'vitest';
import { RTypeIntersection, RAtomicVectorType, RIntegerType, RListType, RTypeVariable, RTypeUnion, RNullType } from '../../../src/subtyping/types';
import { assertInferredTypes } from '../_helper/subtyping/assert-inferred-type';
import { Q } from '../../../src/search/flowr-search-builder';
import { RType } from '../../../src/r-bridge/lang-4.x/ast/model/type';

describe('Infer types for subsetting expressions', () => {
	assertInferredTypes(
		'v <- c(1, 2, 3); v[2]',
		{ query: Q.var('v').last().build(),                    expectedType: new RAtomicVectorType(new RTypeVariable(new RIntegerType(), new RTypeIntersection())) },
		{ query: Q.all().filter(RType.Access).first().build(), lowerBound: new RAtomicVectorType(new RTypeVariable(new RIntegerType(), new RTypeIntersection())) },
	);
	
	assertInferredTypes(
		'l <- list(1, 2, 3); l[2]',
		{ query: Q.var('l').last().build(),                    expectedType: new RListType(new RTypeVariable(new RIntegerType(), new RTypeIntersection())) },
		{ query: Q.all().filter(RType.Access).first().build(), lowerBound: new RListType(new RTypeVariable(new RIntegerType(), new RTypeIntersection())) },
	);
	
	assertInferredTypes(
		'v <- c(1, 2, 3); v[]',
		{ query: Q.var('v').last().build(),                    expectedType: new RAtomicVectorType(new RTypeVariable(new RIntegerType(), new RTypeIntersection())) },
		{ query: Q.all().filter(RType.Access).first().build(), lowerBound: new RAtomicVectorType(new RTypeVariable(new RIntegerType(), new RTypeIntersection())) },
	);
	
	assertInferredTypes(
		'l <- list(1, 2, 3); l[]',
		{ query: Q.var('l').last().build(),                    expectedType: new RListType(new RTypeVariable(new RIntegerType(), new RTypeIntersection())) },
		{ query: Q.all().filter(RType.Access).first().build(), lowerBound: new RListType(new RTypeVariable(new RIntegerType(), new RTypeIntersection())) },
	);
	
	assertInferredTypes(
		'v <- c(1, 2, 3); v[[2]]',
		{ query: Q.var('v').last().build(),                    expectedType: new RAtomicVectorType(new RTypeVariable(new RIntegerType(), new RTypeIntersection())) },
		{ query: Q.all().filter(RType.Access).first().build(), lowerBound: new RIntegerType() },
	);
	
	assertInferredTypes(
		'l <- list(1, 2, 3); l[[2]]',
		{ query: Q.var('l').last().build(),                    expectedType: new RListType(new RTypeVariable(new RIntegerType(), new RTypeIntersection())) },
		{ query: Q.all().filter(RType.Access).first().build(), lowerBound: new RIntegerType() },
	);
	
	assertInferredTypes(
		'l <- list(1, x = 2, 3); l$x',
		{ query: Q.var('l').last().build(),                    expectedType: new RListType(new RTypeVariable(new RIntegerType(), new RTypeIntersection())) },
		{ query: Q.all().filter(RType.Access).first().build(), lowerBound: new RIntegerType() },
	);
	
	assertInferredTypes(
		'l <- list(1, 2, 3); l$a',
		{ query: Q.var('l').last().build(),                    expectedType: new RListType(new RTypeVariable(new RIntegerType(), new RTypeIntersection())) },
		{ query: Q.all().filter(RType.Access).first().build(), lowerBound: new RIntegerType() },
	);
	
	assertInferredTypes(
		'l <- list(TRUE, a = 42, NULL); l$a',
		{ query: Q.var('l').last().build(),                    expectedType: new RListType(new RTypeVariable(new RTypeUnion(new RIntegerType(), new RNullType()), new RTypeIntersection())) },
		{ query: Q.all().filter(RType.Access).first().build(), lowerBound: new RTypeUnion(new RIntegerType(), new RNullType()), upperBound: new RTypeIntersection() },
	);
});