import { describe } from 'vitest';
import type { DataType } from '../../../../src/typing/types';
import { RComplexType, RDoubleType, RFunctionType, RIntegerType, RAtomicVectorType, RStringType, RTypeIntersection, RTypeVariable } from '../../../../src/typing/types';
import { assertInferredTypes } from '../../_helper/typing/subtyping/assert-inferred-type';
import type { UnresolvedDataType } from '../../../../src/typing/subtyping/types';
import { loadTracedTypes, loadTurcotteTypes } from '../../../../src/typing/adapter/load-type-signatures';
import { Q } from '../../../../src/search/flowr-search-builder';

describe('Infer types for longer code snippets', async() => {
	const knownTypes: Map<string, Set<UnresolvedDataType>> = new Map();
	
	await loadTurcotteTypes(knownTypes);

	// const signatures = knownTypes.get('sum')?.values().toArray() ?? [];
	// console.dir(signatures, { depth: null, colors: true });
	// knownTypes.set('print', new Set([printTypes[1]]));
	
	await loadTracedTypes(knownTypes);
	
	const functionType = new RFunctionType(new Map<number | string, DataType>([[0, new RTypeVariable(new RStringType(), new RTypeIntersection())], [1, new RTypeVariable(new RDoubleType(), new RTypeIntersection())], ['price', new RTypeVariable()], ['quantity', new RTypeVariable()]]), new RTypeVariable());
	
	assertInferredTypes(
		'cost <- function(price, quantity) sum(price * quantity); cost("5.50€", 2)',
		knownTypes,
		{ query: Q.var('cost').first().build(),     expectedType: functionType },
		// { query: Q.var('price').first().build(),    lowerBound: new RStringType() },
		// { query: Q.var('price').last().build(),     lowerBound: new RStringType() },
		// { query: Q.var('quantity').first().build(), lowerBound: new RDoubleType() },
		// { query: Q.var('quantity').last().build(),  lowerBound: new RDoubleType() },
		{ query: Q.criterion('1@*').build(),        lowerBound: new RIntegerType(), upperBound: new RAtomicVectorType(new RComplexType()) },
		{ query: Q.criterion('1@*').build(),        lowerBound: new RIntegerType(), upperBound: new RAtomicVectorType(new RComplexType()) },
		{ query: Q.criterion('1@sum').build(),      lowerBound: new RIntegerType() }
	);
});