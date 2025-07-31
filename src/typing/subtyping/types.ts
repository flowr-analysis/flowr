import { guard } from '../../util/assert';
import type { DataType , AtomicVectorBaseType, REnvironmentType, RLanguageType, RNullType } from '../types';
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

export function getIndexedElementTypeFromList(list: UnresolvedRListType, indexOrName: number | string, constraintCache: Map<UnresolvedDataType, Set<UnresolvedDataType>>): UnresolvedRTypeVariable {
	let elementType = list.indexedElementTypes.get(indexOrName);
	if(elementType === undefined) {
		elementType = new UnresolvedRTypeVariable();
		constrain(elementType, list.elementType.upperBound, constraintCache);
		list.indexedElementTypes.set(indexOrName, elementType);
		constrain(elementType, list.elementType, constraintCache);
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
	readonly lowerBound = new UnresolvedRTypeUnion();
	readonly upperBound = new UnresolvedRTypeIntersection();
}


export function constrain(subtype: UnresolvedDataType, supertype: UnresolvedDataType, cache: Map<UnresolvedDataType, Set<UnresolvedDataType>> = new Map()): void {
	// console.debug('constraining', type, 'with upper bound', bound);

	if(subtype === supertype) {
		return; // No need to constrain if both types are the same
	}

	const cachedConstraints = cache.get(subtype);
	if(cachedConstraints?.has(supertype)) {
		return; // Avoid infinite recursion
	}
	if(cachedConstraints !== undefined) {
		cachedConstraints.add(supertype);
	} else {
		cache.set(subtype, new Set([supertype]));
	}

	if(subtype instanceof UnresolvedRTypeUnion) {
		for(const type of subtype.types) {
			constrain(type, supertype, cache);
		}
	} else if(supertype instanceof UnresolvedRTypeIntersection) {
		for(const type of supertype.types) {
			constrain(type, type, cache);
		}
	} else if(subtype instanceof UnresolvedRTypeVariable) {
		subtype.upperBound.types.add(supertype);
		for(const lowerBound of subtype.lowerBound.types) {
			constrain(lowerBound, supertype, cache);
		}
	} else if(supertype instanceof UnresolvedRTypeVariable) {
		supertype.lowerBound.types.add(subtype);
		for(const upperBound of supertype.upperBound.types) {
			constrain(subtype, upperBound, cache);
		}
	} else if(subtype instanceof UnresolvedRFunctionType && supertype instanceof UnresolvedRFunctionType) {
		const subtypeParameterKeys = new Set(subtype.parameterTypes.keys());
		const supertypeParameterKeys = new Set(supertype.parameterTypes.keys());
		for(const key of subtypeParameterKeys.union(supertypeParameterKeys)) {
			constrain(getParameterTypeFromFunction(supertype, key), getParameterTypeFromFunction(subtype, key), cache);
		}
		constrain(subtype.returnType, supertype.returnType, cache);
	} else if(subtype instanceof UnresolvedRAtomicVectorType && supertype instanceof UnresolvedRAtomicVectorType) {
		constrain(subtype.elementType, supertype.elementType, cache);
	} else if(isAtomicVectorBaseType(subtype) && supertype instanceof UnresolvedRAtomicVectorType) {
		constrain(subtype, supertype.elementType, cache);
	} else if(subtype instanceof UnresolvedRListType && supertype instanceof UnresolvedRListType) {
		constrain(subtype.elementType, supertype.elementType, cache);
	}
}


export function prune(variable: UnresolvedRTypeVariable, inProcess: Set<UnresolvedRTypeVariable | Set<UnresolvedDataType>> = new Set()): void {
	inProcess.add(variable);

	function pruneLowerBounds(lowerBounds: Set<UnresolvedDataType>): Set<UnresolvedDataType> {
		inProcess.add(lowerBounds);

		const prunedBounds = new Set(lowerBounds.values().flatMap(lowerBound => {
			if(lowerBound instanceof UnresolvedRTypeVariable) {
				// If the lower bound is a type variable, we only care about its lower bound
				if(inProcess.has(lowerBound) || inProcess.has(lowerBound.lowerBound.types)) {
					return []; // If the variable is already in process, we skip it to avoid infinite recursion
				}
				prune(lowerBound, inProcess); // Prune the variable recursively w.r.t. its own bounds
				lowerBound.lowerBound.types = pruneLowerBounds(lowerBound.lowerBound.types);
				return [lowerBound];
			} else if(lowerBound instanceof UnresolvedRTypeUnion) {
				// If the lower bound is a union, we prune and include its types directly
				if(inProcess.has(lowerBound.types)) {
					return []; // If the union is already in process, we skip it to avoid infinite recursion
				}
				return pruneLowerBounds(lowerBound.types);
			} else if(lowerBound instanceof UnresolvedRTypeIntersection) {
				// If the lower bound is an intersection, we need to consider its upper bounds
				if(variable.upperBound.types.size === 0) {
					return [lowerBound]; // If there are no upper bounds, we keep the lower bound
				}
				// Otherwise, we prune it to only include types that subsume some upper bound
				let upperBound: UnresolvedDataType = new UnresolvedRTypeUnion();
				for(const type of variable.upperBound.types) {
					upperBound = unresolvedJoin(upperBound, type);
				}
				return [new UnresolvedRTypeIntersection(...lowerBound.types.values().filter(type => {
					if(variable.upperBound.types.values().some(upperBound => subsumes(type, upperBound))) {
						// console.debug('\x1b[36m', 'Constraining', inspect(type, { depth: null, colors: true }), 'with upper bound', inspect(upperBound, { depth: null, colors: true }), '\x1b[0m');
						constrain(type, upperBound);
						return true;
					}
					return false;
				}))];
			} else {
				return [lowerBound]; // If the lower bound is a concrete type, we keep it as is
			}
		}));

		inProcess.delete(lowerBounds);

		return prunedBounds;
	}
	function pruneUpperBounds(upperBounds: Set<UnresolvedDataType>): Set<UnresolvedDataType> {
		inProcess.add(upperBounds);

		const prunedBounds = new Set(upperBounds.values().flatMap(upperBound => {
			if(upperBound instanceof UnresolvedRTypeVariable) {
				// If the upper bound is a type variable, we only care about its upper bound
				if(inProcess.has(upperBound) || inProcess.has(upperBound.upperBound.types)) {
					return []; // If the variable is already in process, we skip it to avoid infinite recursion
				}
				prune(upperBound, inProcess); // Prune the variable recursively w.r.t. its own bounds
				upperBound.upperBound.types = pruneUpperBounds(upperBound.upperBound.types);
				return [upperBound];
			} else if(upperBound instanceof UnresolvedRTypeIntersection) {
				// If the upper bound is an intersection, we prune and include its types directly
				if(inProcess.has(upperBound.types)) {
					return []; // If the intersection is already in process, we skip it to avoid infinite recursion
				}
				return pruneUpperBounds(upperBound.types);
			} else if(upperBound instanceof UnresolvedRTypeUnion) {
				// If the upper bound is a union, we need to consider its lower bounds
				if(variable.lowerBound.types.size === 0) {
					return [upperBound]; // If there are no lower bounds, we keep the upper bound
				}
				// Otherwise, we prune it to only include types that are subsumed by some lower bound
				let lowerBound: UnresolvedDataType = new UnresolvedRTypeIntersection();
				for(const type of variable.lowerBound.types) {
					lowerBound = unresolvedMeet(lowerBound, type);
				}
				return [new UnresolvedRTypeUnion(...upperBound.types.values().filter(type => {
					if(variable.lowerBound.types.values().some(lowerBound => subsumes(lowerBound, type))) {
						// console.debug('\x1b[36m', 'Constraining', inspect(type, { depth: null, colors: true }), 'with lower bound', inspect(lowerBound, { depth: null, colors: true }), '\x1b[0m');
						constrain(lowerBound, type);
						return true;
					}
					return false;
				}))];
			} else {
				return [upperBound]; // If the upper bound is a concrete type, we keep it
			}
		}));

		inProcess.delete(upperBounds);

		return prunedBounds;
	}
	
	variable.lowerBound.types = pruneLowerBounds(variable.lowerBound.types);
	variable.upperBound.types = pruneUpperBounds(variable.upperBound.types);

	inProcess.delete(variable);
}


export function resolve(type: UnresolvedDataType, cache: Map<UnresolvedDataType, DataType> = new Map()): DataType {
	const cachedType = cache.get(type);
	if(cachedType !== undefined) {
		return cachedType;
	}

	if(type instanceof UnresolvedRTypeVariable) {
		cache.set(type, new RTypeVariable()); // Prevent infinite recursion

		prune(type); // Prune the variable to remove unnecessary bounds

		const lowerBound = resolve(type.lowerBound, cache);
		const upperBound = resolve(type.upperBound, cache);

		if(!subsumes(lowerBound, upperBound)) {
			const errorType = new RTypeError(lowerBound, upperBound);
			cache.set(type, errorType);
			return errorType;
		}
		
		if(subsumes(lowerBound, upperBound) && subsumes(upperBound, lowerBound)) {
			cache.set(type, lowerBound);
			return lowerBound; // If both bounds are equal, return one of them
		}
		
		const resolvedType = new RTypeVariable(
			lowerBound instanceof RTypeVariable ? lowerBound.lowerBound : lowerBound,
			upperBound instanceof RTypeVariable ? upperBound.upperBound : upperBound
		);
		cache.set(type, resolvedType);
		return resolvedType;
	} else if(type instanceof UnresolvedRTypeUnion) {
		cache.set(type, new RTypeUnion()); // Prevent infinite recursion

		let resolvedType: DataType = new RTypeUnion();
		for(const subtype of type.types) {
			const resolvedSubtype = resolve(subtype, cache);
			resolvedType = join(resolvedType, resolvedSubtype);
		}
		
		cache.set(type, resolvedType);
		return resolvedType;
	} else if(type instanceof UnresolvedRTypeIntersection) {
		cache.set(type, new RTypeIntersection()); // Prevent infinite recursion

		let resolvedType: DataType = new RTypeIntersection();
		for(const subtype of type.types) {
			const resolvedSubtype = resolve(subtype, cache);
			resolvedType = meet(resolvedType, resolvedSubtype);
		}
		
		cache.set(type, resolvedType);
		return resolvedType;
	} else if(type instanceof UnresolvedRFunctionType) {
		type.parameterTypes.values().forEach(paramType => prune(paramType));
		prune(type.returnType);

		const resolvedParameterTypes = new Map(type.parameterTypes.entries().toArray().map(([key, type]) => [key, resolve(type, cache)]));
		const resolvedReturnType = resolve(type.returnType, cache);
		const resolvedType = new RFunctionType(resolvedParameterTypes, resolvedReturnType);
		
		cache.set(type, resolvedType);
		return resolvedType;
	} else if(type instanceof UnresolvedRAtomicVectorType) {
		prune(type.elementType);

		const resolvedElementType = resolve(type.elementType, cache);
		const resolvedType = new RAtomicVectorType(resolvedElementType);
		
		cache.set(type, resolvedType);
		return resolvedType;
	} else if(type instanceof UnresolvedRListType) {
		type.indexedElementTypes.values().forEach(elementType => prune(elementType));
		prune(type.elementType);

		const resolvedElementType = resolve(type.elementType, cache);
		const resolvedIndexedElementTypes = new Map(type.indexedElementTypes.entries().map(([indexOrName, elementType]) => [indexOrName, resolve(elementType, cache)]));
		const resolvedType = new RListType(resolvedElementType, resolvedIndexedElementTypes);
		
		cache.set(type, resolvedType);
		return resolvedType;
	} else {
		cache.set(type, type);
		return type;
	}
}

export function subsumes(subtype: DataType | UnresolvedDataType, supertype: DataType | UnresolvedDataType, inProcess: Map<DataType | UnresolvedDataType, Set<DataType | UnresolvedDataType>> = new Map()): boolean {
	// console.debug('Checking if', inspect(subtype, { depth: null, colors: true }), 'subsumes', inspect(supertype, { depth: null, colors: true }));

	if(subtype === supertype) {
		return true; // If both types are the same, they subsume each other
	}

	let processedSupertypes = inProcess.get(subtype);
	if(processedSupertypes?.has(supertype)) {
		return true; // Avoid infinite recursion
	}
	processedSupertypes ??= new Set();
	processedSupertypes.add(supertype);
	inProcess.set(subtype, processedSupertypes);

	let result: boolean;

	if(subtype.tag === DataTypeTag.Error || supertype.tag === DataTypeTag.Error) {
		result = false; // Error types do not subsume and are not subsumed by any other type
	} else if(subtype.tag === DataTypeTag.Variable) {
		result = subsumes(subtype.upperBound, supertype, inProcess);
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
		result = subsumes(subtype.elementType, supertype.elementType, inProcess);
	} else if(subtype.tag === DataTypeTag.AtomicVector && supertype.tag === DataTypeTag.AtomicVector) {
		result = subsumes(subtype.elementType, supertype.elementType, inProcess);
	} else if(isAtomicVectorBaseType(subtype) && supertype.tag === DataTypeTag.AtomicVector) {
		// A scalar subsumes a vector type if it subsumes the element type of the vector
		result = subsumes(subtype, supertype.elementType, inProcess);
	} else if(subtype.tag === DataTypeTag.Function && supertype.tag === DataTypeTag.Function) {
		const subtypeParameterKeys = new Set(subtype.parameterTypes.keys());
		const supertypeParameterKeys = new Set(supertype.parameterTypes.keys());
		result = subsumes(subtype.returnType, supertype.returnType, inProcess) && subtypeParameterKeys.intersection(supertypeParameterKeys).values().every(key => {
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			return subsumes(supertype.parameterTypes.get(key)!, subtype.parameterTypes.get(key)!, inProcess);
		});
	} else {
		result = subsumesByTag(subtype.tag, supertype.tag);
	}

	processedSupertypes?.delete(supertype); // Remove the supertype from the processed set

	return result;
}

function subsumesByTag(subtype: DataTypeTag, supertype: DataTypeTag): boolean {
	return subtype === supertype && subtype !== DataTypeTag.Error
		|| subtype === DataTypeTag.Logical && supertype === DataTypeTag.Integer
		|| subtype === DataTypeTag.Logical && supertype === DataTypeTag.Double
		|| subtype === DataTypeTag.Logical && supertype === DataTypeTag.Complex
		|| subtype === DataTypeTag.Integer && supertype === DataTypeTag.Double
		|| subtype === DataTypeTag.Integer && supertype === DataTypeTag.Complex
		|| subtype === DataTypeTag.Double && supertype === DataTypeTag.Complex
		|| [DataTypeTag.Logical, DataTypeTag.Integer, DataTypeTag.Double, DataTypeTag.Complex, DataTypeTag.String, DataTypeTag.Raw].includes(subtype) && supertype === DataTypeTag.AtomicVector;
}

export function unresolvedJoin(type1: UnresolvedDataType, type2: UnresolvedDataType): UnresolvedDataType {
	// console.debug('Joining', type1, 'and', type2);

	if(type1 instanceof RTypeError) {
		return type1;
	} else if(type2 instanceof RTypeError) {
		return type2;
	} else if(type1 instanceof UnresolvedRTypeVariable) {
		return unresolvedJoin(type1.lowerBound, type2);
	} else if(type2 instanceof UnresolvedRTypeVariable) {
		return unresolvedJoin(type1, type2.lowerBound);
	} else if(type1 instanceof UnresolvedRTypeUnion) {
		if(type1.types.size === 0) {
			return type2; // If type1 is an empty union, return type2
		}

		const types = new Set<UnresolvedDataType>();
		for(const type of type1.types) {
			const joinedType = unresolvedJoin(type, type2);
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
		return unresolvedJoin(type2, type1);
	} else if(type1 instanceof UnresolvedRFunctionType && type2 instanceof UnresolvedRFunctionType) {
		const parameterTypes = new Map<number | string, UnresolvedRTypeVariable>();
		const keys1 = new Set(type1.parameterTypes.keys());
		const keys2 = new Set(type2.parameterTypes.keys());
		for(const key of keys1.union(keys2)) {
			const parameterType1 = type1.parameterTypes.get(key) ?? new UnresolvedRTypeUnion();
			const parameterType2 = type2.parameterTypes.get(key) ?? new UnresolvedRTypeUnion();
			const metParameterType = unresolvedMeet(parameterType1, parameterType2);
			const parameterType = new UnresolvedRTypeVariable();
			constrain(metParameterType, parameterType);
			// constrain(parameterType, metParameterType);
			parameterTypes.set(key, parameterType);
		}
		const joinedReturnType = unresolvedJoin(type1.returnType, type2.returnType);
		const returnType = new UnresolvedRTypeVariable();
		constrain(returnType, joinedReturnType);
		// constrain(joinedReturnType, returnType);
		return new UnresolvedRFunctionType(parameterTypes, returnType);
	} else if(type1 instanceof UnresolvedRListType && type2 instanceof UnresolvedRListType) {
		const indexedElementTypes = new Map<number | string, UnresolvedRTypeVariable>();
		const keys1 = new Set(type1.indexedElementTypes.keys());
		const keys2 = new Set(type2.indexedElementTypes.keys());
		for(const key of keys1.intersection(keys2)) {
			const elementType1 = type1.indexedElementTypes.get(key) ?? new UnresolvedRTypeIntersection();
			const elementType2 = type2.indexedElementTypes.get(key) ?? new UnresolvedRTypeIntersection();
			const joinedElementType = unresolvedJoin(elementType1, elementType2);
			const elementType = new UnresolvedRTypeVariable();
			constrain(elementType, joinedElementType);
			// constrain(joinedElementType, elementType);
			indexedElementTypes.set(key, elementType);
		}
		const joinedElementType = unresolvedJoin(type1.elementType, type2.elementType);
		const elementType = new UnresolvedRTypeVariable();
		constrain(elementType, joinedElementType);
		// constrain(joinedElementType, elementType);
		return new UnresolvedRListType(elementType, indexedElementTypes);
	} else if(type1 instanceof UnresolvedRAtomicVectorType && type2 instanceof UnresolvedRAtomicVectorType) {
		const joinedElementType = unresolvedJoin(type1.elementType, type2.elementType);
		const elementType = new UnresolvedRTypeVariable();
		constrain(elementType, joinedElementType);
		// constrain(joinedElementType, elementType);
		return new UnresolvedRAtomicVectorType(elementType);
	} else if(isAtomicVectorBaseType(type1) && type2.tag === DataTypeTag.AtomicVector) {
		const joinedElementType = unresolvedJoin(type1, type2.elementType);
		const elementType = new UnresolvedRTypeVariable();
		constrain(elementType, joinedElementType);
		// constrain(joinedElementType, elementType);
		return new UnresolvedRAtomicVectorType(elementType);
	} else if(isAtomicVectorBaseType(type2) && type1.tag === DataTypeTag.AtomicVector) {
		const joinedElementType = unresolvedJoin(type2, type1.elementType);
		const elementType = new UnresolvedRTypeVariable();
		constrain(elementType, joinedElementType);
		// constrain(joinedElementType, elementType);
		return new UnresolvedRAtomicVectorType(elementType);
	} else if(subsumesByTag(type1.tag, type2.tag)) {
		return type2;
	} else if(subsumesByTag(type2.tag, type1.tag)) {
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
		return join(type1.lowerBound, type2);
	} else if(type2 instanceof RTypeVariable) {
		return join(type1, type2.lowerBound);
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
			const parameterType1 = type1.parameterTypes.get(key) ?? new RTypeUnion();
			const parameterType2 = type2.parameterTypes.get(key) ?? new RTypeUnion();
			parameterTypes.set(key, meet(parameterType1, parameterType2));
		}
		const returnType = join(type1.returnType, type2.returnType);
		return new RFunctionType(parameterTypes, returnType);
	} else if(type1 instanceof RListType && type2 instanceof RListType) {
		const indexedElementTypes = new Map<number | string, DataType>();
		const keys1 = new Set(type1.indexedElementTypes.keys());
		const keys2 = new Set(type2.indexedElementTypes.keys());
		for(const key of keys1.intersection(keys2)) {
			const elementType1 = type1.indexedElementTypes.get(key) ?? new RTypeIntersection();
			const elementType2 = type2.indexedElementTypes.get(key) ?? new RTypeIntersection();
			indexedElementTypes.set(key, join(elementType1, elementType2));
		}
		return new RListType(join(type1.elementType, type2.elementType), indexedElementTypes);
	} else if(type1 instanceof RAtomicVectorType && type2 instanceof RAtomicVectorType) {
		return new RAtomicVectorType(join(type1.elementType, type2.elementType));
	} else if(isAtomicVectorBaseType(type1) && type2.tag === DataTypeTag.AtomicVector) {
		return new RAtomicVectorType(join(type1, type2.elementType));
	} else if(isAtomicVectorBaseType(type2) && type1.tag === DataTypeTag.AtomicVector) {
		return new RAtomicVectorType(join(type2, type1.elementType));
	} else if(subsumesByTag(type1.tag, type2.tag)) {
		return type2;
	} else if(subsumesByTag(type2.tag, type1.tag)) {
		return type1;
	}
	return new RTypeUnion(type1, type2);
}

export function unresolvedMeet(type1: UnresolvedDataType, type2: UnresolvedDataType): UnresolvedDataType {
	// console.debug('Meeting', type1, 'and', type2);

	if(type1 instanceof RTypeError) {
		return type1;
	} else if(type2 instanceof RTypeError) {
		return type2;
	} else if(type1 instanceof UnresolvedRTypeVariable) {
		return unresolvedMeet(type1.upperBound, type2);
	} else if(type2 instanceof UnresolvedRTypeVariable) {
		return unresolvedMeet(type1, type2.upperBound);
	} else if(type1 instanceof UnresolvedRTypeIntersection) {
		if(type1.types.size === 0) {
			return type2; // If type1 is an empty intersection, return type2
		}

		const types = new Set<UnresolvedDataType>();
		for(const subtype of type1.types) {
			const metType = unresolvedMeet(subtype, type2);
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
		return unresolvedMeet(type2, type1);
	} else if(type1 instanceof UnresolvedRFunctionType && type2 instanceof UnresolvedRFunctionType) {
		const parameterTypes = new Map<number | string, UnresolvedRTypeVariable>();
		const keys1 = new Set(type1.parameterTypes.keys());
		const keys2 = new Set(type2.parameterTypes.keys());
		for(const key of keys1.intersection(keys2)) {
			const parameterType1 = type1.parameterTypes.get(key) ?? new UnresolvedRTypeIntersection();
			const parameterType2 = type2.parameterTypes.get(key) ?? new UnresolvedRTypeIntersection();
			const joinedParameterType = unresolvedJoin(parameterType1, parameterType2);
			const parameterType = new UnresolvedRTypeVariable();
			constrain(parameterType, joinedParameterType);
			// constrain(joinedParameterType, parameterType);
			parameterTypes.set(key, parameterType);
		}
		const metReturnType = unresolvedMeet(type1.returnType, type2.returnType);
		const returnType = new UnresolvedRTypeVariable();
		constrain(metReturnType, returnType);
		// constrain(returnType, metReturnType);
		return new UnresolvedRFunctionType(parameterTypes, returnType);
	} else if(type1 instanceof UnresolvedRListType && type2 instanceof UnresolvedRListType) {
		const indexedElementTypes = new Map<number | string, UnresolvedRTypeVariable>();
		const keys1 = new Set(type1.indexedElementTypes.keys());
		const keys2 = new Set(type2.indexedElementTypes.keys());
		for(const key of keys1.union(keys2)) {
			const elementType1 = type1.indexedElementTypes.get(key) ?? new UnresolvedRTypeUnion();
			const elementType2 = type2.indexedElementTypes.get(key) ?? new UnresolvedRTypeUnion();
			const metElementType = unresolvedMeet(elementType1, elementType2);
			const elementType = new UnresolvedRTypeVariable();
			constrain(metElementType, elementType);
			// constrain(elementType, metElementType);
			indexedElementTypes.set(key, elementType);
		}
		const metElementType = unresolvedMeet(type1.elementType, type2.elementType);
		const elementType = new UnresolvedRTypeVariable();
		constrain(metElementType, elementType);
		// constrain(elementType, metElementType);
		return new UnresolvedRListType(elementType, indexedElementTypes);
	} else if(type1 instanceof RAtomicVectorType && type2 instanceof UnresolvedRAtomicVectorType) {
		const metElementType = unresolvedMeet(type1.elementType, type2.elementType);
		const elementType = new UnresolvedRTypeVariable();
		constrain(metElementType, elementType);
		// constrain(elementType, metElementType);
		return new UnresolvedRAtomicVectorType(elementType);
	} else if(isAtomicVectorBaseType(type1) && type2.tag === DataTypeTag.AtomicVector) {
		return unresolvedMeet(type1, type2.elementType);
	} else if(isAtomicVectorBaseType(type2) && type1.tag === DataTypeTag.AtomicVector) {
		return unresolvedMeet(type2, type1.elementType);
	} else if(subsumesByTag(type1.tag, type2.tag)) {
		return type1;
	} else if(subsumesByTag(type2.tag, type1.tag)) {
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
		return meet(type1.upperBound, type2);
	} else if(type2 instanceof RTypeVariable) {
		return meet(type1, type2.upperBound);
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
			const parameterType1 = type1.parameterTypes.get(key) ?? new RTypeIntersection();
			const parameterType2 = type2.parameterTypes.get(key) ?? new RTypeIntersection();
			parameterTypes.set(key, join(parameterType1, parameterType2));
		}
		const returnType = meet(type1.returnType, type2.returnType);
		return new RFunctionType(parameterTypes, returnType);
	} else if(type1 instanceof RListType && type2 instanceof RListType) {
		const indexedElementTypes = new Map<number | string, DataType>();
		const keys1 = new Set(type1.indexedElementTypes.keys());
		const keys2 = new Set(type2.indexedElementTypes.keys());
		for(const key of keys1.union(keys2)) {
			const elementType1 = type1.indexedElementTypes.get(key) ?? new RTypeUnion();
			const elementType2 = type2.indexedElementTypes.get(key) ?? new RTypeUnion();
			indexedElementTypes.set(key, meet(elementType1, elementType2));
		}
		return new RListType(meet(type1.elementType, type2.elementType), indexedElementTypes);
	} else if(type1 instanceof RAtomicVectorType && type2 instanceof RAtomicVectorType) {
		return new RAtomicVectorType(meet(type1.elementType, type2.elementType));
	} else if(isAtomicVectorBaseType(type1) && type2.tag === DataTypeTag.AtomicVector) {
		return meet(type1, type2.elementType);
	} else if(isAtomicVectorBaseType(type2) && type1.tag === DataTypeTag.AtomicVector) {
		return meet(type2, type1.elementType);
	} else if(subsumesByTag(type1.tag, type2.tag)) {
		return type1;
	} else if(subsumesByTag(type2.tag, type1.tag)) {
		return type2;
	}
	return new RTypeIntersection(type1, type2);
}


export type UnresolvedDataType
	= UnresolvedRAtomicVectorType
	| AtomicVectorBaseType
	| UnresolvedRListType
	| RNullType
	| UnresolvedRFunctionType
	| REnvironmentType
	| RLanguageType
	| UnresolvedRTypeUnion
	| UnresolvedRTypeIntersection
	| UnresolvedRTypeVariable
	| RTypeError;