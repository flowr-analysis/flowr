import { describe, expect, test } from 'vitest';
import type { UnresolvedDataType } from '../../../../src/typing/subtyping/types';
import { constrain, meet, resolve, UnresolvedRListType, UnresolvedRTypeVariable } from '../../../../src/typing/subtyping/types';
import { RIntegerType, RTypeVariable, RListType, RTypeIntersection, RNullType, RStringType, RLanguageType, RTypeUnion } from '../../../../src/typing/types';

describe('Resolve constrained types', () => {
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

		expect(resolve(typeVar1)).toEqual(new RTypeVariable(new RTypeUnion(), new RTypeIntersection(new RIntegerType(), new RListType(new RTypeVariable()))));
	});

	test('Calculate meet with intersections', () => {
		expect(meet(new RTypeIntersection(new RIntegerType(), new RListType(new RNullType())), new RTypeIntersection(new RIntegerType(), new RListType(new RNullType())))).toEqual(new RTypeIntersection(new RIntegerType(), new RListType(new RNullType())));
	});
});