import { beforeAll, describe } from 'vitest';
import { RTypeIntersection, RTypeUnion, RTypeVariable } from '../../../../src/typing/types';
import { assertInferredType } from '../../_helper/typing/subtyping/assert-inferred-type';
import type { UnresolvedDataType } from '../../../../src/typing/subtyping/types';
import { loadTracedTypes, loadTurcotteTypes } from '../../../../src/typing/adapter/load-type-signatures';

describe('Infer no type information for currently unsupported R expressions', () => {
	const knownTypes: Map<string, Set<UnresolvedDataType>> = new Map();
	
	beforeAll(async() => {
		await loadTurcotteTypes(knownTypes);
		await loadTracedTypes(knownTypes);
	});

	assertInferredType('1 + 2',                  new RTypeVariable(new RTypeUnion(), new RTypeIntersection()), knownTypes);
	assertInferredType('print("Hello, world!")', new RTypeVariable(new RTypeUnion(), new RTypeIntersection()), knownTypes);
});