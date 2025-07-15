import { describe } from 'vitest';
import type { DataType } from '../../../../src/typing/subtyping/types';
import { RTypeIntersection, RAtomicVectorType, RIntegerType, RListType, RTypeVariable, RTypeUnion, RNullType, RLogicalType } from '../../../../src/typing/subtyping/types';
import { assertInferredTypes } from '../../_helper/typing/subtyping/assert-inferred-type';
import { Q } from '../../../../src/search/flowr-search-builder';
import { RType } from '../../../../src/r-bridge/lang-4.x/ast/model/type';

describe('Infer types for subsetting expressions', () => {
	assertInferredTypes(
		'v <- c(1, 2, 3); v[2]',
		{ query: Q.var('v').last().build(),                    expectedType: new RAtomicVectorType(new RTypeVariable(new RIntegerType(), new RTypeIntersection())) },
		{ query: Q.all().filter(RType.Access).first().build(), lowerBound: new RAtomicVectorType(new RTypeVariable(new RIntegerType(), new RTypeIntersection())) },
	);
	
	const elementType1 = new RTypeVariable(new RIntegerType(), new RTypeIntersection());
	assertInferredTypes(
		'l <- list(1, 2, 3); l[2]',
		{ query: Q.var('l').last().build(),                    expectedType: new RListType(elementType1, new Map([[0, elementType1], [1, elementType1], [2, elementType1]])) },
		{ query: Q.all().filter(RType.Access).first().build(), lowerBound: new RListType(elementType1, new Map([[0, elementType1], [1, elementType1], [2, elementType1]])) },
	);
	
	assertInferredTypes(
		'v <- c(1, 2, 3); v[]',
		{ query: Q.var('v').last().build(),                    expectedType: new RAtomicVectorType(new RTypeVariable(new RIntegerType(), new RTypeIntersection())) },
		{ query: Q.all().filter(RType.Access).first().build(), lowerBound: new RAtomicVectorType(new RTypeVariable(new RIntegerType(), new RTypeIntersection())) },
	);
	
	const elementType2 = new RTypeVariable(new RIntegerType(), new RTypeIntersection());
	assertInferredTypes(
		'l <- list(1, 2, 3); l[]',
		{ query: Q.var('l').last().build(),                    expectedType: new RListType(elementType2, new Map([[0, elementType2], [1, elementType2], [2, elementType2]])) },
		{ query: Q.all().filter(RType.Access).first().build(), lowerBound: new RListType(elementType2, new Map([[0, elementType2], [1, elementType2], [2, elementType2]])) },
	);
	
	assertInferredTypes(
		'v <- c(1, 2, 3); v[[2]]',
		{ query: Q.var('v').last().build(),                    expectedType: new RAtomicVectorType(new RTypeVariable(new RIntegerType(), new RTypeIntersection())) },
		{ query: Q.all().filter(RType.Access).first().build(), lowerBound: new RIntegerType() },
	);
	
	const elementType3 = new RTypeVariable(new RIntegerType(), new RTypeIntersection());
	assertInferredTypes(
		'l <- list(1, 2, 3); l[[2]]',
		{ query: Q.var('l').last().build(),                    expectedType: new RListType(elementType1, new Map([[0, elementType3], [1, elementType3], [2, elementType3]])) },
		{ query: Q.all().filter(RType.Access).first().build(), lowerBound: new RIntegerType() },
	);
	
	const elementType4 = new RTypeVariable(new RIntegerType(), new RTypeIntersection());
	assertInferredTypes(
		'l <- list(1, x = 2, 3); l$x',
		{ query: Q.var('l').last().build(),                    expectedType: new RListType(elementType4, new Map<number | string, DataType>([[0, elementType4], [1, elementType4], [2, elementType4], ['x', elementType4]])) },
		{ query: Q.all().filter(RType.Access).first().build(), lowerBound: new RIntegerType() },
	);
	
	const elementType5 = new RTypeVariable(new RIntegerType(), new RTypeIntersection());
	assertInferredTypes(
		'l <- list(1, 2, 3); l$a',
		{ query: Q.var('l').last().build(),                    expectedType: new RListType(elementType5, new Map([[0, elementType5], [1, elementType5], [2, elementType5]])) },
		{ query: Q.all().filter(RType.Access).first().build(), lowerBound: new RIntegerType() },
	);
	
	const elementType6 = new RTypeVariable(new RTypeUnion(new RIntegerType(), new RNullType()), new RTypeIntersection());
	// eslint-disable-next-line @typescript-eslint/naming-convention
	const elementType6_0 = new RTypeVariable(new RLogicalType(), new RTypeIntersection());
	// eslint-disable-next-line @typescript-eslint/naming-convention
	const elementType6_1 = new RTypeVariable(new RIntegerType(), new RTypeIntersection());
	// eslint-disable-next-line @typescript-eslint/naming-convention
	const elementType6_2 = new RTypeVariable(new RNullType(), new RTypeIntersection());
	assertInferredTypes(
		'l <- list(TRUE, a = 42, NULL); l$a',
		{ query: Q.var('l').last().build(),                    expectedType: new RListType(elementType6, new Map<number | string, DataType>([[0, elementType6_0], [1, elementType6_1], [2, elementType6_2], ['a', elementType6_1]])) },
		{ query: Q.all().filter(RType.Access).first().build(), lowerBound: new RTypeUnion(new RIntegerType(), new RNullType()), upperBound: new RTypeIntersection() },
	);
});