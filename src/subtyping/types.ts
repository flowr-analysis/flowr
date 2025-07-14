import { guard } from '../util/assert';

/**
 * This enum lists a tag for each of the possible R data types inferred by the
 * type inferencer. It is mainly used to identify subtypes of {@link DataType}.
 */
export enum RDataTypeTag {
	/** {@link RAtomicVectorType} */
	AtomicVector = 'RAtomicVectorType',
    /** {@link RLogicalType} */
    Logical = 'RLogicalType',
    /** {@link RIntegerType} */
    Integer = 'RIntegerType',
    /** {@link RDoubleType} */
    Double = 'RDoubleType',
    /** {@link RComplexType} */
	Complex = 'RComplexType',
    /** {@link RStringType} */
    String = 'RStringType',
    /** {@link RRawType} */
    Raw = 'RRawType',
    /** {@link RListType} */
    List = 'RListType',
    /** {@link RNullType} */
	Null = 'RNullType',
    /** {@link RFunctionType} */
    Function = 'RFunctionType',
    /** {@link REnvironmentType} */
    Environment = 'REnvironmentType',
    /** {@link RLanguageType} */
    Language = 'RLanguageType',
	/** {@link UnresolvedRTypeUnion} */
	Union = 'RTypeUnion',
	/** {@link UnresolvedRTypeIntersection} */
	Intersection = 'RTypeIntersection',
	/** {@link UnresolvedRTypeVariable} */
    Variable = 'RTypeVariable',
	/** {@link RErrorType} */
	Error = 'RErrorType',
}

export class UnresolvedRAtomicVectorType {
	readonly tag = RDataTypeTag.AtomicVector;
	readonly elementType = new UnresolvedRTypeVariable();

	constructor(elementType?: UnresolvedRTypeVariable) {
		if(elementType !== undefined) {
			this.elementType = elementType;
		}
	}
}

export class RAtomicVectorType {
	readonly tag = RDataTypeTag.AtomicVector;
	readonly elementType: DataType;

	constructor(elementType: DataType) {
		this.elementType = elementType;
	}
}

export class RLogicalType {
	readonly tag = RDataTypeTag.Logical;
}

export class RIntegerType {
	readonly tag = RDataTypeTag.Integer;
}

export class RDoubleType {
	readonly tag = RDataTypeTag.Double;
}

export class RComplexType {
	readonly tag = RDataTypeTag.Complex;
}

export class RStringType {
	readonly tag = RDataTypeTag.String;
}

export class RRawType {
	readonly tag = RDataTypeTag.Raw;
}

export class UnresolvedRListType {
	readonly tag = RDataTypeTag.List;
	readonly elementType = new UnresolvedRTypeVariable();
	readonly indexedElementTypes = new Map<number | string, UnresolvedRTypeVariable>();

	constructor(elementType?: UnresolvedRTypeVariable) {
		if(elementType !== undefined) {
			this.elementType = elementType;
		}
	}

	getIndexedElementType(indexOrName: number | string): UnresolvedRTypeVariable {
		let elementType = this.indexedElementTypes.get(indexOrName);
		if(elementType === undefined) {
			elementType = new UnresolvedRTypeVariable();
			elementType.constrainWithUpperBound(this.elementType.upperBound);
			this.indexedElementTypes.set(indexOrName, elementType);
			this.elementType.constrainWithLowerBound(elementType);
		}
		return elementType;
	}
}

export class RListType {
	readonly tag = RDataTypeTag.List;
	readonly elementType:         DataType;
	readonly indexedElementTypes: ReadonlyMap<number | string, DataType>;

	constructor(elementType: DataType, indexedElementTypes: Map<number | string, DataType> = new Map()) {
		this.elementType = elementType;
		this.indexedElementTypes = indexedElementTypes;
	}
}

export class RNullType {
	readonly tag = RDataTypeTag.Null;
}

export class UnresolvedRFunctionType {
	readonly tag = RDataTypeTag.Function;
	readonly parameterTypes = new Map<number | string, UnresolvedRTypeVariable>();
	readonly returnType = new UnresolvedRTypeVariable();

	constructor(returnType?: UnresolvedRTypeVariable) {
		if(returnType !== undefined) {
			this.returnType = returnType;
		}
	}

	getParameterType(indexOrName: number | string): UnresolvedRTypeVariable {
		let parameterType = this.parameterTypes.get(indexOrName);
		if(parameterType === undefined) {
			parameterType = new UnresolvedRTypeVariable();
			this.parameterTypes.set(indexOrName, parameterType);
		}
		return parameterType;
	}
}

export class RFunctionType {
	readonly tag = RDataTypeTag.Function;
	readonly parameterTypes: Map<number | string, DataType>;
	readonly returnType:     DataType;

	constructor(parameterTypes: Map<number | string, DataType>, returnType: DataType) {
		this.parameterTypes = parameterTypes;
		this.returnType = returnType;
	}
}

export class REnvironmentType {
	readonly tag = RDataTypeTag.Environment;
}

export class RLanguageType {
	readonly tag = RDataTypeTag.Language;
}

export class UnresolvedRTypeUnion {
	readonly tag = RDataTypeTag.Union;
	readonly types: Set<UnresolvedDataType> = new Set();

	constructor(...types: UnresolvedDataType[]) {
		for(const type of types) {
			guard(type !== this, 'Union cannot contain itself');
			this.types.add(type);
		}
	}
}

export class RTypeUnion {
	readonly tag = RDataTypeTag.Union;
	readonly types: Set<DataType> = new Set();

	constructor(...types: DataType[]) {
		for(const type of types) {
			guard(type !== this, 'Union cannot contain itself');
			this.types.add(type);
		}
	}
}

export class UnresolvedRTypeIntersection {
	readonly tag = RDataTypeTag.Intersection;
	readonly types: Set<UnresolvedDataType> = new Set();

	constructor(...types: UnresolvedDataType[]) {
		for(const type of types) {
			guard(type !== this, 'Intersection cannot contain itself');
			this.types.add(type);
		}
	}
}

export class RTypeIntersection {
	readonly tag = RDataTypeTag.Intersection;
	readonly types: Set<DataType> = new Set();

	constructor(...types: DataType[]) {
		for(const type of types) {
			guard(type !== this, 'Intersection cannot contain itself');
			this.types.add(type);
		}
	}
}

export class UnresolvedRTypeVariable {
	readonly tag = RDataTypeTag.Variable;
	readonly lowerBound = new UnresolvedRTypeUnion();
	readonly upperBound = new UnresolvedRTypeIntersection();

	constrainWithLowerBound(bound: UnresolvedDataType): void {
		guard(bound !== this, 'Lower bound cannot be the type variable itself');
		constrainWithLowerBound(this, bound);
	}

	constrainWithUpperBound(bound: UnresolvedDataType): void {
		guard(bound !== this, 'Upper bound cannot be the type variable itself');
		constrainWithUpperBound(this, bound);
	}

	constrainFromBothSides(other: UnresolvedDataType): void {
		this.constrainWithLowerBound(other);
		this.constrainWithUpperBound(other);
	}
}

export class RTypeVariable {
	readonly tag = RDataTypeTag.Variable;
	readonly lowerBound: DataType;
	readonly upperBound: DataType;
	
	constructor(lowerBound: DataType, upperBound: DataType) {
		guard(lowerBound !== this, 'Lower bound cannot be the type variable itself');
		this.lowerBound = lowerBound;
		guard(upperBound !== this, 'Upper bound cannot be the type variable itself');
		this.upperBound = upperBound;
	}
}

export class RErrorType {
	readonly tag = RDataTypeTag.Error;
	conflictingBounds: [DataType, DataType];

	constructor(...conflictingBounds: [DataType, DataType]) {
		this.conflictingBounds = conflictingBounds;
	}
}


export function constrainWithLowerBound(type: UnresolvedDataType, bound: UnresolvedDataType): void {
	// console.debug('constraining', type, 'with lower bound', bound);

	if(type === bound) {
		return; // No need to constrain if both types are the same
	}

	if(type instanceof UnresolvedRTypeVariable) {
		type.lowerBound.types.add(bound);
		for(const upperBound of type.upperBound.types) {
			constrainWithLowerBound(upperBound, bound);
		}
	} else if(bound instanceof UnresolvedRTypeVariable) {
		// constrainWithUpperBound(bound, type);
		bound.upperBound.types.add(type);
		for(const lowerBound of bound.lowerBound.types) {
			constrainWithLowerBound(type, lowerBound);
		}
	} else if(type instanceof UnresolvedRTypeUnion) {
		for(const subtype of type.types.values()) {
			if(!subsumes(bound, subtype)) {
				// console.debug('Removing subtype', subtype, 'from union', type, 'because it does not subsume the bound', bound);
				type.types.delete(subtype);
			} else {
				constrainWithLowerBound(subtype, bound);
			}
		}
	} else if(bound instanceof UnresolvedRTypeUnion) {
		// constrainWithUpperBound(bound, type);
		for(const subtype of bound.types) {
			constrainWithLowerBound(type, subtype);
		}
	} else if(type instanceof UnresolvedRTypeIntersection) {
		for(const subtype of type.types) {
			constrainWithLowerBound(subtype, bound);
		}
	} else if(bound instanceof UnresolvedRTypeIntersection) {
		// constrainWithUpperBound(bound, type);
		for(const subtype of bound.types.values()) {
			if(!subsumes(subtype, type)) {
				// console.debug('Removing subtype', subtype, 'from intersection', bound, 'because it does not subsume the type', type);
				bound.types.delete(subtype);
			} else {
				constrainWithLowerBound(type, subtype);
			}
		}
	} else if(type instanceof UnresolvedRFunctionType && bound instanceof UnresolvedRFunctionType) {
		for(const [key, paramType] of bound.parameterTypes) {
			constrainWithUpperBound(type.getParameterType(key), paramType);
		}
		constrainWithLowerBound(type.returnType, bound.returnType);
	} else if(type instanceof UnresolvedRAtomicVectorType && bound instanceof UnresolvedRAtomicVectorType) {
		constrainWithLowerBound(type.elementType, bound.elementType);
	} else if(type instanceof UnresolvedRAtomicVectorType && isAtomicVectorElementType(bound)) {
		constrainWithLowerBound(type.elementType, bound);
	} else if(type instanceof UnresolvedRListType && bound instanceof UnresolvedRListType) {
		constrainWithLowerBound(type.elementType, bound.elementType);
	}
}

export function constrainWithUpperBound(type: UnresolvedDataType, bound: UnresolvedDataType): void {
	// console.debug('constraining', type, 'with upper bound', bound);

	if(type === bound) {
		return; // No need to constrain if both types are the same
	}

	if(type instanceof UnresolvedRTypeVariable) {
		type.upperBound.types.add(bound);
		for(const lowerBound of type.lowerBound.types) {
			constrainWithUpperBound(lowerBound, bound);
		}
	} else if(bound instanceof UnresolvedRTypeVariable) {
		// constrainWithLowerBound(bound, type);
		bound.lowerBound.types.add(type);
		for(const upperBound of bound.upperBound.types) {
			constrainWithUpperBound(type, upperBound);
		}
	} else if(type instanceof UnresolvedRTypeUnion) {
		for(const subtype of type.types) {
			constrainWithUpperBound(subtype, bound);
		}
	} else if(bound instanceof UnresolvedRTypeUnion) {
		// constrainWithLowerBound(bound, type);
		for(const subtype of bound.types.values()) {
			if(!subsumes(type, subtype)) {
				// console.debug('Removing subtype', subtype, 'from union', bound, 'because it does not subsume the type', type);
				bound.types.delete(subtype);
			} else {
				constrainWithUpperBound(type, subtype);
			}
		}
	} else if(type instanceof UnresolvedRTypeIntersection) {
		for(const subtype of type.types.values()) {
			if(!subsumes(subtype, bound)) {
				// console.debug('Removing subtype', subtype, 'from intersection', type, 'because it does not subsume the bound', bound);
				type.types.delete(subtype);
			} else {
				constrainWithUpperBound(subtype, bound);
			}
		}
	} else if(bound instanceof UnresolvedRTypeIntersection) {
		// constrainWithLowerBound(bound, type);
		for(const subtype of bound.types) {
			constrainWithUpperBound(type, subtype);
		}
	} else if(type instanceof UnresolvedRFunctionType && bound instanceof UnresolvedRFunctionType) {
		for(const [key, paramType] of bound.parameterTypes) {
			constrainWithLowerBound(type.getParameterType(key), paramType);
		}
		constrainWithUpperBound(type.returnType, bound.returnType);
	} else if(type instanceof UnresolvedRAtomicVectorType && bound instanceof UnresolvedRAtomicVectorType) {
		constrainWithUpperBound(type.elementType, bound.elementType);
	} else if(type instanceof UnresolvedRListType && bound instanceof UnresolvedRListType) {
		constrainWithUpperBound(type.elementType, bound.elementType);
	}
}


export function resolveType(type: UnresolvedDataType): DataType {
	if(type instanceof UnresolvedRTypeVariable) {
		const lowerBound = resolveType(type.lowerBound);
		const upperBound = resolveType(type.upperBound);

		if(!subsumes(lowerBound, upperBound)) {
			return new RErrorType(lowerBound, upperBound);
		}
		
		if(subsumes(lowerBound, upperBound) && subsumes(upperBound, lowerBound)) {
			return lowerBound; // If both bounds are equal, return one of them
		}
		
		return new RTypeVariable(
			lowerBound instanceof RTypeVariable ? lowerBound.lowerBound : lowerBound,
			upperBound instanceof RTypeVariable ? upperBound.upperBound : upperBound
		);
	} else if(type instanceof UnresolvedRTypeUnion) {
		let resolvedType: DataType = new RTypeUnion();
		for(const subtype of type.types) {
			const resolvedSubtype = resolveType(subtype);
			// console.debug('Resolved subtype', subtype, 'to', resolvedSubtype);
			// console.debug('Joining type', resolvedType, 'with subtype', resolvedSubtype);
			resolvedType = join(resolvedType, resolvedSubtype);
			// console.debug('Joined type is now', resolvedType);
		}
		return resolvedType;
	} else if(type instanceof UnresolvedRTypeIntersection) {
		let resolvedType: DataType = new RTypeIntersection();
		for(const subtype of type.types) {
			const resolvedSubtype = resolveType(subtype);
			resolvedType = meet(resolvedType, resolvedSubtype);
		}
		return resolvedType;
	} else if(type instanceof UnresolvedRFunctionType) {
		const resolvedParameterTypes = new Map(type.parameterTypes.entries().toArray().map(([key, type]) => [key, resolveType(type)]));
		const resolvedReturnType = resolveType(type.returnType);
		return new RFunctionType(resolvedParameterTypes, resolvedReturnType);
	} else if(type instanceof UnresolvedRAtomicVectorType) {
		const resolvedElementType = resolveType(type.elementType);
		return new RAtomicVectorType(resolvedElementType);
	} else if(type instanceof UnresolvedRListType) {
		const resolvedElementType = resolveType(type.elementType);
		const resolvedIndexedElementTypes = new Map(type.indexedElementTypes.entries().map(([indexOrName, elementType]) => [indexOrName, resolveType(elementType)]));
		return new RListType(resolvedElementType, resolvedIndexedElementTypes);
	} else {
		return type;
	}
}

function subsumes(subtype: DataType | UnresolvedDataType, supertype: DataType | UnresolvedDataType): boolean {
	// console.debug('Checking if', subtype, 'subsumes', supertype);

	if(subtype === supertype) {
		return true;
	} else if(subtype.tag === RDataTypeTag.Error || supertype.tag === RDataTypeTag.Error) {
		return false; // Error types do not subsume and are not subsumed by any other type
	} else if(subtype.tag === RDataTypeTag.Variable) {
		return subsumes(subtype.lowerBound, supertype) && subsumes(subtype.upperBound, supertype);
	} else if(supertype.tag === RDataTypeTag.Variable) {
		return subsumes(supertype.lowerBound, subtype) && subsumes(subtype, supertype.upperBound);
	} else if(subtype.tag === RDataTypeTag.Union) {
		return subtype.types.values().every(subtype => subsumes(subtype, supertype));
	} else if(supertype.tag === RDataTypeTag.Union) {
		return supertype.types.values().some(supertype => subsumes(subtype, supertype));
	} else if(supertype.tag === RDataTypeTag.Intersection) {
		return supertype.types.values().every(supertype => subsumes(subtype, supertype));
	} else if(subtype.tag === RDataTypeTag.Intersection) {
		return subtype.types.values().some(subtype => subsumes(subtype, supertype));
	} else if(subtype.tag === RDataTypeTag.List && supertype.tag === RDataTypeTag.List) {
		return subsumes(subtype.elementType, supertype.elementType);
	} else if(subtype.tag === RDataTypeTag.AtomicVector && supertype.tag === RDataTypeTag.AtomicVector) {
		return subsumes(subtype.elementType, supertype.elementType);
	} else if(isAtomicVectorElementType(subtype) && supertype.tag === RDataTypeTag.AtomicVector) {
		// A scalar subsumes a vector type if it subsumes the element type of the vector
		return subsumes(subtype, supertype.elementType);
	} else if(subtype.tag === RDataTypeTag.Function && supertype.tag === RDataTypeTag.Function) {
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

function subsumesByTag(subtype: RDataTypeTag, supertype: RDataTypeTag): boolean {
	return subtype === supertype && subtype !== RDataTypeTag.Error
		|| subtype === RDataTypeTag.Logical && supertype === RDataTypeTag.Integer
		|| subtype === RDataTypeTag.Logical && supertype === RDataTypeTag.Double
		|| subtype === RDataTypeTag.Logical && supertype === RDataTypeTag.Complex
		|| subtype === RDataTypeTag.Integer && supertype === RDataTypeTag.Double
		|| subtype === RDataTypeTag.Integer && supertype === RDataTypeTag.Complex
		|| subtype === RDataTypeTag.Double && supertype === RDataTypeTag.Complex
		|| [RDataTypeTag.Logical, RDataTypeTag.Integer, RDataTypeTag.Double, RDataTypeTag.Complex, RDataTypeTag.String, RDataTypeTag.Raw].includes(subtype) && supertype === RDataTypeTag.AtomicVector;
}

function join(type1: DataType, type2: DataType): DataType {
	if(type1 instanceof RErrorType) {
		return type1;
	} else if(type2 instanceof RErrorType) {
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
			if(joinedType instanceof RErrorType) {
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
	} else if(isAtomicVectorElementType(type1) && type2.tag === RDataTypeTag.AtomicVector) {
		return new RAtomicVectorType(join(type1, type2.elementType));
	} else if(isAtomicVectorElementType(type2) && type1.tag === RDataTypeTag.AtomicVector) {
		return new RAtomicVectorType(join(type2, type1.elementType));
	} else if(subsumesByTag(type1.tag, type2.tag)) {
		return type2;
	} else if(subsumesByTag(type2.tag, type1.tag)) {
		return type1;
	}
	return new RTypeUnion(type1, type2);
}

function meet(type1: DataType, type2: DataType): DataType {
	if(type1 instanceof RErrorType) {
		return type1;
	} else if(type2 instanceof RErrorType) {
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
			if(metType instanceof RErrorType) {
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
	} else if(isAtomicVectorElementType(type1) && type2.tag === RDataTypeTag.AtomicVector) {
		return meet(type1, type2.elementType);
	} else if(isAtomicVectorElementType(type2) && type1.tag === RDataTypeTag.AtomicVector) {
		return meet(type2, type1.elementType);
	} else if(subsumesByTag(type1.tag, type2.tag)) {
		return type1;
	} else if(subsumesByTag(type2.tag, type1.tag)) {
		return type2;
	}
	return new RTypeIntersection(type1, type2);
}


export type AtomicVectorElementType
	= RLogicalType
	| RIntegerType
	| RDoubleType
	| RComplexType
	| RStringType
	| RRawType

export function isAtomicVectorElementType(type: DataType | UnresolvedDataType): type is AtomicVectorElementType {
	return type.tag === RDataTypeTag.Logical
		|| type.tag === RDataTypeTag.Integer
		|| type.tag === RDataTypeTag.Double
		|| type.tag === RDataTypeTag.Complex
		|| type.tag === RDataTypeTag.String
		|| type.tag === RDataTypeTag.Raw;
}
	
export type VectorType = RAtomicVectorType | RListType;

export type UnresolvedVectorType = UnresolvedRAtomicVectorType | UnresolvedRListType;

export function isVectorType(type: UnresolvedDataType): type is UnresolvedVectorType
export function isVectorType(type: DataType): type is VectorType
export function isVectorType(type: DataType | UnresolvedDataType): type is VectorType | UnresolvedVectorType {
	return type.tag === RDataTypeTag.AtomicVector || type.tag === RDataTypeTag.List;
}

/**
 * The `RDataType` type is the union of all possible types that can be inferred
 * by the type inferencer for R objects.
 * It should be used whenever you either not care what kind of
 * type you are dealing with or if you want to handle all possible types.
*/
export type DataType
	= AtomicVectorElementType
	| RAtomicVectorType
	| RListType
	| RNullType
	| REnvironmentType
	| RLanguageType
	| RFunctionType
	| RTypeUnion
	| RTypeIntersection
	| RTypeVariable
	| RErrorType;

export type UnresolvedDataType
	= AtomicVectorElementType
	| UnresolvedRAtomicVectorType
	| UnresolvedRListType
	| RNullType
	| REnvironmentType
	| RLanguageType
	| UnresolvedRFunctionType
	| UnresolvedRTypeUnion
	| UnresolvedRTypeIntersection
	| UnresolvedRTypeVariable
	| RErrorType;