import { guard } from '../../util/assert';
import type { SimpleType, DataType } from '../types';
import { DataTypeTag, isAtomicVectorBaseType, RAtomicVectorType, RFunctionType, RListType, RTypeError, RTypeIntersection, RTypeUnion, RTypeVariable } from '../types';

// let idCounter = 0;

export class UnresolvedRAtomicVectorType {
	readonly tag = DataTypeTag.AtomicVector;
	// readonly id = idCounter++;
	readonly elementType = new UnresolvedRTypeVariable();

	constructor(elementType?: UnresolvedRTypeVariable) {
		if(elementType !== undefined) {
			this.elementType = elementType;
		}
	}
}

export class UnresolvedRListType {
	readonly tag = DataTypeTag.List;
	// readonly id = idCounter++;
	readonly elementType = new UnresolvedRTypeVariable();
	readonly indexedElementTypes = new Map<number | string, UnresolvedRTypeVariable>();

	constructor(elementType?: UnresolvedRTypeVariable, indexedElementTypes?: Map<number | string, UnresolvedRTypeVariable>) {
		if(elementType !== undefined) {
			this.elementType = elementType;
		}
		if(indexedElementTypes !== undefined) {
			this.indexedElementTypes = indexedElementTypes;
		}
	}
}

export function getIndexedElementTypeFromList(list: UnresolvedRListType, indexOrName: number | string, constraintCache: Map<UnresolvedDataType, Set<UnresolvedDataType>>, prunableVariables: Set<UnresolvedRTypeVariable> = new Set()): UnresolvedRTypeVariable {
	let elementType = list.indexedElementTypes.get(indexOrName);
	if(elementType === undefined) {
		elementType = new UnresolvedRTypeVariable();
		constrain(elementType, list.elementType.upperBound, constraintCache, prunableVariables);
		list.indexedElementTypes.set(indexOrName, elementType);
		constrain(elementType, list.elementType, constraintCache, prunableVariables);
	}
	return elementType;
}

export class UnresolvedRFunctionType {
	readonly tag = DataTypeTag.Function;
	// readonly id = idCounter++;
	readonly parameterTypes = new Map<number | string, UnresolvedRTypeVariable>();
	readonly returnType = new UnresolvedRTypeVariable();

	constructor(parameterTypes?: Map<number | string, UnresolvedRTypeVariable>, returnType?: UnresolvedRTypeVariable) {
		if(parameterTypes !== undefined) {
			this.parameterTypes = parameterTypes;
		}
		if(returnType !== undefined) {
			this.returnType = returnType;
		}
	}
}

export function getParameterTypeFromFunction(func: UnresolvedRFunctionType, indexOrName: number | string): UnresolvedRTypeVariable {
	let parameterType = func.parameterTypes.get(indexOrName);
	if(parameterType === undefined) {
		parameterType = new UnresolvedRTypeVariable();
		func.parameterTypes.set(indexOrName, parameterType);
	}
	return parameterType;
}

export class UnresolvedRTypeUnion {
	readonly tag = DataTypeTag.Union;
	// readonly id = idCounter++;
	types: Set<UnresolvedDataType> = new Set();

	constructor(...types: UnresolvedDataType[]) {
		for(const type of types) {
			guard(type !== this, 'Union cannot contain itself');
			this.types.add(type);
		}
	}
}

export class UnresolvedRTypeIntersection {
	readonly tag = DataTypeTag.Intersection;
	// readonly id = idCounter++;
	types: Set<UnresolvedDataType> = new Set();

	constructor(...types: UnresolvedDataType[]) {
		for(const type of types) {
			guard(type !== this, 'Intersection cannot contain itself');
			this.types.add(type);
		}
	}
}

export class UnresolvedRTypeVariable {
	readonly tag = DataTypeTag.Variable;
	// readonly id = idCounter++;
	readonly lowerBound: UnresolvedRTypeUnion;
	readonly upperBound: UnresolvedRTypeIntersection;

	constructor(lowerBounds: UnresolvedDataType[] = [], upperBounds: UnresolvedDataType[] = []) {
		this.lowerBound = new UnresolvedRTypeUnion(...lowerBounds);
		this.upperBound = new UnresolvedRTypeIntersection(...upperBounds);
	}
}


export function constrain(subtype: UnresolvedDataType, supertype: UnresolvedDataType, cache: Map<UnresolvedDataType, Set<UnresolvedDataType>> = new Map(), prunableVariables: Set<UnresolvedRTypeVariable> = new Set()): boolean {
	// console.debug('Constraining', inspect(subtype, { depth: null, colors: true }), 'to subsume', supertype instanceof UnresolvedRTypeVariable ? supertype.id : inspect(supertype, { depth: null, colors: true }));

	if(subtype === supertype) {
		return false; // No need to constrain if both types are the same
	}

	const cachedConstraints = cache.get(subtype);
	if(cachedConstraints?.has(supertype)) {
		return false; // Avoid infinite recursion
	}
	if(cachedConstraints !== undefined) {
		cachedConstraints.add(supertype);
	} else {
		cache.set(subtype, new Set([supertype]));
	}

	if(subtype instanceof UnresolvedRTypeUnion) {
		for(const type of subtype.types) {
			constrain(type, supertype, cache, prunableVariables);
		}
	} else if(supertype instanceof UnresolvedRTypeIntersection) {
		for(const type of supertype.types) {
			constrain(subtype, type, cache, prunableVariables);
		}
	} else if(subtype instanceof UnresolvedRTypeVariable) {
		subtype.upperBound.types.add(supertype);
		if(supertype instanceof UnresolvedRTypeUnion && supertype.types.size > 0) {
			prunableVariables.add(subtype);
		}
		for(const lowerBound of subtype.lowerBound.types) {
			constrain(lowerBound, supertype, cache, prunableVariables);
		}
	} else if(supertype instanceof UnresolvedRTypeVariable) {
		supertype.lowerBound.types.add(subtype);
		if(subtype instanceof UnresolvedRTypeIntersection && subtype.types.size > 0) {
			prunableVariables.add(supertype);
		}
		for(const upperBound of supertype.upperBound.types) {
			constrain(subtype, upperBound, cache, prunableVariables);
		}
	} else if(subtype instanceof UnresolvedRFunctionType && supertype instanceof UnresolvedRFunctionType) {
		const subtypeParameterKeys = new Set(subtype.parameterTypes.keys());
		const supertypeParameterKeys = new Set(supertype.parameterTypes.keys());
		for(const key of subtypeParameterKeys.intersection(supertypeParameterKeys)) {
			constrain(getParameterTypeFromFunction(supertype, key), getParameterTypeFromFunction(subtype, key), cache, prunableVariables);
		}
		constrain(subtype.returnType, supertype.returnType, cache, prunableVariables);
	} else if(subtype instanceof UnresolvedRAtomicVectorType && supertype instanceof UnresolvedRAtomicVectorType) {
		constrain(subtype.elementType, supertype.elementType, cache, prunableVariables);
	} else if(isAtomicVectorBaseType(subtype) && supertype instanceof UnresolvedRAtomicVectorType) {
		constrain(subtype, supertype.elementType, cache, prunableVariables);
	} else if(subtype instanceof UnresolvedRListType && supertype instanceof UnresolvedRListType) {
		const subtypeElementIndices = new Set(subtype.indexedElementTypes.keys());
		const supertypeElementIndices = new Set(supertype.indexedElementTypes.keys());
		for(const indexOrName of subtypeElementIndices.union(supertypeElementIndices).values()) {
			constrain(getIndexedElementTypeFromList(subtype, indexOrName, cache, prunableVariables), getIndexedElementTypeFromList(supertype, indexOrName, cache, prunableVariables), cache, prunableVariables);
		}
		constrain(subtype.elementType, supertype.elementType, cache, prunableVariables);
	}

	return true; // Successfully constrained types
}


export function prune(variable: UnresolvedRTypeVariable, constraintCache: Map<UnresolvedDataType, Set<UnresolvedDataType>> = new Map(), prunableVariables: Set<UnresolvedRTypeVariable>): boolean {
	// console.debug('Pruning variable', variable.id);

	let newConstraintsFound = false;

	// Prune lower bounds
	for(const lowerBound of variable.lowerBound.types.values()) {
		if(lowerBound instanceof UnresolvedRTypeIntersection) {
			// console.debug('Analyzing lower bound intersection:', inspect(lowerBound, { depth: null, colors: true }));

			if(variable.upperBound.types.size === 0) {
				continue; // If there are no upper bounds, we keep the lower bound
			}

			for(const type of lowerBound.types) {
				if(!variable.upperBound.types.values().some(upperBound => subsumes(type, upperBound))) {
					lowerBound.types.delete(type);
				}
			}

			let newLowerBound: UnresolvedDataType = new UnresolvedRTypeIntersection();
			for(const type of lowerBound.types) {
				newLowerBound = unresolvedMeet(newLowerBound, type, constraintCache, prunableVariables);
			}
			// console.debug('New lower bound:', inspect(newLowerBound, { depth: null, colors: true }));

			lowerBound.types = newLowerBound instanceof UnresolvedRTypeIntersection ? newLowerBound.types : new Set([newLowerBound]);
			
			if(lowerBound.types.size === 1) {
				const [type] = lowerBound.types;
				// console.debug('Constraining', inspect(type, { depth: null, colors: true }), 'to subsume', inspect(variable, { depth: null, colors: true }));
				newConstraintsFound ||= constrain(type, variable, constraintCache, prunableVariables);
			}
		}
	}

	// Prune upper bounds
	for(const upperBound of variable.upperBound.types.values()) {
		if(upperBound instanceof UnresolvedRTypeUnion) {
			// console.debug('Analyzing upper bound union:', inspect(upperBound, { depth: null, colors: true }));

			if(variable.lowerBound.types.size === 0) {
				continue; // If there are no lower bounds, we keep the upper bound
			}

			for(const type of upperBound.types) {
				if(!variable.lowerBound.types.values().some(lowerBound => subsumes(lowerBound, type))) {
					upperBound.types.delete(type);
				}
			}

			let newUpperBound: UnresolvedDataType = new UnresolvedRTypeUnion();
			for(const type of upperBound.types) {
				newUpperBound = unresolvedJoin(newUpperBound, type, constraintCache, prunableVariables);
			}
			// console.debug('New upper bound:', inspect(newUpperBound, { depth: null, colors: true }));

			upperBound.types = newUpperBound instanceof UnresolvedRTypeUnion ? newUpperBound.types : new Set([newUpperBound]);

			if(upperBound.types.size === 1) {
				const [type] = upperBound.types;
				// console.debug('Constraining', inspect(variable, { depth: null, colors: true }), 'to subsume', inspect(type, { depth: null, colors: true }));
				newConstraintsFound ||= constrain(variable, type, constraintCache, prunableVariables);
			}
			
		}
	}
	
	// console.debug('New constraints found:', newConstraintsFound);
	return newConstraintsFound;
}


export function resolve(type: UnresolvedDataType, isUpperBound?: boolean, cache: Map<UnresolvedRTypeVariable, { lowerBound: DataType, upperBound: DataType, combined: DataType }> = new Map()): DataType {
	// console.debug('Resolving', inspect(type, { depth: null, colors: true }));

	if(type instanceof UnresolvedRTypeVariable) {
		const cachedType = cache.get(type);
		if(cachedType !== undefined) {
			switch(isUpperBound) {
				case true:
					return cachedType.upperBound;
				case false:
					return cachedType.lowerBound;
				default:
					return cachedType.combined;
			}
		}
		cache.set(type, { lowerBound: new RTypeUnion(), upperBound: new RTypeIntersection(), combined: new RTypeVariable() }); // Prevent infinite recursion

		const lowerBound = resolve(type.lowerBound, false, cache);
		const upperBound = resolve(type.upperBound, true, cache);

		if(!subsumes(lowerBound, upperBound)) {
			const errorType = new RTypeError(lowerBound, upperBound);
			cache.set(type, { lowerBound: errorType, upperBound: errorType, combined: errorType });
			return errorType;
		}

		const combined = combine(lowerBound, upperBound);
		
		cache.set(type, { lowerBound, upperBound, combined });

		switch(isUpperBound) {
			case true:
				return upperBound;
			case false:
				return lowerBound;
			default:
				return combined;
		}
	} else if(type instanceof UnresolvedRTypeUnion) {
		let resolvedType: DataType = new RTypeUnion();
		for(const subtype of type.types) {
			const resolvedSubtype = resolve(subtype, isUpperBound, cache);
			resolvedType = join(resolvedType, resolvedSubtype);
		}
		return resolvedType;
	} else if(type instanceof UnresolvedRTypeIntersection) {
		let resolvedType: DataType = new RTypeIntersection();
		for(const subtype of type.types) {
			const resolvedSubtype = resolve(subtype, isUpperBound, cache);
			resolvedType = meet(resolvedType, resolvedSubtype);
		}
		return resolvedType;
	} else if(type instanceof UnresolvedRFunctionType) {
		const resolvedParameterTypes = new Map(type.parameterTypes.entries().toArray().map(([key, type]) => {
			return [key, resolve(type, isUpperBound !== undefined ? !isUpperBound : undefined, cache)];
		}));
		const resolvedReturnType = resolve(type.returnType, isUpperBound, cache);
		const resolvedType = new RFunctionType(resolvedParameterTypes, resolvedReturnType);
		return resolvedType;
	} else if(type instanceof UnresolvedRAtomicVectorType) {
		const resolvedElementType = resolve(type.elementType, isUpperBound, cache);
		const resolvedType = new RAtomicVectorType(resolvedElementType);
		return resolvedType;
	} else if(type instanceof UnresolvedRListType) {
		const resolvedElementType = resolve(type.elementType, isUpperBound, cache);
		const resolvedIndexedElementTypes = new Map(type.indexedElementTypes.entries().map(([indexOrName, elementType]) => [indexOrName, resolve(elementType, isUpperBound, cache)]));
		const resolvedType = new RListType(resolvedElementType, resolvedIndexedElementTypes);
		return resolvedType;
	} else {
		return type;
	}
}

export function combine(lowerBound: DataType, upperBound: DataType): DataType {
	// console.debug('Combining', inspect(lowerBound, { depth: null, colors: true }), 'and', inspect(upperBound, { depth: null, colors: true }));

	if(lowerBound instanceof RFunctionType && upperBound instanceof RFunctionType) {
		const parameterTypes = new Map<number | string, DataType>();
		const keys1 = new Set(lowerBound.parameterTypes.keys());
		const keys2 = new Set(upperBound.parameterTypes.keys());
		for(const key of keys1.union(keys2)) {
			const lowerBoundParameterType = lowerBound.parameterTypes.get(key) ?? new RTypeIntersection();
			const upperBoundParameterType = upperBound.parameterTypes.get(key) ?? new RTypeUnion();
			parameterTypes.set(key, combine(upperBoundParameterType, lowerBoundParameterType));
		}
		const returnType = combine(lowerBound.returnType, upperBound.returnType);
		return new RFunctionType(parameterTypes, returnType);
	} else if(lowerBound instanceof RListType && upperBound instanceof RListType) {
		const elementType = combine(lowerBound.elementType, upperBound.elementType);
		const indexedElementTypes = new Map<number | string, DataType>();
		const keys1 = new Set(lowerBound.indexedElementTypes.keys());
		const keys2 = new Set(upperBound.indexedElementTypes.keys());
		for(const key of keys1.union(keys2)) {
			const lowerBoundElementType = lowerBound.indexedElementTypes.get(key) ?? new RTypeUnion();
			const upperBoundElementType = upperBound.indexedElementTypes.get(key) ?? new RTypeIntersection();
			indexedElementTypes.set(key, combine(lowerBoundElementType, upperBoundElementType));
		}
		return new RListType(elementType, indexedElementTypes);
	} else if(lowerBound instanceof RAtomicVectorType && upperBound instanceof RAtomicVectorType) {
		const elementType = combine(lowerBound.elementType, upperBound.elementType);
		return new RAtomicVectorType(elementType);
	} else if(subsumes(lowerBound, upperBound) && subsumes(upperBound, lowerBound)) {
		return lowerBound; // If both types are the same, we return the upper bound
	} else {
		return new RTypeVariable(lowerBound, upperBound); // If the types are not compatible, we create a new variable type that combines both bounds 
	}
}

export function subsumes(subtype: DataType | UnresolvedDataType, supertype: DataType | UnresolvedDataType, inProcess: Map<DataType | UnresolvedDataType, Set<DataType | UnresolvedDataType>> = new Map()): boolean {
	// console.debug('Checking if', inspect(subtype, { depth: null, colors: true }), 'subsumes', inspect(supertype, { depth: null, colors: true }));

	if(subtype === supertype) {
		return true; // If both types are the same, they subsume each other
	}

	let processedSupertypes = inProcess.get(subtype);
	if(processedSupertypes?.has(supertype)) {
		return true; // If we have already processed this pair, we can assume it subsumes
	}
	processedSupertypes ??= new Set();
	processedSupertypes.add(supertype);
	inProcess.set(subtype, processedSupertypes);

	let result: boolean;

	if(subtype.tag === DataTypeTag.Error || supertype.tag === DataTypeTag.Error) {
		result = false; // Error types do not subsume and are not subsumed by any other type
	} else if(subtype.tag === DataTypeTag.Variable) {
		result = subsumes(subtype.lowerBound, supertype, inProcess);
	} else if(supertype.tag === DataTypeTag.Variable) {
		result = subsumes(subtype, supertype.upperBound, inProcess);
	} else if(subtype.tag === DataTypeTag.Union) {
		result = subtype.types.values().every(subtype => subsumes(subtype, supertype, inProcess));
	} else if(supertype.tag === DataTypeTag.Union) {
		result = supertype.types.values().some(supertype => subsumes(subtype, supertype, inProcess));
	} else if(supertype.tag === DataTypeTag.Intersection) {
		result = supertype.types.values().every(supertype => subsumes(subtype, supertype, inProcess));
	} else if(subtype.tag === DataTypeTag.Intersection) {
		result = subtype.types.values().some(subtype => subsumes(subtype, supertype, inProcess));
	} else if(subtype.tag === DataTypeTag.List && supertype.tag === DataTypeTag.List) {
		const subtypeElementIndices = new Set(subtype.indexedElementTypes.keys());
		const supertypeElementIndices = new Set(supertype.indexedElementTypes.keys());
		result = subsumes(subtype.elementType, supertype.elementType, inProcess) && subtypeElementIndices.union(supertypeElementIndices).values().every(indexOrName => {
			return subsumes(subtype.indexedElementTypes.get(indexOrName) ?? new RTypeVariable(), supertype.indexedElementTypes.get(indexOrName) ?? new RTypeVariable(), inProcess);
		});
	} else if(subtype.tag === DataTypeTag.AtomicVector && supertype.tag === DataTypeTag.AtomicVector) {
		result = subsumes(subtype.elementType, supertype.elementType, inProcess);
	} else if(isAtomicVectorBaseType(subtype) && supertype.tag === DataTypeTag.AtomicVector) {
		// A scalar subsumes a vector type if it subsumes the element type of the vector
		result = subsumes(subtype, supertype.elementType, inProcess);
	} else if(subtype.tag === DataTypeTag.AtomicVector && supertype.tag === DataTypeTag.Null) {
		result = subsumes(subtype.elementType, new RTypeUnion());
	} else if(subtype.tag === DataTypeTag.Function && supertype.tag === DataTypeTag.Function) {
		const subtypeParameterKeys = new Set(subtype.parameterTypes.keys());
		const supertypeParameterKeys = new Set(supertype.parameterTypes.keys());
		result = subsumes(subtype.returnType, supertype.returnType, inProcess) && subtypeParameterKeys.intersection(supertypeParameterKeys).values().every(key => {
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			return subsumes(supertype.parameterTypes.get(key)!, subtype.parameterTypes.get(key)!, inProcess);
		});
	} else {
		result = subtype.tag === supertype.tag
			|| subtype.tag === DataTypeTag.Logical && supertype.tag === DataTypeTag.Integer
			|| subtype.tag === DataTypeTag.Logical && supertype.tag === DataTypeTag.Double
			|| subtype.tag === DataTypeTag.Logical && supertype.tag === DataTypeTag.Complex
			|| subtype.tag === DataTypeTag.Integer && supertype.tag === DataTypeTag.Double
			|| subtype.tag === DataTypeTag.Integer && supertype.tag === DataTypeTag.Complex
			|| subtype.tag === DataTypeTag.Double && supertype.tag === DataTypeTag.Complex;
	}

	processedSupertypes?.delete(supertype); // Remove the supertype from the processed set

	return result;
}

export function unresolvedJoin(type1: UnresolvedDataType, type2: UnresolvedDataType, constraintCache: Map<UnresolvedDataType, Set<UnresolvedDataType>>, prunableVariables: Set<UnresolvedRTypeVariable>): UnresolvedDataType {
	// console.debug('Joining (unresolved)', type1, 'and', type2);

	if(type1 instanceof RTypeError) {
		return type1;
	} else if(type2 instanceof RTypeError) {
		return type2;
	} else if(type1 instanceof UnresolvedRTypeVariable) {
		return unresolvedJoin(type1.upperBound, type2, constraintCache, prunableVariables);
	} else if(type2 instanceof UnresolvedRTypeVariable) {
		return unresolvedJoin(type1, type2.upperBound, constraintCache, prunableVariables);
	} else if(type1 instanceof UnresolvedRTypeUnion) {
		if(type1.types.size === 0) {
			return type2; // If type1 is an empty union, return type2
		}

		const types = new Set<UnresolvedDataType>();
		for(const type of type1.types) {
			const joinedType = unresolvedJoin(type, type2, constraintCache, prunableVariables);
			if(joinedType instanceof RTypeError) {
				return joinedType; // If any subtype resolves to an error, return the error
			} else {
				const typesToAdd = new Set(joinedType instanceof UnresolvedRTypeUnion ? joinedType.types : [joinedType]);
				for(const type of types) {
					for(const typeToAdd of typesToAdd) {
						if(subsumes(typeToAdd, type)) {
							// If the current type supersumes the new type, do not add the new type
							typesToAdd.delete(typeToAdd);
						} else if(subsumes(type, typeToAdd)) {
							// If the new type supersumes the current type, remove the current type
							types.delete(type);
						}
					}
				}
				typesToAdd.forEach(type => types.add(type));
			}
		}

		return types.size === 1 ? [...types][0] : new UnresolvedRTypeUnion(...types);
	} else if(type2 instanceof UnresolvedRTypeUnion) {
		return unresolvedJoin(type2, type1, constraintCache, prunableVariables);
	} else if(type1 instanceof UnresolvedRFunctionType && type2 instanceof UnresolvedRFunctionType) {
		const parameterTypes = new Map<number | string, UnresolvedRTypeVariable>();
		const keys1 = new Set(type1.parameterTypes.keys());
		const keys2 = new Set(type2.parameterTypes.keys());
		for(const key of keys1.union(keys2)) {
			const parameterType1 = type1.parameterTypes.get(key) ?? new UnresolvedRTypeIntersection();
			const parameterType2 = type2.parameterTypes.get(key) ?? new UnresolvedRTypeIntersection();
			const metParameterType = unresolvedMeet(parameterType1, parameterType2, constraintCache, prunableVariables);
			const parameterType = new UnresolvedRTypeVariable();
			constrain(metParameterType, parameterType, constraintCache, prunableVariables);
			// constrain(parameterType, metParameterType);
			parameterTypes.set(key, parameterType);
		}
		const joinedReturnType = unresolvedJoin(type1.returnType, type2.returnType, constraintCache, prunableVariables);
		const returnType = new UnresolvedRTypeVariable();
		constrain(returnType, joinedReturnType, constraintCache, prunableVariables);
		// constrain(joinedReturnType, returnType);
		return new UnresolvedRFunctionType(parameterTypes, returnType);
	} else if(type1 instanceof UnresolvedRListType && type2 instanceof UnresolvedRListType) {
		const indexedElementTypes = new Map<number | string, UnresolvedRTypeVariable>();
		const keys1 = new Set(type1.indexedElementTypes.keys());
		const keys2 = new Set(type2.indexedElementTypes.keys());
		for(const key of keys1.intersection(keys2)) {
			const elementType1 = type1.indexedElementTypes.get(key) ?? new UnresolvedRTypeIntersection();
			const elementType2 = type2.indexedElementTypes.get(key) ?? new UnresolvedRTypeIntersection();
			const joinedElementType = unresolvedJoin(elementType1, elementType2, constraintCache, prunableVariables);
			const elementType = new UnresolvedRTypeVariable();
			constrain(elementType, joinedElementType, constraintCache, prunableVariables);
			// constrain(joinedElementType, elementType);
			indexedElementTypes.set(key, elementType);
		}
		const joinedElementType = unresolvedJoin(type1.elementType, type2.elementType, constraintCache, prunableVariables);
		const elementType = new UnresolvedRTypeVariable();
		constrain(elementType, joinedElementType, constraintCache, prunableVariables);
		// constrain(joinedElementType, elementType);
		return new UnresolvedRListType(elementType, indexedElementTypes);
	} else if(type1 instanceof UnresolvedRAtomicVectorType && type2 instanceof UnresolvedRAtomicVectorType) {
		const joinedElementType = unresolvedJoin(type1.elementType, type2.elementType, constraintCache, prunableVariables);
		const elementType = new UnresolvedRTypeVariable();
		constrain(elementType, joinedElementType, constraintCache, prunableVariables);
		// constrain(joinedElementType, elementType);
		return new UnresolvedRAtomicVectorType(elementType);
	} else if(isAtomicVectorBaseType(type1) && type2.tag === DataTypeTag.AtomicVector) {
		const joinedElementType = unresolvedJoin(type1, type2.elementType, constraintCache, prunableVariables);
		const elementType = new UnresolvedRTypeVariable();
		constrain(elementType, joinedElementType, constraintCache, prunableVariables);
		// constrain(joinedElementType, elementType);
		return new UnresolvedRAtomicVectorType(elementType);
	} else if(isAtomicVectorBaseType(type2) && type1.tag === DataTypeTag.AtomicVector) {
		const joinedElementType = unresolvedJoin(type2, type1.elementType, constraintCache, prunableVariables);
		const elementType = new UnresolvedRTypeVariable();
		constrain(elementType, joinedElementType, constraintCache, prunableVariables);
		// constrain(joinedElementType, elementType);
		return new UnresolvedRAtomicVectorType(elementType);
	} else if(subsumes(type1, type2)) {
		return type2;
	} else if(subsumes(type2, type1)) {
		return type1;
	}
	return new UnresolvedRTypeUnion(type1, type2);
}
export function join(type1: DataType, type2: DataType): DataType {
	// console.debug('Joining', type1, 'and', type2);

	if(type1 instanceof RTypeError) {
		return type1;
	} else if(type2 instanceof RTypeError) {
		return type2;
	} else if(type1 instanceof RTypeVariable) {
		return combine(join(type1.lowerBound, type2), join(type1.upperBound, type2));
	} else if(type2 instanceof RTypeVariable) {
		return combine(join(type1, type2.lowerBound), join(type1, type2.upperBound));
	} else if(type1 instanceof RTypeUnion) {
		if(type1.types.size === 0) {
			return type2; // If type1 is an empty union, return type2
		}

		const types = new Set<DataType>();
		for(const subtype of type1.types) {
			const joinedType = join(subtype, type2);
			if(joinedType instanceof RTypeError) {
				return joinedType; // If any subtype resolves to an error, return the error
			} else {
				const typesToAdd = new Set(joinedType instanceof RTypeUnion ? joinedType.types : [joinedType]);
				for(const type of types) {
					for(const typeToAdd of typesToAdd) {
						if(subsumes(typeToAdd, type)) {
							// If the current type supersumes the new type, do not add the new type
							typesToAdd.delete(typeToAdd);
						} else if(subsumes(type, typeToAdd)) {
							// If the new type supersumes the current type, remove the current type
							types.delete(type);
						}
					}
				}
				typesToAdd.forEach(type => types.add(type));
			}
		}

		return types.size === 1 ? [...types][0] : new RTypeUnion(...types);
	} else if(type2 instanceof RTypeUnion) {
		return join(type2, type1);
	} else if(type1 instanceof RFunctionType && type2 instanceof RFunctionType) {
		const parameterTypes = new Map<number | string, DataType>();
		const keys1 = new Set(type1.parameterTypes.keys());
		const keys2 = new Set(type2.parameterTypes.keys());
		for(const key of keys1.union(keys2)) {
			const parameterType1 = type1.parameterTypes.get(key) ?? new RTypeIntersection();
			const parameterType2 = type2.parameterTypes.get(key) ?? new RTypeIntersection();
			parameterTypes.set(key, meet(parameterType1, parameterType2));
		}
		const returnType = join(type1.returnType, type2.returnType);
		return new RFunctionType(parameterTypes, returnType);
	} else if(type1 instanceof RListType && type2 instanceof RListType) {
		const indexedElementTypes = new Map<number | string, DataType>();
		const keys1 = new Set(type1.indexedElementTypes.keys());
		const keys2 = new Set(type2.indexedElementTypes.keys());
		for(const key of keys1.intersection(keys2)) {
			const elementType1 = type1.indexedElementTypes.get(key) ?? new RTypeUnion();
			const elementType2 = type2.indexedElementTypes.get(key) ?? new RTypeUnion();
			indexedElementTypes.set(key, join(elementType1, elementType2));
		}
		return new RListType(join(type1.elementType, type2.elementType), indexedElementTypes);
	} else if(type1 instanceof RAtomicVectorType && type2 instanceof RAtomicVectorType) {
		return new RAtomicVectorType(join(type1.elementType, type2.elementType));
	} else if(isAtomicVectorBaseType(type1) && type2.tag === DataTypeTag.AtomicVector) {
		return new RAtomicVectorType(join(type1, type2.elementType));
	} else if(isAtomicVectorBaseType(type2) && type1.tag === DataTypeTag.AtomicVector) {
		return new RAtomicVectorType(join(type2, type1.elementType));
	} else if(subsumes(type1, type2)) {
		return type2;
	} else if(subsumes(type2, type1)) {
		return type1;
	}
	return new RTypeUnion(type1, type2);
}

export function unresolvedMeet(type1: UnresolvedDataType, type2: UnresolvedDataType, constraintCache: Map<UnresolvedDataType, Set<UnresolvedDataType>>, prunableVariables: Set<UnresolvedRTypeVariable>): UnresolvedDataType {
	// console.debug('Meeting (unresolved)', inspect(type1, { depth: null, colors: true }), 'and', inspect(type2, { depth: null, colors: true }));

	if(type1 instanceof RTypeError) {
		return type1;
	} else if(type2 instanceof RTypeError) {
		return type2;
	} else if(type1 instanceof UnresolvedRTypeVariable) {
		return unresolvedMeet(type1.lowerBound, type2, constraintCache, prunableVariables);
	} else if(type2 instanceof UnresolvedRTypeVariable) {
		return unresolvedMeet(type1, type2.lowerBound, constraintCache, prunableVariables);
	} else if(type1 instanceof UnresolvedRTypeIntersection) {
		if(type1.types.size === 0) {
			return type2; // If type1 is an empty intersection, return type2
		}

		const types = new Set<UnresolvedDataType>();
		for(const subtype of type1.types) {
			const metType = unresolvedMeet(subtype, type2, constraintCache, prunableVariables);
			if(metType instanceof RTypeError) {
				return metType; // If any subtype resolves to an error, return the error
			} else {
				const typesToAdd = new Set(metType instanceof UnresolvedRTypeIntersection ? metType.types : [metType]);
				for(const type of types) {
					for(const typeToAdd of typesToAdd) {
						if(subsumes(type, typeToAdd)) {
							// If the current type subsumes the new type, do not add the new type
							typesToAdd.delete(typeToAdd);
						} else if(subsumes(typeToAdd, type)) {
							// If the new type subsumes the current type, remove the current type
							types.delete(type);
						}
					}
				}
				typesToAdd.forEach(type => types.add(type));
			}
		}

		return types.size === 1 ? [...types][0] : new UnresolvedRTypeIntersection(...types);
	} else if(type2 instanceof UnresolvedRTypeIntersection) {
		return unresolvedMeet(type2, type1, constraintCache, prunableVariables);
	} else if(type1 instanceof UnresolvedRFunctionType && type2 instanceof UnresolvedRFunctionType) {
		const parameterTypes = new Map<number | string, UnresolvedRTypeVariable>();
		const keys1 = new Set(type1.parameterTypes.keys());
		const keys2 = new Set(type2.parameterTypes.keys());
		for(const key of keys1.intersection(keys2)) {
			const parameterType1 = type1.parameterTypes.get(key) ?? new UnresolvedRTypeUnion();
			const parameterType2 = type2.parameterTypes.get(key) ?? new UnresolvedRTypeUnion();
			const joinedParameterType = unresolvedJoin(parameterType1, parameterType2, constraintCache, prunableVariables);
			const parameterType = new UnresolvedRTypeVariable();
			constrain(parameterType, joinedParameterType, constraintCache, prunableVariables);
			// constrain(joinedParameterType, parameterType);
			parameterTypes.set(key, parameterType);
		}
		const metReturnType = unresolvedMeet(type1.returnType, type2.returnType, constraintCache, prunableVariables);
		const returnType = new UnresolvedRTypeVariable();
		constrain(metReturnType, returnType, constraintCache, prunableVariables);
		// constrain(returnType, metReturnType);
		return new UnresolvedRFunctionType(parameterTypes, returnType);
	} else if(type1 instanceof UnresolvedRListType && type2 instanceof UnresolvedRListType) {
		const indexedElementTypes = new Map<number | string, UnresolvedRTypeVariable>();
		const keys1 = new Set(type1.indexedElementTypes.keys());
		const keys2 = new Set(type2.indexedElementTypes.keys());
		for(const key of keys1.union(keys2)) {
			const elementType1 = type1.indexedElementTypes.get(key) ?? new UnresolvedRTypeUnion();
			const elementType2 = type2.indexedElementTypes.get(key) ?? new UnresolvedRTypeUnion();
			const metElementType = unresolvedMeet(elementType1, elementType2, constraintCache, prunableVariables);
			const elementType = new UnresolvedRTypeVariable();
			constrain(metElementType, elementType, constraintCache, prunableVariables);
			// constrain(elementType, metElementType);
			indexedElementTypes.set(key, elementType);
		}
		const metElementType = unresolvedMeet(type1.elementType, type2.elementType, constraintCache, prunableVariables);
		const elementType = new UnresolvedRTypeVariable();
		constrain(metElementType, elementType, constraintCache, prunableVariables);
		// constrain(elementType, metElementType);
		return new UnresolvedRListType(elementType, indexedElementTypes);
	} else if(type1 instanceof RAtomicVectorType && type2 instanceof UnresolvedRAtomicVectorType) {
		const metElementType = unresolvedMeet(type1.elementType, type2.elementType, constraintCache, prunableVariables);
		const elementType = new UnresolvedRTypeVariable();
		constrain(metElementType, elementType, constraintCache, prunableVariables);
		// constrain(elementType, metElementType);
		return new UnresolvedRAtomicVectorType(elementType);
	} else if(isAtomicVectorBaseType(type1) && type2.tag === DataTypeTag.AtomicVector) {
		return unresolvedMeet(type1, type2.elementType, constraintCache, prunableVariables);
	} else if(isAtomicVectorBaseType(type2) && type1.tag === DataTypeTag.AtomicVector) {
		return unresolvedMeet(type2, type1.elementType, constraintCache, prunableVariables);
	} else if(type1.tag === DataTypeTag.AtomicVector && type2.tag === DataTypeTag.Null || type2.tag === DataTypeTag.AtomicVector && type1.tag === DataTypeTag.Null) {
		const elementType = new UnresolvedRTypeVariable();
		constrain(new UnresolvedRTypeUnion(), elementType, constraintCache, prunableVariables);
		return new UnresolvedRAtomicVectorType(elementType);
	} else if(subsumes(type1, type2)) {
		return type1;
	} else if(subsumes(type2, type1)) {
		return type2;
	}
	return new UnresolvedRTypeIntersection(type1, type2);
}
export function meet(type1: DataType, type2: DataType): DataType {
	// console.debug('Meeting', type1, 'and', type2);

	if(type1 instanceof RTypeError) {
		return type1;
	} else if(type2 instanceof RTypeError) {
		return type2;
	} else if(type1 instanceof RTypeVariable) {
		return combine(meet(type1.lowerBound, type2), meet(type1.upperBound, type2));
	} else if(type2 instanceof RTypeVariable) {
		return combine(meet(type1, type2.lowerBound), meet(type1, type2.upperBound));
	} else if(type1 instanceof RTypeIntersection) {
		if(type1.types.size === 0) {
			return type2; // If type1 is an empty intersection, return type2
		}

		const types = new Set<DataType>();
		for(const subtype of type1.types) {
			const metType = meet(subtype, type2);
			if(metType instanceof RTypeError) {
				return metType; // If any subtype resolves to an error, return the error
			} else {
				const typesToAdd = new Set(metType instanceof RTypeIntersection ? metType.types : [metType]);
				for(const type of types) {
					for(const typeToAdd of typesToAdd) {
						if(subsumes(type, typeToAdd)) {
							// If the current type subsumes the new type, do not add the new type
							typesToAdd.delete(typeToAdd);
						} else if(subsumes(typeToAdd, type)) {
							// If the new type subsumes the current type, remove the current type
							types.delete(type);
						}
					}
				}
				typesToAdd.forEach(type => types.add(type));
			}
		}

		return types.size === 1 ? [...types][0] : new RTypeIntersection(...types);
	} else if(type2 instanceof RTypeIntersection) {
		return meet(type2, type1);
	} else if(type1 instanceof RFunctionType && type2 instanceof RFunctionType) {
		const parameterTypes = new Map<number | string, DataType>();
		const keys1 = new Set(type1.parameterTypes.keys());
		const keys2 = new Set(type2.parameterTypes.keys());
		for(const key of keys1.intersection(keys2)) {
			const parameterType1 = type1.parameterTypes.get(key) ?? new RTypeUnion();
			const parameterType2 = type2.parameterTypes.get(key) ?? new RTypeUnion();
			parameterTypes.set(key, join(parameterType1, parameterType2));
		}
		const returnType = meet(type1.returnType, type2.returnType);
		return new RFunctionType(parameterTypes, returnType);
	} else if(type1 instanceof RListType && type2 instanceof RListType) {
		const indexedElementTypes = new Map<number | string, DataType>();
		const keys1 = new Set(type1.indexedElementTypes.keys());
		const keys2 = new Set(type2.indexedElementTypes.keys());
		for(const key of keys1.union(keys2)) {
			const elementType1 = type1.indexedElementTypes.get(key) ?? new RTypeIntersection();
			const elementType2 = type2.indexedElementTypes.get(key) ?? new RTypeIntersection();
			indexedElementTypes.set(key, meet(elementType1, elementType2));
		}
		return new RListType(meet(type1.elementType, type2.elementType), indexedElementTypes);
	} else if(type1 instanceof RAtomicVectorType && type2 instanceof RAtomicVectorType) {
		return new RAtomicVectorType(meet(type1.elementType, type2.elementType));
	} else if(isAtomicVectorBaseType(type1) && type2.tag === DataTypeTag.AtomicVector) {
		return meet(type1, type2.elementType);
	} else if(isAtomicVectorBaseType(type2) && type1.tag === DataTypeTag.AtomicVector) {
		return meet(type2, type1.elementType);
	} else if(type1.tag === DataTypeTag.AtomicVector && type2.tag === DataTypeTag.Null || type2.tag === DataTypeTag.AtomicVector && type1.tag === DataTypeTag.Null) {
		return new RAtomicVectorType(new RTypeUnion());
	} else if(subsumes(type1, type2)) {
		return type1;
	} else if(subsumes(type2, type1)) {
		return type2;
	}
	return new RTypeIntersection(type1, type2);
}


export type UnresolvedDataType
	= SimpleType
	| UnresolvedRAtomicVectorType
	| UnresolvedRListType
	| UnresolvedRFunctionType
	| UnresolvedRTypeUnion
	| UnresolvedRTypeIntersection
	| UnresolvedRTypeVariable
	| RTypeError;