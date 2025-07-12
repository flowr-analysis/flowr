import { describe, expect, test } from 'vitest';
import { constrainWithLowerBound, constrainWithUpperBound, RComplexType, RDoubleType, resolveType, RIntegerType, RListType, RStringType, RTypeIntersection, RTypeVariable, UnresolvedRAtomicVectorType, UnresolvedRListType, UnresolvedRTypeUnion, UnresolvedRTypeVariable } from '../../../src/subtyping/types';

describe.only('Constrain types with lower and upper bounds', () => {
	test('Constrain with numeric bounds', () => {
		const typeVar = new UnresolvedRTypeVariable();
		constrainWithLowerBound(typeVar, new RIntegerType());
		constrainWithUpperBound(typeVar, new RComplexType());
		
		expect(resolveType(typeVar)).toEqual(new RTypeVariable(new RIntegerType(), new RComplexType()));
	});

	test('Constrain with multiple bounds', () => {
		const typeVar = new UnresolvedRTypeVariable();
		constrainWithLowerBound(typeVar, new RIntegerType());
		constrainWithLowerBound(typeVar, new RDoubleType());
		constrainWithUpperBound(typeVar, new UnresolvedRTypeUnion(new RComplexType(), new RStringType()));
		
		expect(resolveType(typeVar)).toEqual(new RTypeVariable(new RDoubleType(), new RComplexType()));
	});

	test('Constrain with compound bounds', () => {
		const typeVar = new UnresolvedRTypeVariable();
		const listType1 = new UnresolvedRListType();
		constrainWithLowerBound(listType1.elementType, new RIntegerType());
		constrainWithLowerBound(typeVar, listType1);
		const listType2 = new UnresolvedRListType();
		constrainWithUpperBound(listType2.elementType, new RComplexType());
		constrainWithUpperBound(typeVar, listType2);
		
		expect(resolveType(typeVar)).toEqual(new RListType(new RTypeVariable(new RIntegerType(), new RComplexType())));
	});

	test('Constraint propagation', () => {
		const typeVar = new UnresolvedRTypeVariable();
		const listType1 = new UnresolvedRListType();
		constrainWithLowerBound(listType1.elementType, new RIntegerType());
		constrainWithLowerBound(typeVar, listType1);
		
		const elementType = new UnresolvedRTypeVariable();
		const listType2 = new UnresolvedRListType(elementType);
		constrainWithUpperBound(typeVar, listType2);
		
		expect(resolveType(typeVar)).toEqual(new RListType(new RTypeVariable(new RIntegerType(), new RTypeIntersection())));
		expect(resolveType(elementType)).toEqual(new RTypeVariable(new RIntegerType(), new RTypeIntersection()));
	});

	test('Advanced constraint propagation', () => {
		const typeVar = new UnresolvedRTypeVariable();
		const listType1 = new UnresolvedRListType();
		constrainWithLowerBound(listType1.elementType, new RIntegerType());
		constrainWithLowerBound(typeVar, listType1);
		
		const elementType = new UnresolvedRTypeVariable();
		const vectorType = new UnresolvedRTypeUnion(new UnresolvedRAtomicVectorType(elementType), new UnresolvedRListType(elementType));
		constrainWithUpperBound(typeVar, vectorType);
		
		expect(resolveType(typeVar)).toEqual(new RListType(new RTypeVariable(new RIntegerType(), new RTypeIntersection())));
		expect(resolveType(elementType)).toEqual(new RTypeVariable(new RIntegerType(), new RTypeIntersection()));
	});
});