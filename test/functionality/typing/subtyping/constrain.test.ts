import { describe, expect, test } from 'vitest';
import type { UnresolvedDataType } from '../../../../src/typing/subtyping/types';
import { constrainWithLowerBound, constrainWithUpperBound, resolveType, UnresolvedRAtomicVectorType, UnresolvedRFunctionType, UnresolvedRListType, UnresolvedRTypeIntersection, UnresolvedRTypeUnion, UnresolvedRTypeVariable } from '../../../../src/typing/subtyping/types';
import { RIntegerType, RComplexType, RTypeVariable, RDoubleType, RStringType, RListType, RTypeIntersection } from '../../../../src/typing/types';

describe('Constrain types with lower and upper bounds', () => {
	test('Constrain with numeric bounds', () => {
		const cache = new Map<UnresolvedDataType, { lowerBounds: Set<UnresolvedDataType>, upperBounds: Set<UnresolvedDataType> }>();

		const typeVar = new UnresolvedRTypeVariable();
		constrainWithLowerBound(typeVar, new RIntegerType(), cache);
		constrainWithUpperBound(typeVar, new RComplexType(), cache);
		
		expect(resolveType(typeVar)).toEqual(new RTypeVariable(new RIntegerType(), new RComplexType()));
	});

	test('Constrain with multiple bounds', () => {
		const cache = new Map<UnresolvedDataType, { lowerBounds: Set<UnresolvedDataType>, upperBounds: Set<UnresolvedDataType> }>();

		const typeVar = new UnresolvedRTypeVariable();
		constrainWithLowerBound(typeVar, new RIntegerType(), cache);
		constrainWithLowerBound(typeVar, new RDoubleType(), cache);
		constrainWithUpperBound(typeVar, new UnresolvedRTypeUnion(new RComplexType(), new RStringType()), cache);

		expect(resolveType(typeVar)).toEqual(new RTypeVariable(new RDoubleType(), new RComplexType()));
	});

	test('Constrain with compound bounds', () => {
		const cache = new Map<UnresolvedDataType, { lowerBounds: Set<UnresolvedDataType>, upperBounds: Set<UnresolvedDataType> }>();

		const typeVar = new UnresolvedRTypeVariable();
		const listType1 = new UnresolvedRListType();
		constrainWithLowerBound(listType1.elementType, new RIntegerType(), cache);
		constrainWithLowerBound(typeVar, listType1, cache);
		const listType2 = new UnresolvedRListType();
		constrainWithUpperBound(listType2.elementType, new RComplexType(), cache);
		constrainWithUpperBound(typeVar, listType2, cache);

		expect(resolveType(typeVar)).toEqual(new RListType(new RTypeVariable(new RIntegerType(), new RComplexType())));
	});

	test('Constraint propagation', () => {
		const cache = new Map<UnresolvedDataType, { lowerBounds: Set<UnresolvedDataType>, upperBounds: Set<UnresolvedDataType> }>();

		const typeVar = new UnresolvedRTypeVariable();
		const listType1 = new UnresolvedRListType();
		constrainWithLowerBound(listType1.elementType, new RIntegerType(), cache);
		constrainWithLowerBound(typeVar, listType1, cache);

		const elementType = new UnresolvedRTypeVariable();
		const listType2 = new UnresolvedRListType(elementType);
		constrainWithUpperBound(typeVar, listType2, cache);

		expect(resolveType(typeVar)).toEqual(new RListType(new RTypeVariable(new RIntegerType(), new RTypeIntersection())));
		expect(resolveType(elementType)).toEqual(new RTypeVariable(new RIntegerType(), new RTypeIntersection()));
	});

	test('Advanced constraint propagation', () => {
		const cache = new Map<UnresolvedDataType, { lowerBounds: Set<UnresolvedDataType>, upperBounds: Set<UnresolvedDataType> }>();

		const typeVar = new UnresolvedRTypeVariable();
		const listType1 = new UnresolvedRListType();
		constrainWithLowerBound(listType1.elementType, new RIntegerType(), cache);
		constrainWithLowerBound(typeVar, listType1, cache);

		const elementType = new UnresolvedRTypeVariable();
		const vectorType = new UnresolvedRTypeUnion(new UnresolvedRAtomicVectorType(elementType), new UnresolvedRListType(elementType));
		constrainWithUpperBound(typeVar, vectorType, cache);

		expect(resolveType(typeVar)).toEqual(new RListType(new RTypeVariable(new RIntegerType(), new RTypeIntersection())));
		expect(resolveType(elementType)).toEqual(new RTypeVariable(new RIntegerType(), new RTypeIntersection()));
	});

	test('Function overloading', () => {
		const cache = new Map<UnresolvedDataType, { lowerBounds: Set<UnresolvedDataType>, upperBounds: Set<UnresolvedDataType> }>();

		// Predetermined types in context
		const funcType1 = new UnresolvedRFunctionType();
		const paramType1 = new UnresolvedRTypeVariable();
		funcType1.parameterTypes.set(0, paramType1);
		constrainWithLowerBound(paramType1, new RIntegerType(), cache);
		constrainWithUpperBound(paramType1, new RIntegerType(), cache);
		constrainWithLowerBound(funcType1.returnType, new RIntegerType(), cache);
		constrainWithUpperBound(funcType1.returnType, new RIntegerType(), cache);

		const funcType2 = new UnresolvedRFunctionType();
		const paramType2 = new UnresolvedRTypeVariable();
		funcType2.parameterTypes.set(0, paramType2);
		constrainWithLowerBound(paramType2, new RDoubleType(), cache);
		constrainWithUpperBound(paramType2, new RDoubleType(), cache);
		constrainWithLowerBound(funcType2.returnType, new RDoubleType(), cache);
		constrainWithUpperBound(funcType2.returnType, new RDoubleType(), cache);

		const overloadedFuncType1 = new UnresolvedRTypeIntersection(funcType1, funcType2);
		const overloadedFuncType2 = new UnresolvedRTypeIntersection(funcType1, funcType2);

		// Typing of called function
		const calledFuncType1 = new UnresolvedRTypeVariable();
		const calledFuncType2 = new UnresolvedRTypeVariable();
		constrainWithLowerBound(calledFuncType1, overloadedFuncType1, cache);
		constrainWithLowerBound(calledFuncType2, overloadedFuncType2, cache);

		// Typing of function call
		const argType1 = new UnresolvedRTypeVariable();
		const argType2 = new UnresolvedRTypeVariable();
		constrainWithLowerBound(argType1, new RIntegerType(), cache);
		constrainWithUpperBound(argType1, new RIntegerType(), cache);
		constrainWithLowerBound(argType2, new RDoubleType(), cache);
		constrainWithUpperBound(argType2, new RDoubleType(), cache);
		const templateFuncType1 = new UnresolvedRFunctionType();
		templateFuncType1.parameterTypes.set(0, argType1);
		const returnType1 = templateFuncType1.returnType;
		const templateFuncType2 = new UnresolvedRFunctionType();
		templateFuncType2.parameterTypes.set(0, argType2);
		const returnType2 = templateFuncType2.returnType;
		constrainWithUpperBound(calledFuncType1, templateFuncType1, cache);
		constrainWithUpperBound(calledFuncType2, templateFuncType2, cache);

		expect(resolveType(returnType1)).toEqual(new RTypeVariable(new RIntegerType(), new RTypeIntersection()));
		expect(resolveType(returnType2)).toEqual(new RTypeVariable(new RDoubleType(), new RTypeIntersection()));
	});
});