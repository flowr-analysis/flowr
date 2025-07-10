import { describe } from 'vitest';
import { RAnyType, RAtomicVectorType, RIntegerType, RListType, RTypeVariable, RVectorType } from '../../../src/subtyping/types';
import { assertInferredTypes } from '../_helper/subtyping/assert-inferred-type';
import { Q } from '../../../src/search/flowr-search-builder';
import { RType } from '../../../src/r-bridge/lang-4.x/ast/model/type';

describe.only('Infer types for subsetting expressions', () => {
	assertInferredTypes(
		'v <- c(1, 2, 3); v[2]',
		{ query: Q.var('v').last().build(),                    lowerBound: new RAtomicVectorType(new RTypeVariable(new RIntegerType(), new RAnyType())), upperBound: new RVectorType(new RTypeVariable(new RIntegerType(), new RAnyType())) },
		{ query: Q.all().filter(RType.Access).first().build(), lowerBound: new RAtomicVectorType(new RTypeVariable(new RIntegerType(), new RAnyType())) },
	);
	
	assertInferredTypes(
		'l <- list(1, 2, 3); l[2]',
		{ query: Q.var('l').last().build(),                    lowerBound: new RListType(new RTypeVariable(new RIntegerType(), new RAnyType())), upperBound: new RVectorType(new RTypeVariable(new RIntegerType(), new RAnyType())) },
		{ query: Q.all().filter(RType.Access).first().build(), lowerBound: new RListType(new RTypeVariable(new RIntegerType(), new RAnyType())) },
	);
	
	assertInferredTypes(
		'v <- c(1, 2, 3); v[]',
		{ query: Q.var('v').last().build(),                    lowerBound: new RAtomicVectorType(new RTypeVariable(new RIntegerType(), new RAnyType())), upperBound: new RVectorType(new RTypeVariable(new RIntegerType(), new RAnyType())) },
		{ query: Q.all().filter(RType.Access).first().build(), lowerBound: new RAtomicVectorType(new RTypeVariable(new RIntegerType(), new RAnyType())) },
	);
	
	assertInferredTypes(
		'l <- list(1, 2, 3); l[]',
		{ query: Q.var('l').last().build(),                    lowerBound: new RListType(new RTypeVariable(new RIntegerType(), new RAnyType())), upperBound: new RVectorType(new RTypeVariable(new RIntegerType(), new RAnyType())) },
		{ query: Q.all().filter(RType.Access).first().build(), lowerBound: new RListType(new RTypeVariable(new RIntegerType(), new RAnyType())) },
	);
	
	assertInferredTypes(
		'v <- c(1, 2, 3); v[[2]]',
		{ query: Q.var('v').last().build(),                    lowerBound: new RAtomicVectorType(new RTypeVariable(new RIntegerType(), new RAnyType())), upperBound: new RVectorType(new RTypeVariable(new RIntegerType(), new RAnyType())) },
		{ query: Q.all().filter(RType.Access).first().build(), lowerBound: new RIntegerType() },
	);
	
	assertInferredTypes(
		'l <- list(1, 2, 3); l[[2]]',
		{ query: Q.var('l').last().build(),                    lowerBound: new RListType(new RTypeVariable(new RIntegerType(), new RAnyType())), upperBound: new RVectorType(new RTypeVariable(new RIntegerType(), new RAnyType())) },
		{ query: Q.all().filter(RType.Access).first().build(), lowerBound: new RIntegerType() },
	);
	
	assertInferredTypes(
		'l <- list(1, x = 2, 3); l$x',
		{ query: Q.var('l').last().build(),                    expectedType: new RListType(new RTypeVariable(new RIntegerType(), new RAnyType())) },
		{ query: Q.all().filter(RType.Access).first().build(), lowerBound: new RIntegerType() },
	);
	
	assertInferredTypes(
		'l <- list(1, 2, 3); l$a',
		{ query: Q.var('l').last().build(),                    expectedType: new RListType(new RTypeVariable(new RIntegerType(), new RAnyType())) },
		{ query: Q.all().filter(RType.Access).first().build(), lowerBound: new RIntegerType() },
	);
	
	assertInferredTypes(
		'l <- list(TRUE, a = 42, NULL); l$a',
		{ query: Q.var('l').last().build(),                    expectedType: new RListType(new RAnyType()) },
		{ query: Q.all().filter(RType.Access).first().build(), expectedType: new RAnyType() },
	);
});