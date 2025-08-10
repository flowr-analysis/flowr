import { describe } from 'vitest';
import { RAtomicVectorType, RComplexType, RDoubleType, RNullType, RStringType, RTypeIntersection, RTypeUnion, RTypeVariable } from '../../../../src/typing/types';
import { assertInferredType } from '../../_helper/typing/subtyping/assert-inferred-type';
import type { UnresolvedDataType } from '../../../../src/typing/subtyping/types';
import { loadTracedTypes, loadTurcotteTypes } from '../../../../src/typing/adapter/load-type-signatures';

describe('Infer no type information for currently unsupported R expressions', async() => {
	const knownTypes: Map<string, Set<UnresolvedDataType>> = new Map();
	
	await loadTurcotteTypes(knownTypes);

	// const printTypes = knownTypes.get('print')?.values().toArray() ?? [];
	// console.dir(printTypes, { depth: null, colors: true });
	// knownTypes.set('print', new Set([printTypes[1]]));
	
	await loadTracedTypes(knownTypes);
	
	assertInferredType('1 + 2',                  new RTypeVariable(new RAtomicVectorType(new RComplexType()), new RTypeIntersection()), knownTypes);
	assertInferredType('print("Hello, world!")', new RTypeVariable(new RTypeUnion(new RAtomicVectorType(new RTypeUnion(new RStringType(), new RDoubleType())), new RNullType()), new RTypeIntersection()), knownTypes);
});