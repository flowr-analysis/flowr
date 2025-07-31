import { describe, expect, test } from 'vitest';
import type { UnresolvedDataType } from '../../../../src/typing/subtyping/types';
import { constrain, subsumes, UnresolvedRTypeVariable } from '../../../../src/typing/subtyping/types';
import { RIntegerType, RNullType, RLogicalType } from '../../../../src/typing/types';

describe('Test subsumption of types', () => {
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
});