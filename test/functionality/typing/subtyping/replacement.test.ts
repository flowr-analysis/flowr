import { describe, expect, test } from 'vitest';
import type { DataType } from '../../../../src/typing/types';
import { RTypeIntersection, RAtomicVectorType, RListType, RTypeVariable, RTypeUnion, RNullType, RLogicalType, RComplexType, RDoubleType, RS4Type } from '../../../../src/typing/types';
import { assertInferredTypes } from '../../_helper/typing/subtyping/assert-inferred-type';
import { Q } from '../../../../src/search/flowr-search-builder';

describe('Infer types for subsetting expressions', () => {
	test('placeholder test', () => expect(true).toBe(true)); // Placeholder to ensure the test suite runs

	assertInferredTypes(
		'v <- c(1, 2, 3); v[2] <- y; v',
		undefined,
		{ query: Q.var('v').first().build(),          expectedType: new RAtomicVectorType(new RTypeVariable(new RDoubleType(), new RTypeIntersection())) },
		{ query: Q.var('v').last().build(),           expectedType: new RAtomicVectorType(new RTypeVariable(new RDoubleType(), new RTypeIntersection())) },
		{ query: Q.var('y').last().build(),           upperBound: new RTypeUnion(new RAtomicVectorType(new RTypeIntersection()), new RListType(new RTypeIntersection())) },
		{ query: Q.criterion('1@[').last().build(),   upperBound: new RTypeUnion(new RAtomicVectorType(new RTypeIntersection()), new RListType(new RTypeIntersection())) },
		{ query: Q.criterion('1@<-').first().build(), expectedType: new RAtomicVectorType(new RTypeVariable(new RDoubleType(), new RTypeIntersection())) },
	);
	
	assertInferredTypes(
		'v <- c(1, 2, 3); y <- 1; v[2] <- y; v',
		undefined,
		{ query: Q.var('v').last().build(),         expectedType: new RAtomicVectorType(new RTypeVariable(new RDoubleType(), new RTypeIntersection())) },
		{ query: Q.var('y').last().build(),         expectedType: new RDoubleType() },
		{ query: Q.criterion('1@[').last().build(), expectedType: new RDoubleType() },
	);
	
	const elementType1 = new RTypeVariable(new RDoubleType(), new RTypeIntersection());
	assertInferredTypes(
		'l <- list(1, 2, 3); l[2] <- y; l',
		undefined,
		{ query: Q.var('l').last().build(),         expectedType: new RListType(elementType1, new Map([[0, elementType1], [1, elementType1], [2, elementType1]])) },
		{ query: Q.var('y').last().build(),         upperBound: new RTypeUnion(new RAtomicVectorType(new RTypeIntersection()), new RListType(new RTypeIntersection())) },
		{ query: Q.criterion('1@[').last().build(), upperBound: new RTypeUnion(new RAtomicVectorType(new RTypeIntersection()), new RListType(new RTypeIntersection())) },
	);
	
	assertInferredTypes(
		'v <- c(1, 2, 3); v[] <- y; v',
		undefined,
		{ query: Q.var('v').last().build(),         expectedType: new RAtomicVectorType(new RTypeVariable(new RDoubleType(), new RTypeIntersection())) },
		{ query: Q.var('y').last().build(),         upperBound: new RTypeUnion(new RAtomicVectorType(new RTypeIntersection()), new RListType(new RTypeIntersection())) },
		{ query: Q.criterion('1@[').last().build(), upperBound: new RTypeUnion(new RAtomicVectorType(new RTypeIntersection()), new RListType(new RTypeIntersection())) },
	);
	
	const elementType2 = new RTypeVariable(new RDoubleType(), new RTypeIntersection());
	assertInferredTypes(
		'l <- list(1, 2, 3); l[] <- y; l',
		undefined,
		{ query: Q.var('l').last().build(),         expectedType: new RListType(elementType2, new Map([[0, elementType2], [1, elementType2], [2, elementType2]])) },
		{ query: Q.var('y').last().build(),         upperBound: new RTypeUnion(new RAtomicVectorType(new RTypeIntersection()), new RListType(new RTypeIntersection())) },
		{ query: Q.criterion('1@[').last().build(), upperBound: new RTypeUnion(new RAtomicVectorType(new RTypeIntersection()), new RListType(new RTypeIntersection())) },
	);
	
	assertInferredTypes(
		'v <- c(1, 2, 3); v[[2]] <- y; v',
		undefined,
		{ query: Q.var('v').last().build(),          expectedType: new RAtomicVectorType(new RTypeVariable(new RDoubleType(), new RTypeIntersection())) },
		{ query: Q.var('y').last().build(),          upperBound: new RTypeIntersection() },
		{ query: Q.criterion('1@[[').last().build(), expectedType: new RTypeVariable() },
	);
	
	const elementType3 = new RTypeVariable(new RDoubleType(), new RTypeIntersection());
	assertInferredTypes(
		'l <- list(1, 2, 3); l[[2]] <- y; l',
		undefined,
		{ query: Q.var('l').last().build(),          expectedType: new RListType(elementType1, new Map([[0, elementType3], [1, elementType3], [2, elementType3]])) },
		{ query: Q.var('y').last().build(),          upperBound: new RTypeIntersection() },
		{ query: Q.criterion('1@[[').last().build(), expectedType: new RTypeVariable() },
	);
	
	const elementType4 = new RTypeVariable(new RDoubleType(), new RTypeIntersection());
	assertInferredTypes(
		'l <- list(1, x = 2, 3); l$x <- y; l',
		undefined,
		{ query: Q.var('l').last().build(),         expectedType: new RListType(elementType4, new Map<number | string, DataType>([[0, elementType4], [1, elementType4], [2, elementType4], ['x', elementType4]])) },
		{ query: Q.var('y').last().build(),         upperBound: new RTypeIntersection() },
		{ query: Q.criterion('1@$').last().build(), expectedType: new RTypeVariable() },
	);
	
	const elementType5 = new RTypeVariable(new RDoubleType(), new RTypeIntersection());
	assertInferredTypes(
		'l <- list(1, 2, 3); l$a <- y; l',
		undefined,
		{ query: Q.var('l').last().build(),         expectedType: new RListType(elementType5, new Map([[0, elementType5], [1, elementType5], [2, elementType5]])) },
		{ query: Q.var('y').last().build(),         upperBound: new RTypeIntersection() },
		{ query: Q.criterion('1@$').last().build(), expectedType: new RTypeVariable() },
	);
	
	const elementType6 = new RTypeVariable(new RAtomicVectorType(new RDoubleType()), new RTypeIntersection());
	// eslint-disable-next-line @typescript-eslint/naming-convention
	const elementType6_0 = new RTypeVariable(new RLogicalType(), new RTypeIntersection());
	// eslint-disable-next-line @typescript-eslint/naming-convention
	const elementType6_1 = new RTypeVariable(new RDoubleType(), new RTypeIntersection());
	// eslint-disable-next-line @typescript-eslint/naming-convention
	const elementType6_2 = new RTypeVariable(new RNullType(), new RTypeIntersection());
	assertInferredTypes(
		'l <- list(TRUE, a = 42, NULL); l$a <- y; l',
		undefined,
		{ query: Q.var('l').last().build(),         expectedType: new RListType(elementType6, new Map<number | string, DataType>([[0, elementType6_0], [1, elementType6_1], [2, elementType6_2], ['a', elementType6_1]])) },
		{ query: Q.var('y').last().build(),         upperBound: new RTypeIntersection() },
		{ query: Q.criterion('1@$').last().build(), expectedType: new RTypeVariable() },
	);

	assertInferredTypes(
		'v <- 1; v[[1]] <- y; v',
		undefined,
		{ query: Q.var('v').last().build(),          expectedType: new RTypeVariable(new RDoubleType(), new RAtomicVectorType(new RTypeIntersection())) },
		{ query: Q.var('y').last().build(),          expectedType: new RTypeVariable() },
		{ query: Q.criterion('1@[[').last().build(), expectedType: new RTypeVariable() },
	);
	
	assertInferredTypes(
		'v <- 1; v[[1]] <- 1i; v',
		undefined,
		{ query: Q.var('v').last().build(),          expectedType: new RTypeVariable(new RDoubleType(), new RAtomicVectorType(new RTypeIntersection())) },
		{ query: Q.criterion('1@[[').last().build(), expectedType: new RComplexType() },
	);
	
	assertInferredTypes(
		'v <- NULL; v[1] <- y; v',
		undefined,
		{ query: Q.var('v').last().build(),         expectedType: new RTypeVariable(new RNullType(), new RAtomicVectorType(new RTypeIntersection())) },
		{ query: Q.var('y').last().build(),         upperBound: new RTypeUnion(new RAtomicVectorType(new RTypeIntersection()), new RListType(new RTypeIntersection())) },
		{ query: Q.criterion('1@[').last().build(), upperBound: new RTypeUnion(new RAtomicVectorType(new RTypeIntersection()), new RListType(new RTypeIntersection())) },
	);
	
	assertInferredTypes(
		'o@"name" <- y; o',
		undefined,
		{ query: Q.var('o').last().build(),         upperBound: new RS4Type() },
		{ query: Q.var('y').last().build(),         expectedType: new RTypeVariable() },
		{ query: Q.criterion('1@@').last().build(), expectedType: new RTypeVariable() },
	);
});