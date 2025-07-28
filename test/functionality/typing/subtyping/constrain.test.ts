import { describe, expect, test } from 'vitest';
import type { UnresolvedDataType } from '../../../../src/typing/subtyping/types';
import { constrain, resolve, UnresolvedRAtomicVectorType, UnresolvedRFunctionType, UnresolvedRListType, UnresolvedRTypeIntersection, UnresolvedRTypeUnion, UnresolvedRTypeVariable } from '../../../../src/typing/subtyping/types';
import { RIntegerType, RComplexType, RTypeVariable, RDoubleType, RStringType, RListType, RTypeIntersection } from '../../../../src/typing/types';

describe('Constrain types with lower and upper bounds', () => {
	test('Constrain with numeric bounds', () => {
		const cache = new Map<UnresolvedDataType, Set<UnresolvedDataType>>();

		const typeVar = new UnresolvedRTypeVariable();
		constrain(new RIntegerType(), typeVar, cache);
		constrain(typeVar, new RComplexType(), cache);
		
		expect(resolve(typeVar)).toEqual(new RTypeVariable(new RIntegerType(), new RComplexType()));
	});

	test('Constrain with multiple bounds', () => {
		const cache = new Map<UnresolvedDataType, Set<UnresolvedDataType>>();

		const typeVar = new UnresolvedRTypeVariable();
		constrain(new RIntegerType(), typeVar, cache);
		constrain(new RDoubleType(), typeVar, cache);
		constrain(typeVar, new UnresolvedRTypeUnion(new RComplexType(), new RStringType()), cache);

		expect(resolve(typeVar)).toEqual(new RTypeVariable(new RDoubleType(), new RComplexType()));
	});

	test('Constrain with compound bounds', () => {
		const cache = new Map<UnresolvedDataType, Set<UnresolvedDataType>>();

		const typeVar = new UnresolvedRTypeVariable();
		const listType1 = new UnresolvedRListType();
		constrain(new RIntegerType(), listType1.elementType, cache);
		constrain(listType1, typeVar, cache);
		const listType2 = new UnresolvedRListType();
		constrain(listType2.elementType, new RComplexType(), cache);
		constrain(typeVar, listType2, cache);

		expect(resolve(typeVar)).toEqual(new RListType(new RTypeVariable(new RIntegerType(), new RComplexType())));
	});

	test('Constraint propagation', () => {
		const cache = new Map<UnresolvedDataType, Set<UnresolvedDataType>>();

		const typeVar = new UnresolvedRTypeVariable();
		const listType1 = new UnresolvedRListType();
		constrain(new RIntegerType(), listType1.elementType, cache);
		constrain(listType1, typeVar, cache);

		const elementType = new UnresolvedRTypeVariable();
		const listType2 = new UnresolvedRListType(elementType);
		constrain(typeVar, listType2, cache);

		expect(resolve(typeVar)).toEqual(new RListType(new RTypeVariable(new RIntegerType(), new RTypeIntersection())));
		expect(resolve(elementType)).toEqual(new RTypeVariable(new RIntegerType(), new RTypeIntersection()));
	});

	test('Advanced constraint propagation', () => {
		const cache = new Map<UnresolvedDataType, Set<UnresolvedDataType>>();

		const typeVar = new UnresolvedRTypeVariable();
		const listType1 = new UnresolvedRListType();
		constrain(new RIntegerType(), listType1.elementType, cache);
		constrain(listType1, typeVar, cache);

		const elementType = new UnresolvedRTypeVariable();
		const vectorType = new UnresolvedRTypeUnion(new UnresolvedRAtomicVectorType(elementType), new UnresolvedRListType(elementType));
		constrain(typeVar, vectorType, cache);

		expect(resolve(typeVar)).toEqual(new RListType(new RTypeVariable(new RIntegerType(), new RTypeIntersection())));
		expect(resolve(elementType)).toEqual(new RTypeVariable(new RIntegerType(), new RTypeIntersection()));
	});

	test('Function overloading', () => {
		const cache = new Map<UnresolvedDataType, Set<UnresolvedDataType>>();

		// Predetermined types in context
		const funcType1 = new UnresolvedRFunctionType();
		const paramType1 = new UnresolvedRTypeVariable();
		funcType1.parameterTypes.set(0, paramType1);
		constrain(new RIntegerType(), paramType1, cache);
		constrain(paramType1, new RIntegerType(), cache);
		constrain(new RIntegerType(), funcType1.returnType, cache);
		constrain(funcType1.returnType, new RIntegerType(), cache);

		const funcType2 = new UnresolvedRFunctionType();
		const paramType2 = new UnresolvedRTypeVariable();
		funcType2.parameterTypes.set(0, paramType2);
		constrain(new RDoubleType(), paramType2, cache);
		constrain(paramType2, new RDoubleType(), cache);
		constrain(new RDoubleType(), funcType2.returnType, cache);
		constrain(funcType2.returnType, new RDoubleType(), cache);

		const overloadedFuncType1 = new UnresolvedRTypeIntersection(funcType1, funcType2);
		const overloadedFuncType2 = new UnresolvedRTypeIntersection(funcType1, funcType2);

		// Typing of called function
		const calledFuncType1 = new UnresolvedRTypeVariable();
		const calledFuncType2 = new UnresolvedRTypeVariable();
		constrain(overloadedFuncType1, calledFuncType1, cache);
		constrain(overloadedFuncType2, calledFuncType2, cache);

		// Typing of function call
		const argType1 = new UnresolvedRTypeVariable();
		const argType2 = new UnresolvedRTypeVariable();
		constrain(new RIntegerType(), argType1, cache);
		constrain(argType1, new RIntegerType(), cache);
		constrain(new RDoubleType(), argType2, cache);
		constrain(argType2, new RDoubleType(), cache);
		const templateFuncType1 = new UnresolvedRFunctionType();
		templateFuncType1.parameterTypes.set(0, argType1);
		const returnType1 = templateFuncType1.returnType;
		const templateFuncType2 = new UnresolvedRFunctionType();
		templateFuncType2.parameterTypes.set(0, argType2);
		const returnType2 = templateFuncType2.returnType;
		constrain(calledFuncType1, templateFuncType1, cache);
		constrain(calledFuncType2, templateFuncType2, cache);

		expect(resolve(returnType1)).toEqual(new RTypeVariable(new RIntegerType(), new RTypeIntersection()));
		expect(resolve(returnType2)).toEqual(new RTypeVariable(new RDoubleType(), new RTypeIntersection()));
	});

	test('Constrain from both sides', () => {
		const cache = new Map<UnresolvedDataType, Set<UnresolvedDataType>>();

		const typeVar1 = new UnresolvedRTypeVariable();
		const typeVar2 = new UnresolvedRTypeVariable();
		constrain(typeVar1, typeVar2, cache);
		constrain(typeVar2, typeVar1, cache);
		constrain(new RIntegerType(), typeVar2, cache);
		constrain(typeVar2, new RIntegerType(), cache);

		expect(resolve(typeVar1)).toEqual(new RIntegerType());
		expect(resolve(typeVar2)).toEqual(new RIntegerType());
	});
});