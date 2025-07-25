import { guard } from '../../util/assert';
import type { DataType , AtomicVectorBaseType, REnvironmentType, RLanguageType, RNullType } from '../types';
import { DataTypeTag, isAtomicVectorBaseType, RAtomicVectorType, RFunctionType, RListType, RTypeError, RTypeIntersection, RTypeUnion, RTypeVariable } from '../types';

export class UnresolvedRAtomicVectorType {
	readonly tag = DataTypeTag.AtomicVector;
	readonly elementType = new UnresolvedRTypeVariable();

	constructor(elementType?: UnresolvedRTypeVariable) {
		if(elementType !== undefined) {
			this.elementType = elementType;
		}
	}
}

export class UnresolvedRListType {
	readonly tag = DataTypeTag.List;
	readonly elementType = new UnresolvedRTypeVariable();
	readonly indexedElementTypes = new Map<number | string, UnresolvedRTypeVariable>();

	constructor(elementType?: UnresolvedRTypeVariable) {
		if(elementType !== undefined) {
			this.elementType = elementType;
		}
	}
}

export function getIndexedElementTypeFromList(list: UnresolvedRListType, indexOrName: number | string, constraintCache: Map<UnresolvedDataType, { lowerBounds: Set<UnresolvedDataType>, upperBounds: Set<UnresolvedDataType> }>): UnresolvedRTypeVariable {
	let elementType = list.indexedElementTypes.get(indexOrName);
	if(elementType === undefined) {
		elementType = new UnresolvedRTypeVariable();
		constrainWithUpperBound(elementType, list.elementType.upperBound, constraintCache);
		list.indexedElementTypes.set(indexOrName, elementType);
		constrainWithLowerBound(list.elementType, elementType, constraintCache);
	}
	return elementType;
}

export class UnresolvedRFunctionType {
	readonly tag = DataTypeTag.Function;
	readonly parameterTypes = new Map<number | string, UnresolvedRTypeVariable>();
	readonly returnType = new UnresolvedRTypeVariable();

	constructor(returnType?: UnresolvedRTypeVariable) {
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
	readonly types: Set<UnresolvedDataType> = new Set();

	constructor(...types: UnresolvedDataType[]) {
		for(const type of types) {
			guard(type !== this, 'Union cannot contain itself');
			this.types.add(type);
		}
	}
}

export class UnresolvedRTypeIntersection {
	readonly tag = DataTypeTag.Intersection;
	readonly types: Set<UnresolvedDataType> = new Set();

	constructor(...types: UnresolvedDataType[]) {
		for(const type of types) {
			guard(type !== this, 'Intersection cannot contain itself');
			this.types.add(type);
		}
	}
}

export class UnresolvedRTypeVariable {
	readonly tag = DataTypeTag.Variable;
	readonly lowerBound = new UnresolvedRTypeUnion();
	readonly upperBound = new UnresolvedRTypeIntersection();
}


export function constrainWithLowerBound(type: UnresolvedDataType, bound: UnresolvedDataType, cache: Map<UnresolvedDataType, { lowerBounds: Set<UnresolvedDataType>, upperBounds: Set<UnresolvedDataType> }>): void {
	// console.debug('constraining', type, 'with lower bound', bound);

	if(type === bound) {
		return; // No need to constrain if both types are the same
	}

	const cachedConstraints = cache.get(type);
	if(cachedConstraints?.lowerBounds.has(bound)) {
		return; // Avoid infinite recursion
	}
	if(cachedConstraints !== undefined) {
		cachedConstraints.lowerBounds.add(bound);
	} else {
		cache.set(type, { lowerBounds: new Set([bound]), upperBounds: new Set() });
	}

	if(type instanceof UnresolvedRTypeVariable) {
		type.lowerBound.types.add(bound);
		for(const upperBound of type.upperBound.types) {
			constrainWithLowerBound(upperBound, bound, cache);
		}
	} else if(bound instanceof UnresolvedRTypeVariable) {
		// constrainWithUpperBound(bound, type);
		bound.upperBound.types.add(type);
		for(const lowerBound of bound.lowerBound.types) {
			constrainWithLowerBound(type, lowerBound, cache);
		}
	} else if(type instanceof UnresolvedRTypeUnion) {
		for(const subtype of type.types.values()) {
			if(!subsumes(bound, subtype)) {
				// console.debug('Removing subtype', subtype, 'from union', type, 'because it does not subsume the bound', bound);
				type.types.delete(subtype);
			} else {
				constrainWithLowerBound(subtype, bound, cache);
			}
		}
	} else if(bound instanceof UnresolvedRTypeUnion) {
		// constrainWithUpperBound(bound, type);
		for(const subtype of bound.types) {
			constrainWithLowerBound(type, subtype, cache);
		}
	} else if(type instanceof UnresolvedRTypeIntersection) {
		for(const subtype of type.types) {
			constrainWithLowerBound(subtype, bound, cache);
		}
	} else if(bound instanceof UnresolvedRTypeIntersection) {
		// constrainWithUpperBound(bound, type);
		for(const subtype of bound.types.values()) {
			if(!subsumes(subtype, type)) {
				// console.debug('Removing subtype', subtype, 'from intersection', bound, 'because it does not subsume the type', type);
				bound.types.delete(subtype);
			} else {
				constrainWithLowerBound(type, subtype, cache);
			}
		}
	} else if(type instanceof UnresolvedRFunctionType && bound instanceof UnresolvedRFunctionType) {
		for(const [key, paramType] of bound.parameterTypes) {
			constrainWithUpperBound(getParameterTypeFromFunction(type, key), paramType, cache);
		}
		constrainWithLowerBound(type.returnType, bound.returnType, cache);
	} else if(type instanceof UnresolvedRAtomicVectorType && bound instanceof UnresolvedRAtomicVectorType) {
		constrainWithLowerBound(type.elementType, bound.elementType, cache);
	} else if(type instanceof UnresolvedRAtomicVectorType && isAtomicVectorBaseType(bound)) {
		constrainWithLowerBound(type.elementType, bound, cache);
	} else if(type instanceof UnresolvedRListType && bound instanceof UnresolvedRListType) {
		constrainWithLowerBound(type.elementType, bound.elementType, cache);
	}
}

export function constrainWithUpperBound(type: UnresolvedDataType, bound: UnresolvedDataType, cache: Map<UnresolvedDataType, { lowerBounds: Set<UnresolvedDataType>, upperBounds: Set<UnresolvedDataType> }>): void {
	// console.debug('constraining', type, 'with upper bound', bound);

	if(type === bound) {
		return; // No need to constrain if both types are the same
	}

	const cachedConstraints = cache.get(type);
	if(cachedConstraints?.upperBounds.has(bound)) {
		return; // Avoid infinite recursion
	}
	if(cachedConstraints !== undefined) {
		cachedConstraints.upperBounds.add(bound);
	} else {
		cache.set(type, { lowerBounds: new Set(), upperBounds: new Set([bound]) });
	}

	if(type instanceof UnresolvedRTypeVariable) {
		type.upperBound.types.add(bound);
		for(const lowerBound of type.lowerBound.types) {
			constrainWithUpperBound(lowerBound, bound, cache);
		}
	} else if(bound instanceof UnresolvedRTypeVariable) {
		// constrainWithLowerBound(bound, type);
		bound.lowerBound.types.add(type);
		for(const upperBound of bound.upperBound.types) {
			constrainWithUpperBound(type, upperBound, cache);
		}
	} else if(type instanceof UnresolvedRTypeUnion) {
		for(const subtype of type.types) {
			constrainWithUpperBound(subtype, bound, cache);
		}
	} else if(bound instanceof UnresolvedRTypeUnion) {
		// constrainWithLowerBound(bound, type);
		for(const subtype of bound.types.values()) {
			if(!subsumes(type, subtype)) {
				// console.debug('Removing subtype', subtype, 'from union', bound, 'because it does not subsume the type', type);
				bound.types.delete(subtype);
			} else {
				constrainWithUpperBound(type, subtype, cache);
			}
		}
	} else if(type instanceof UnresolvedRTypeIntersection) {
		for(const subtype of type.types.values()) {
			if(!subsumes(subtype, bound)) {
				// console.debug('Removing subtype', subtype, 'from intersection', type, 'because it does not subsume the bound', bound);
				type.types.delete(subtype);
			} else {
				constrainWithUpperBound(subtype, bound, cache);
			}
		}
	} else if(bound instanceof UnresolvedRTypeIntersection) {
		// constrainWithLowerBound(bound, type);
		for(const subtype of bound.types) {
			constrainWithUpperBound(type, subtype, cache);
		}
	} else if(type instanceof UnresolvedRFunctionType && bound instanceof UnresolvedRFunctionType) {
		for(const [key, paramType] of bound.parameterTypes) {
			constrainWithLowerBound(getParameterTypeFromFunction(type, key), paramType, cache);
		}
		constrainWithUpperBound(type.returnType, bound.returnType, cache);
	} else if(type instanceof UnresolvedRAtomicVectorType && bound instanceof UnresolvedRAtomicVectorType) {
		constrainWithUpperBound(type.elementType, bound.elementType, cache);
	} else if(type instanceof UnresolvedRListType && bound instanceof UnresolvedRListType) {
		constrainWithUpperBound(type.elementType, bound.elementType, cache);
	}
}


export function resolveType(type: UnresolvedDataType, cache: Map<UnresolvedDataType, DataType> = new Map()): DataType {
	const cachedType = cache.get(type);
	if(cachedType !== undefined) {
		return cachedType;
	}

	if(type instanceof UnresolvedRTypeVariable) {
		cache.set(type, new RTypeVariable()); // Prevent infinite recursion

		const lowerBound = resolveType(type.lowerBound, cache);
		const upperBound = resolveType(type.upperBound, cache);

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
			const resolvedSubtype = resolveType(subtype, cache);
			resolvedType = join(resolvedType, resolvedSubtype);
		}
		cache.set(type, resolvedType);
		return resolvedType;
	} else if(type instanceof UnresolvedRTypeIntersection) {
		cache.set(type, new RTypeIntersection()); // Prevent infinite recursion

		let resolvedType: DataType = new RTypeIntersection();
		for(const subtype of type.types) {
			const resolvedSubtype = resolveType(subtype, cache);
			resolvedType = meet(resolvedType, resolvedSubtype);
		}
		cache.set(type, resolvedType);
		return resolvedType;
	} else if(type instanceof UnresolvedRFunctionType) {
		const resolvedParameterTypes = new Map(type.parameterTypes.entries().toArray().map(([key, type]) => [key, resolveType(type, cache)]));
		const resolvedReturnType = resolveType(type.returnType, cache);
		const resolvedType = new RFunctionType(resolvedParameterTypes, resolvedReturnType);
		cache.set(type, resolvedType);
		return resolvedType;
	} else if(type instanceof UnresolvedRAtomicVectorType) {
		const resolvedElementType = resolveType(type.elementType, cache);
		const resolvedType = new RAtomicVectorType(resolvedElementType);
		cache.set(type, resolvedType);
		return resolvedType;
	} else if(type instanceof UnresolvedRListType) {
		const resolvedElementType = resolveType(type.elementType, cache);
		const resolvedIndexedElementTypes = new Map(type.indexedElementTypes.entries().map(([indexOrName, elementType]) => [indexOrName, resolveType(elementType, cache)]));
		const resolvedType = new RListType(resolvedElementType, resolvedIndexedElementTypes);
		cache.set(type, resolvedType);
		return resolvedType;
	} else {
		cache.set(type, type);
		return type;
	}
}

export function subsumes(subtype: DataType | UnresolvedDataType, supertype: DataType | UnresolvedDataType): boolean {
	// console.debug('Checking if', subtype, 'subsumes', supertype);

	if(subtype === supertype) {
		return true;
	} else if(subtype.tag === DataTypeTag.Error || supertype.tag === DataTypeTag.Error) {
		return false; // Error types do not subsume and are not subsumed by any other type
	} else if(subtype.tag === DataTypeTag.Variable) {
		return subsumes(subtype.lowerBound, supertype) && subsumes(subtype.upperBound, supertype);
	} else if(supertype.tag === DataTypeTag.Variable) {
		return subsumes(supertype.lowerBound, subtype) && subsumes(subtype, supertype.upperBound);
	} else if(subtype.tag === DataTypeTag.Union) {
		return subtype.types.values().every(subtype => subsumes(subtype, supertype));
	} else if(supertype.tag === DataTypeTag.Union) {
		return supertype.types.values().some(supertype => subsumes(subtype, supertype));
	} else if(supertype.tag === DataTypeTag.Intersection) {
		return supertype.types.values().every(supertype => subsumes(subtype, supertype));
	} else if(subtype.tag === DataTypeTag.Intersection) {
		return subtype.types.values().some(subtype => subsumes(subtype, supertype));
	} else if(subtype.tag === DataTypeTag.List && supertype.tag === DataTypeTag.List) {
		return subsumes(subtype.elementType, supertype.elementType);
	} else if(subtype.tag === DataTypeTag.AtomicVector && supertype.tag === DataTypeTag.AtomicVector) {
		return subsumes(subtype.elementType, supertype.elementType);
	} else if(isAtomicVectorBaseType(subtype) && supertype.tag === DataTypeTag.AtomicVector) {
		// A scalar subsumes a vector type if it subsumes the element type of the vector
		return subsumes(subtype, supertype.elementType);
	} else if(subtype.tag === DataTypeTag.Function && supertype.tag === DataTypeTag.Function) {
		return subsumes(subtype.returnType, supertype.returnType) && subtype.parameterTypes.entries().every(([key, type]) => {
			const supertypeParameter = supertype.parameterTypes.get(key);
			if(supertypeParameter === undefined) {
				return false; // supertype does not have a parameter with this key
			}
			return subsumes(supertypeParameter, type);
		});
	} else {
		return subsumesByTag(subtype.tag, supertype.tag);
	}
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

function join(type1: DataType, type2: DataType): DataType {
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

		// ? Use type1.types.values().flatMap(...); instead?
		const types = new Set<DataType>();
		for(const subtype of type1.types) {
			const joinedType = join(subtype, type2);
			if(joinedType instanceof RTypeError) {
				return joinedType; // If any subtype resolves to an error, return the error
			} else if(joinedType instanceof RTypeUnion) {
				joinedType.types.forEach(type => types.add(type));
			} else {
				types.add(joinedType);
			}
		}
		return types.size === 1 ? [...types][0] : new RTypeUnion(...types);
	} else if(type2 instanceof RTypeUnion) {
		return join(type2, type1);
	// } else if(type1 instanceof RTypeIntersection) {
	// 	// ? Use type1.types.values().flatMap(...); instead?
	// 	const types = new Set<DataType>();
	// 	for(const subtype of type1.types) {
	// 		const joinedType = join(subtype, type2);
	// 		if(joinedType instanceof RErrorType) {
	// 			return joinedType; // If any subtype resolves to an error, return the error
	// 		} else if(joinedType instanceof RTypeIntersection) {
	// 			joinedType.types.forEach(type => types.add(type));
	// 		} else {
	// 			types.add(joinedType);
	// 		}
	// 	}
	// 	return types.size === 1 ? [...types][0] : new RTypeIntersection(...types);
	// } else if(type2 instanceof RTypeIntersection) {
	// 	return join(type2, type1);
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

function meet(type1: DataType, type2: DataType): DataType {
	if(type1 instanceof RTypeError) {
		return type1;
	} else if(type2 instanceof RTypeError) {
		return type2;
	} else if(type1 instanceof RTypeVariable) {
		return meet(type1.upperBound, type2);
	} else if(type2 instanceof RTypeVariable) {
		return meet(type1, type2.upperBound);
	// } else if(type1 instanceof RTypeUnion) {
	// 	// ? Use type1.types.values().flatMap(...); instead?
	// 	const types = new Set<DataType>();
	// 	for(const subtype of type1.types) {
	// 		const metType = meet(subtype, type2);
	// 		if(metType instanceof RErrorType) {
	// 			return metType; // If any subtype resolves to an error, return the error
	// 		} else if(metType instanceof RTypeUnion) {
	// 			metType.types.forEach(type => types.add(type));
	// 		} else {
	// 			types.add(metType);
	// 		}
	// 	}
	// 	return types.size === 1 ? [...types][0] : new RTypeUnion(...types);
	// } else if(type2 instanceof RTypeUnion) {
	// 	return meet(type2, type1);
	} else if(type1 instanceof RTypeIntersection) {
		if(type1.types.size === 0) {
			return type2; // If type1 is an empty intersection, return type2
		}

		// ? Use type1.types.values().flatMap(...); instead?
		const types = new Set<DataType>();
		for(const subtype of type1.types) {
			const metType = meet(subtype, type2);
			if(metType instanceof RTypeError) {
				return metType; // If any subtype resolves to an error, return the error
			} else if(metType instanceof RTypeIntersection) {
				metType.types.forEach(type => types.add(type));
			} else {
				types.add(metType);
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