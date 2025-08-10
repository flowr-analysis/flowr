import { describe } from 'vitest';
import type { DataType } from '../../../../src/typing/types';
import { RTypeIntersection, RAtomicVectorType, RListType, RTypeVariable, RNullType, RLogicalType, RS4Type, RDoubleType } from '../../../../src/typing/types';
import { assertInferredTypes } from '../../_helper/typing/subtyping/assert-inferred-type';
import { Q } from '../../../../src/search/flowr-search-builder';
import { RType } from '../../../../src/r-bridge/lang-4.x/ast/model/type';

describe('Infer types for subsetting expressions', () => {
	assertInferredTypes(
		'v <- c(1, 2, 3); v[2]',
		undefined,
		{ query: Q.var('v').last().build(),                    expectedType: new RAtomicVectorType(new RTypeVariable(new RDoubleType(), new RTypeIntersection())) },
		{ query: Q.all().filter(RType.Access).first().build(), lowerBound: new RAtomicVectorType(new RDoubleType()) },
	);
	
	const elementType1 = new RTypeVariable(new RDoubleType(), new RTypeIntersection());
	assertInferredTypes(
		'l <- list(1, 2, 3); l[2]',
		undefined,
		{ query: Q.var('l').last().build(),                    expectedType: new RListType(elementType1, new Map([[0, elementType1], [1, elementType1], [2, elementType1]])) },
		{ query: Q.all().filter(RType.Access).first().build(), lowerBound: new RListType(new RDoubleType(), new Map([[0, new RDoubleType()], [1, new RDoubleType()], [2, new RDoubleType()]])) },
	);
	
	assertInferredTypes(
		'v <- c(1, 2, 3); v[]',
		undefined,
		{ query: Q.var('v').last().build(),                    expectedType: new RAtomicVectorType(new RTypeVariable(new RDoubleType(), new RTypeIntersection())) },
		{ query: Q.all().filter(RType.Access).first().build(), lowerBound: new RAtomicVectorType(new RDoubleType()) },
	);
	
	const elementType2 = new RTypeVariable(new RDoubleType(), new RTypeIntersection());
	assertInferredTypes(
		'l <- list(1, 2, 3); l[]',
		undefined,
		{ query: Q.var('l').last().build(),                    expectedType: new RListType(elementType2, new Map([[0, elementType2], [1, elementType2], [2, elementType2]])) },
		{ query: Q.all().filter(RType.Access).first().build(), lowerBound: new RListType(new RDoubleType(), new Map([[0, new RDoubleType()], [1, new RDoubleType()], [2, new RDoubleType()]])) },
	);
	
	assertInferredTypes(
		'v <- c(1, 2, 3); v[[2]]',
		undefined,
		{ query: Q.var('v').last().build(),                    expectedType: new RAtomicVectorType(new RTypeVariable(new RDoubleType(), new RTypeIntersection())) },
		{ query: Q.all().filter(RType.Access).first().build(), lowerBound: new RDoubleType() },
	);
	
	const elementType3 = new RTypeVariable(new RDoubleType(), new RTypeIntersection());
	assertInferredTypes(
		'l <- list(1, 2, 3); l[[2]]',
		undefined,
		{ query: Q.var('l').last().build(),                    expectedType: new RListType(elementType1, new Map([[0, elementType3], [1, elementType3], [2, elementType3]])) },
		{ query: Q.all().filter(RType.Access).first().build(), lowerBound: new RDoubleType() },
	);
	
	const elementType4 = new RTypeVariable(new RDoubleType(), new RTypeIntersection());
	assertInferredTypes(
		'l <- list(1, x = 2, 3); l$x',
		undefined,
		{ query: Q.var('l').last().build(),                    expectedType: new RListType(elementType4, new Map<number | string, DataType>([[0, elementType4], [1, elementType4], [2, elementType4], ['x', elementType4]])) },
		{ query: Q.all().filter(RType.Access).first().build(), lowerBound: new RDoubleType() },
	);
	
	const elementType5 = new RTypeVariable(new RDoubleType(), new RTypeIntersection());
	assertInferredTypes(
		'l <- list(1, 2, 3); l$a',
		undefined,
		{ query: Q.var('l').last().build(),                    expectedType: new RListType(elementType5, new Map([[0, elementType5], [1, elementType5], [2, elementType5]])) },
		{ query: Q.all().filter(RType.Access).first().build(), lowerBound: new RDoubleType() },
	);
	
	const elementType6 = new RTypeVariable(new RAtomicVectorType(new RDoubleType()), new RTypeIntersection());
	// eslint-disable-next-line @typescript-eslint/naming-convention
	const elementType6_0 = new RTypeVariable(new RLogicalType(), new RTypeIntersection());
	// eslint-disable-next-line @typescript-eslint/naming-convention
	const elementType6_1 = new RTypeVariable(new RDoubleType(), new RTypeIntersection());
	// eslint-disable-next-line @typescript-eslint/naming-convention
	const elementType6_2 = new RTypeVariable(new RNullType(), new RTypeIntersection());
	assertInferredTypes(
		'l <- list(TRUE, a = 42, NULL); l$a',
		undefined,
		{ query: Q.var('l').last().build(),                    expectedType: new RListType(elementType6, new Map<number | string, DataType>([[0, elementType6_0], [1, elementType6_1], [2, elementType6_2], ['a', elementType6_1]])) },
		{ query: Q.all().filter(RType.Access).first().build(), lowerBound: new RAtomicVectorType(new RDoubleType()), upperBound: new RTypeIntersection() },
	);

	assertInferredTypes(
		'v <- 1; v[[1]]',
		undefined,
		{ query: Q.var('v').last().build(),                    expectedType: new RDoubleType() },
		{ query: Q.all().filter(RType.Access).first().build(), lowerBound: new RDoubleType() },
	);

	assertInferredTypes(
		'v <- NULL; v[1]',
		undefined,
		{ query: Q.var('v').last().build(),                    expectedType: new RNullType() },
		{ query: Q.all().filter(RType.Access).first().build(), lowerBound: new RNullType() },
	);
	
	assertInferredTypes(
		'o <- new("Object", name = "Flo"); o@name; o',
		undefined,
		{ query: Q.var('o').last().build(),                    upperBound: new RS4Type() },
		{ query: Q.all().filter(RType.Access).first().build(), expectedType: new RTypeVariable() },
	);
});