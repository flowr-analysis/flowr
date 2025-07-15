import { describe, expect, test } from 'vitest';
import { constrainWithLowerBound, constrainWithUpperBound, resolveType, UnresolvedRAtomicVectorType, UnresolvedRFunctionType, UnresolvedRListType, UnresolvedRTypeIntersection, UnresolvedRTypeUnion, UnresolvedRTypeVariable } from '../../../../src/typing/subtyping/types';
import { RIntegerType, RComplexType, RTypeVariable, RDoubleType, RStringType, RListType, RTypeIntersection } from '../../../../src/typing/types';

describe('Constrain types with lower and upper bounds', () => {
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

	test('Function overloading', () => {
		// Predetermined types in context
		const funcType1 = new UnresolvedRFunctionType();
		const paramType1 = new UnresolvedRTypeVariable();
		funcType1.parameterTypes.set(0, paramType1);
		paramType1.constrainFromBothSides(new RIntegerType());
		funcType1.returnType.constrainFromBothSides(new RIntegerType());

		const funcType2 = new UnresolvedRFunctionType();
		const paramType2 = new UnresolvedRTypeVariable();
		funcType2.parameterTypes.set(0, paramType2);
		paramType2.constrainFromBothSides(new RDoubleType());
		funcType2.returnType.constrainFromBothSides(new RDoubleType());

		const overloadedFuncType1 = new UnresolvedRTypeIntersection(funcType1, funcType2);
		const overloadedFuncType2 = new UnresolvedRTypeIntersection(funcType1, funcType2);

		// Typing of called function
		const calledFuncType1 = new UnresolvedRTypeVariable();
		const calledFuncType2 = new UnresolvedRTypeVariable();
		calledFuncType1.constrainWithLowerBound(overloadedFuncType1);
		calledFuncType2.constrainWithLowerBound(overloadedFuncType2);

		// Typing of function call
		const argType1 = new UnresolvedRTypeVariable();
		const argType2 = new UnresolvedRTypeVariable();
		argType1.constrainFromBothSides(new RIntegerType());
		argType2.constrainFromBothSides(new RDoubleType());
		const templateFuncType1 = new UnresolvedRFunctionType();
		templateFuncType1.parameterTypes.set(0, argType1);
		const returnType1 = templateFuncType1.returnType;
		const templateFuncType2 = new UnresolvedRFunctionType();
		templateFuncType2.parameterTypes.set(0, argType2);
		const returnType2 = templateFuncType2.returnType;
		calledFuncType1.constrainWithUpperBound(templateFuncType1);
		calledFuncType2.constrainWithUpperBound(templateFuncType2);

		expect(resolveType(returnType1)).toEqual(new RTypeVariable(new RIntegerType(), new RTypeIntersection()));
		expect(resolveType(returnType2)).toEqual(new RTypeVariable(new RDoubleType(), new RTypeIntersection()));
	});
});