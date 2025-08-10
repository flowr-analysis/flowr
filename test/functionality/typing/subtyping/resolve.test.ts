import { describe, expect, test } from 'vitest';
import type { UnresolvedDataType } from '../../../../src/typing/subtyping/types';
import { constrain, meet, resolve, subsumes, UnresolvedRAtomicVectorType, UnresolvedRFunctionType, UnresolvedRListType, UnresolvedRTypeIntersection, UnresolvedRTypeUnion, UnresolvedRTypeVariable } from '../../../../src/typing/subtyping/types';
import { RIntegerType, RComplexType, RTypeVariable, RDoubleType, RStringType, RListType, RTypeIntersection, RTypeUnion, RNullType, RLanguageType, RLogicalType, RAtomicVectorType } from '../../../../src/typing/types';

describe('Constrain and resolve types', () => {
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

	test('Function overloading 1', () => {
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
		constrain(new RStringType(), paramType2, cache);
		constrain(paramType2, new RStringType(), cache);
		constrain(new RStringType(), funcType2.returnType, cache);
		constrain(funcType2.returnType, new RStringType(), cache);

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
		constrain(new RStringType(), argType2, cache);
		constrain(argType2, new RStringType(), cache);
		const templateFuncType1 = new UnresolvedRFunctionType();
		templateFuncType1.parameterTypes.set(0, argType1);
		const returnType1 = templateFuncType1.returnType;
		const templateFuncType2 = new UnresolvedRFunctionType();
		templateFuncType2.parameterTypes.set(0, argType2);
		const returnType2 = templateFuncType2.returnType;
		constrain(calledFuncType1, templateFuncType1, cache);
		constrain(calledFuncType2, templateFuncType2, cache);

		resolve(calledFuncType1);
		resolve(calledFuncType2);

		// console.debug('funcType1', inspect(funcType1, { depth: null, colors: true }));
		// console.debug('funcType2', inspect(funcType2, { depth: null, colors: true }));
		// console.debug('overloadedFuncType1', inspect(overloadedFuncType1, { depth: null, colors: true }));
		// console.debug('overloadedFuncType2', inspect(overloadedFuncType2, { depth: null, colors: true }));
		// console.debug('calledFuncType1', inspect(calledFuncType1, { depth: null, colors: true }));
		// console.debug('calledFuncType2', inspect(calledFuncType2, { depth: null, colors: true }));
		// console.debug('templateFuncType1', inspect(templateFuncType1, { depth: null, colors: true }));
		// console.debug('templateFuncType2', inspect(templateFuncType2, { depth: null, colors: true }));
		// console.debug('returnType1', inspect(returnType1, { depth: null, colors: true }));
		// console.debug('returnType2', inspect(returnType2, { depth: null, colors: true }));

		expect(resolve(returnType1)).toEqual(new RTypeVariable(new RIntegerType(), new RTypeIntersection()));
		expect(resolve(returnType2)).toEqual(new RTypeVariable(new RStringType(), new RTypeIntersection()));
	});

	test('Function overloading 2', () => {
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

		resolve(calledFuncType1);
		resolve(calledFuncType2);

		// console.debug('funcType1', inspect(funcType1, { depth: null, colors: true }));
		// console.debug('funcType2', inspect(funcType2, { depth: null, colors: true }));
		// console.debug('overloadedFuncType1', inspect(overloadedFuncType1, { depth: null, colors: true }));
		// console.debug('overloadedFuncType2', inspect(overloadedFuncType2, { depth: null, colors: true }));
		// console.debug('calledFuncType1', inspect(calledFuncType1, { depth: null, colors: true }));
		// console.debug('calledFuncType2', inspect(calledFuncType2, { depth: null, colors: true }));
		// console.debug('templateFuncType1', inspect(templateFuncType1, { depth: null, colors: true }));
		// console.debug('templateFuncType2', inspect(templateFuncType2, { depth: null, colors: true }));
		// console.debug('returnType1', inspect(returnType1, { depth: null, colors: true }));
		// console.debug('returnType2', inspect(returnType2, { depth: null, colors: true }));

		expect(resolve(returnType1)).toEqual(new RTypeVariable(new RDoubleType(), new RTypeIntersection()));
		expect(resolve(returnType2)).toEqual(new RTypeVariable(new RDoubleType(), new RTypeIntersection()));
	});
	
	test('Function overloading 3', () => {
		const cache = new Map<UnresolvedDataType, Set<UnresolvedDataType>>();

		// Predetermined types in context
		const funcType1 = new UnresolvedRFunctionType();
		const paramType1 = new UnresolvedRTypeVariable();
		funcType1.parameterTypes.set(0, paramType1);
		// constrain(new RIntegerType(), paramType1, cache);
		constrain(paramType1, new RIntegerType(), cache);
		constrain(new RIntegerType(), funcType1.returnType, cache);
		// constrain(funcType1.returnType, new RIntegerType(), cache);

		const funcType2 = new UnresolvedRFunctionType();
		const paramType2 = new UnresolvedRTypeVariable();
		funcType2.parameterTypes.set(0, paramType2);
		// constrain(new RStringType(), paramType2, cache);
		constrain(paramType2, new RStringType(), cache);
		constrain(new RStringType(), funcType2.returnType, cache);
		// constrain(funcType2.returnType, new RStringType(), cache);

		const funcType3 = new UnresolvedRFunctionType();
		const paramType3 = new UnresolvedRTypeVariable();
		funcType3.parameterTypes.set(0, paramType3);
		const var1 = new UnresolvedRTypeVariable();
		// const var2 = new UnresolvedRTypeVariable();
		constrain(paramType3, var1, cache);
		// constrain(var1, paramType3, cache); // AVOID THIS AT ALL COSTS!
		// constrain(funcType3.returnType, var2, cache);
		// constrain(var2, funcType3.returnType, cache);

		const overloadedFuncType1 = new UnresolvedRTypeIntersection(funcType3, funcType1, funcType2);
		const overloadedFuncType2 = new UnresolvedRTypeIntersection(funcType3, funcType2, funcType1);

		// Typing of called function
		const calledFuncType1 = new UnresolvedRTypeVariable();
		const calledFuncType2 = new UnresolvedRTypeVariable();
		constrain(overloadedFuncType1, calledFuncType1, cache);
		constrain(overloadedFuncType2, calledFuncType2, cache);

		// Typing of function call
		const argType1 = new UnresolvedRTypeVariable();
		// const argType2 = new UnresolvedRTypeVariable();
		constrain(new RIntegerType(), argType1, cache);
		// constrain(argType1, new RIntegerType(), cache);
		// constrain(new RStringType(), argType2, cache);
		// constrain(argType2, new RStringType(), cache);
		const templateFuncType1 = new UnresolvedRFunctionType();
		templateFuncType1.parameterTypes.set(0, argType1);
		const returnType1 = templateFuncType1.returnType;
		const templateFuncType2 = new UnresolvedRFunctionType();
		// templateFuncType2.parameterTypes.set(0, argType2);
		const returnType2 = templateFuncType2.returnType;
		constrain(calledFuncType1, templateFuncType1, cache);
		constrain(calledFuncType2, templateFuncType2, cache);

		resolve(calledFuncType1);
		// resolve(calledFuncType2);

		// console.debug('funcType3', inspect(funcType3, { depth: null, colors: true }));
		// console.debug('funcType1', inspect(funcType1, { depth: null, colors: true }));
		// console.debug('funcType2', inspect(funcType2, { depth: null, colors: true }));
		// console.debug('overloadedFuncType1', inspect(overloadedFuncType1, { depth: null, colors: true }));
		// console.debug('overloadedFuncType2', inspect(overloadedFuncType2, { depth: null, colors: true }));
		// console.debug('calledFuncType1', inspect(calledFuncType1, { depth: null, colors: true }));
		// console.debug('calledFuncType2', inspect(calledFuncType2, { depth: null, colors: true }));
		// console.debug('templateFuncType1', inspect(templateFuncType1, { depth: null, colors: true }));
		// console.debug('templateFuncType2', inspect(templateFuncType2, { depth: null, colors: true }));
		// console.debug('returnType1', inspect(returnType1, { depth: null, colors: true }));
		// console.debug('returnType2', inspect(returnType2, { depth: null, colors: true }));

		expect(resolve(returnType1)).toEqual(new RTypeVariable(new RIntegerType(), new RTypeIntersection()));
		expect(resolve(returnType2)).toEqual(new RTypeVariable(new RTypeUnion(), new RTypeIntersection()));
	});

	test('Constrain from both sides 1', () => {
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
	
	test('Constrain from both sides 2', () => {
		const cache = new Map<UnresolvedDataType, Set<UnresolvedDataType>>();

		const assignmentTypeVar = new UnresolvedRTypeVariable();
		const assignedTypeVar = new UnresolvedRTypeVariable();
		const valueTypeVar = new UnresolvedRTypeVariable();

		// console.debug('Constraining assignedTypeVar <: valueTypeVar');
		constrain(assignedTypeVar, valueTypeVar, cache);
		// console.debug('Constraining valueTypeVar <: assignedTypeVar');
		constrain(valueTypeVar, assignedTypeVar, cache);
		// console.debug('Constraining assignmentTypeVar <: valueTypeVar');
		constrain(assignmentTypeVar, valueTypeVar, cache);
		// console.debug('Constraining valueTypeVar <: assignmentTypeVar');
		constrain(valueTypeVar, assignmentTypeVar, cache);
		// console.debug('Constraining assignmentTypeVar <: new RIntegerType()');
		constrain(new RIntegerType(), valueTypeVar, cache);
		// console.debug('Constraining valueTypeVar <: new RComplexType()');
		constrain(valueTypeVar, new RComplexType(), cache);

		// console.dir(assignmentTypeVar, { depth: null, colors: true });
		// console.dir(assignedTypeVar, { depth: null, colors: true });
		// console.dir(valueTypeVar, { depth: null, colors: true });

		// console.debug('Resolving assignmentTypeVar');
		expect(resolve(assignmentTypeVar)).toEqual(new RTypeVariable(new RIntegerType(), new RComplexType()));
		// console.debug('Resolving assignedTypeVar');
		expect(resolve(assignedTypeVar)).toEqual(new RTypeVariable(new RIntegerType(), new RComplexType()));
		// console.debug('Resolving valueTypeVar');
		expect(resolve(valueTypeVar)).toEqual(new RTypeVariable(new RIntegerType(), new RComplexType()));
	});

	test('Resolve type with complex constraints 1', () => {
		const cache = new Map<UnresolvedDataType, Set<UnresolvedDataType>>();

		const typeVar1 = new UnresolvedRTypeVariable();
		// const typeVar2 = new UnresolvedRTypeVariable();
		// constrain(typeVar1, typeVar2, cache);
		// const elementTypeVar = new UnresolvedRTypeVariable();
		// const typeVar3 = new UnresolvedRTypeVariable();
		// constrain(elementTypeVar, typeVar3, cache);
		// const atomicVectorType = new UnresolvedRAtomicVectorType();
		// const listType1 = new UnresolvedRListType();
		// const union = new UnresolvedRTypeUnion(atomicVectorType, listType1);
		// const listType2 = new UnresolvedRListType();
		constrain(typeVar1, new RStringType(), cache);
		constrain(typeVar1, new RIntegerType(), cache);
		const typeVar4 = new UnresolvedRTypeVariable();
		constrain(typeVar1, typeVar4, cache);
		// const typeVar5 = new UnresolvedRTypeVariable();
		constrain(typeVar4, new RNullType(), cache);
		constrain(typeVar4, new RLanguageType(), cache);
		// const typeVar6 = new UnresolvedRTypeVariable();
		// constrain(typeVar5, typeVar6, cache);
		// const typeVar7 = new UnresolvedRTypeVariable();
		// constrain(typeVar4, typeVar7, cache);

		expect(resolve(typeVar1)).toEqual(new RTypeVariable(new RTypeUnion(), new RTypeIntersection(new RStringType(), new RIntegerType(), new RNullType(), new RLanguageType())));
	});

	test('Resolve type with complex constraints 2', () => {
		const cache = new Map<UnresolvedDataType, Set<UnresolvedDataType>>();

		// 	const typeVar1 = new UnresolvedRTypeVariable(); // ? 5118

		// 	// Subtypes:
		// 	// const typeVar2 = new UnresolvedRTypeVariable(); // ? 5331

		// 	// const typeVar3 = new UnresolvedRTypeVariable(); // ? 5334
		// 	// constrain(typeVar2, typeVar3, cache);

		// 	// constrain(typeVar2, typeVar1, cache);

		// 	// Supertypes:
		// 	const typeVar4 = new UnresolvedRTypeVariable(); // ? 5343
			
		// 	const elementTypeVar1 = new UnresolvedRTypeVariable(); // ? 8299
		// 	// const typeVar5 = new UnresolvedRTypeVariable(); // ? 5352
		// 	// constrain(elementTypeVar1, typeVar5, cache);
		// 	const atomicVectorType1 = new UnresolvedRAtomicVectorType(); // ? 8302
		// 	const listType1 = new UnresolvedRListType(); // ? 8306
		// 	const union1 = new UnresolvedRTypeUnion(atomicVectorType1, listType1); // ? 8310
		// 	constrain(typeVar4, union1, cache);
		// 	const listType2 = new UnresolvedRListType(); // ? 8311
		// 	constrain(typeVar4, listType2, cache);

		// 	const typeVar6 = new UnresolvedRTypeVariable(); // ? 5358

		// 	const elementTypeVar2 = new UnresolvedRTypeVariable(); // ? 8315
		// 	// const typeVar7 = new UnresolvedRTypeVariable(); // ? 5367
		// 	// constrain(elementTypeVar2, typeVar7, cache);
		// 	const atomicVectorType2 = new UnresolvedRAtomicVectorType(); // ? 8318
		// 	const listType3 = new UnresolvedRListType(); // ? 8322
		// 	const union2 = new UnresolvedRTypeUnion(atomicVectorType2, listType3); // ? 8326
		// 	constrain(typeVar6, union2, cache);
		// 	const listType4 = new UnresolvedRListType(); // ? 8327
		// 	constrain(typeVar6, listType4, cache);

		// 	const typeVar8 = new UnresolvedRTypeVariable(); // ? 5451

		// 	const elementTypeVar3 = new UnresolvedRTypeVariable(); // ? 8359
		// 	// const typeVar9 = new UnresolvedRTypeVariable(); // ? 5460
		// 	// constrain(elementTypeVar3, typeVar9, cache);
		// 	const atomicVectorType3 = new UnresolvedRAtomicVectorType(); // ? 8362
		// 	const listType5 = new UnresolvedRListType(); // ? 8366
		// 	const union3 = new UnresolvedRTypeUnion(atomicVectorType3, listType5); // ? 8370
		// 	constrain(typeVar8, union3, cache);
		// 	const listType6 = new UnresolvedRListType(); // ? 8371
		// 	constrain(typeVar8, listType6, cache);

		// 	const typeVar10 = new UnresolvedRTypeVariable(); // ? 5466

		// 	const elementTypeVar4 = new UnresolvedRTypeVariable(); // ? 8375
		// 	// const typeVar11 = new UnresolvedRTypeVariable(); // ? 5475
		// 	// constrain(elementTypeVar4, typeVar11, cache);
		// 	const atomicVectorType4 = new UnresolvedRAtomicVectorType(); // ? 8378
		// 	const listType7 = new UnresolvedRListType(); // ? 8382
		// 	const union4 = new UnresolvedRTypeUnion(atomicVectorType4, listType7); // ? 8386
		// 	constrain(typeVar10, union4, cache);
		// 	const listType8 = new UnresolvedRListType(); // ? 8387
		// 	constrain(typeVar10, listType8, cache);

		// 	constrain(typeVar1, typeVar4, cache);
		// 	constrain(typeVar1, typeVar6, cache);
		// 	constrain(typeVar1, typeVar8, cache);
		// 	constrain(typeVar1, typeVar10, cache);

		const typeVar1 = new UnresolvedRTypeVariable();

		const typeVar4 = new UnresolvedRTypeVariable();
		constrain(typeVar4, new RIntegerType(), cache);
		constrain(typeVar4, new UnresolvedRListType(), cache);

		const typeVar6 = new UnresolvedRTypeVariable();
		constrain(typeVar6, new RIntegerType(), cache);
		constrain(typeVar6, new UnresolvedRListType(), cache);

		const typeVar8 = new UnresolvedRTypeVariable();
		constrain(typeVar8, new RIntegerType(), cache);
		constrain(typeVar8, new UnresolvedRListType(), cache);

		const typeVar10 = new UnresolvedRTypeVariable();
		constrain(typeVar10, new RIntegerType(), cache);
		constrain(typeVar10, new UnresolvedRListType(), cache);

		const typeVar12 = new UnresolvedRTypeVariable();
		constrain(typeVar12, new RIntegerType(), cache);
		constrain(typeVar12, new UnresolvedRListType(), cache);

		constrain(typeVar1, typeVar4, cache);
		constrain(typeVar1, typeVar6, cache);
		constrain(typeVar1, typeVar8, cache);
		constrain(typeVar1, typeVar10, cache);
		constrain(typeVar1, typeVar12, cache);

		expect(resolve(typeVar1)).toEqual(new RTypeVariable(new RTypeUnion(), new RTypeIntersection(new RIntegerType(), new RListType(new RTypeIntersection()))));
	});

	test('Calculate meet with intersections', () => {
		expect(meet(new RTypeIntersection(new RIntegerType(), new RListType(new RNullType())), new RTypeIntersection(new RIntegerType(), new RListType(new RNullType())))).toEqual(new RTypeIntersection(new RIntegerType(), new RListType(new RNullType())));
	});

	test('Test subsumption of types with nested variables', () => {
		const cache = new Map<UnresolvedDataType, Set<UnresolvedDataType>>();

		const logicalType = new RLogicalType();
		const integerType = new RIntegerType();
		const nullType = new RNullType();

		const typeVar1 = new UnresolvedRTypeVariable();
		// eslint-disable-next-line @typescript-eslint/naming-convention
		const typeVar1_1 = new UnresolvedRTypeVariable();
		// eslint-disable-next-line @typescript-eslint/naming-convention
		const typeVar1_2 = new UnresolvedRTypeVariable();
		constrain(logicalType, typeVar1, cache);
		constrain(logicalType, typeVar1_1, cache);
		constrain(logicalType, typeVar1_2, cache);
		constrain(integerType, typeVar1, cache);
		constrain(integerType, typeVar1_1, cache);
		constrain(integerType, typeVar1_2, cache);
		constrain(nullType, typeVar1, cache);
		constrain(nullType, typeVar1_1, cache);
		constrain(nullType, typeVar1_2, cache);
		constrain(typeVar1, typeVar1_1, cache);
		constrain(typeVar1_1, typeVar1_2, cache);

		const typeVar2 = new UnresolvedRTypeVariable();
		constrain(logicalType, typeVar2, cache);
		constrain(integerType, typeVar2, cache);
		constrain(nullType, typeVar2, cache);
		constrain(typeVar2, typeVar1, cache);

		expect(subsumes(typeVar2, typeVar1)).toBe(true);
		expect(subsumes(typeVar1, typeVar2)).toBe(true);
	});

	// <ref *1> UnresolvedRTypeVariable {
	// 	tag: 'RTypeVariable',
	// 	lowerBound: UnresolvedRTypeUnion { tag: 'RTypeUnion', types: Set(0) {} },
	// 	upperBound: UnresolvedRTypeIntersection {
	// 		tag: 'RTypeIntersection',
	// 		types: Set(2) {
	// 		UnresolvedRTypeVariable {
	// 			tag: 'RTypeVariable',
	// 			lowerBound: UnresolvedRTypeUnion { tag: 'RTypeUnion', types: Set(0) {} },
	// 			upperBound: UnresolvedRTypeIntersection {
	// 			tag: 'RTypeIntersection',
	// 			types: Set(1) { [Circular *1] }
	// 			}
	// 		},
	// 		UnresolvedRTypeUnion {
	// 			tag: 'RTypeUnion',
	// 			types: Set(2) {
	// 			UnresolvedRAtomicVectorType {
	// 				tag: 'RAtomicVectorType',
	// 				elementType: UnresolvedRTypeVariable {
	// 				tag: 'RTypeVariable',
	// 				lowerBound: UnresolvedRTypeUnion {
	// 					tag: 'RTypeUnion',
	// 					types: Set(0) {}
	// 				},
	// 				upperBound: UnresolvedRTypeIntersection {
	// 					tag: 'RTypeIntersection',
	// 					types: Set(0) {}
	// 				}
	// 				}
	// 			},
	// 			UnresolvedRListType {
	// 				tag: 'RListType',
	// 				elementType: UnresolvedRTypeVariable {
	// 				tag: 'RTypeVariable',
	// 				lowerBound: UnresolvedRTypeUnion {
	// 					tag: 'RTypeUnion',
	// 					types: Set(0) {}
	// 				},
	// 				upperBound: UnresolvedRTypeIntersection {
	// 					tag: 'RTypeIntersection',
	// 					types: Set(0) {}
	// 				}
	// 				},
	// 				indexedElementTypes: Map(0) {}
	// 			}
	// 			}
	// 		}
	// 		}
	// 	}
	// 	}
	test('Resolve cyclic type variable with upper union', () => {
		const cache = new Map<UnresolvedDataType, Set<UnresolvedDataType>>();

		const typeVar1 = new UnresolvedRTypeVariable();
		// const typeVar2 = new UnresolvedRTypeVariable();
		const elementType = new UnresolvedRTypeVariable();
		const vectorType = new UnresolvedRTypeUnion(new UnresolvedRAtomicVectorType(elementType), new UnresolvedRListType(elementType));
		// constrain(typeVar1, typeVar2, cache);
		constrain(typeVar1, vectorType, cache);
		// constrain(typeVar2, typeVar1, cache);

		// console.debug('Resolving', inspect(typeVar1, { depth: null, colors: true }));

		expect(resolve(typeVar1)).toEqual(new RTypeVariable(new RTypeUnion(), new RTypeUnion(new RAtomicVectorType(new RTypeIntersection()), new RListType(new RTypeIntersection()))));
	});
});