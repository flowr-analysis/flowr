/**
 * This enum lists a tag for each of the possible R data types inferred by the
 * type inferencer. It is mainly used to identify subtypes of {@link DataType}.
 */
export enum RDataTypeTag {
	/** {@link RAtomicVectorType} */
	Vector = 'RVectorType',
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
	/** {@link UnresolvedRTypeVariable} */
    Variable = 'RTypeVariable',
	/** {@link RErrorType} */
	Error = 'RErrorType',
	/** {@link RAnyType} */
	Any = 'RAnyType',
	/** {@link RNoneType} */
	None = 'RNoneType',
}

export class UnresolvedRVectorType {
	readonly tag = RDataTypeTag.Vector;
	readonly elementType = new UnresolvedRTypeVariable();

	constructor(elementType?: UnresolvedDataType) {
		if(elementType !== undefined) {
			this.elementType.constrainWithLowerBound(elementType);
		}
	}

	constrainWithLowerBound(bound: UnresolvedRAtomicVectorType): void {
		this.elementType.constrainWithLowerBound(bound.elementType);
	}

	constrainWithUpperBound(bound: UnresolvedRAtomicVectorType): void {
		this.elementType.constrainWithUpperBound(bound.elementType);
	}
}

export class RVectorType {
	readonly tag = RDataTypeTag.Vector;
	readonly elementType: DataType;

	constructor(elementType: DataType) {
		this.elementType = elementType;
	}
}

export class UnresolvedRAtomicVectorType /*extends UnresolvedRVectorType*/ {
	readonly tag = RDataTypeTag.AtomicVector;
	readonly elementType = new UnresolvedRTypeVariable();

	constructor(elementType?: UnresolvedDataType) {
		if(elementType !== undefined) {
			this.elementType.constrainWithLowerBound(elementType);
		}
	}

	constrainWithLowerBound(bound: UnresolvedRAtomicVectorType): void {
		this.elementType.constrainWithLowerBound(bound.elementType);
	}

	constrainWithUpperBound(bound: UnresolvedRAtomicVectorType): void {
		this.elementType.constrainWithUpperBound(bound.elementType);
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

	constructor(elementType?: UnresolvedDataType) {
		if(elementType !== undefined) {
			this.elementType.constrainWithLowerBound(elementType);
		}
	}
	
	constrainWithLowerBound(bound: UnresolvedRListType): void {
		this.elementType.constrainWithLowerBound(bound.elementType);
	}

	constrainWithUpperBound(bound: UnresolvedRListType): void {
		this.elementType.constrainWithUpperBound(bound.elementType);
	}
}

export class RListType {
	readonly tag = RDataTypeTag.List;
	readonly elementType: DataType;

	constructor(elementType: DataType) {
		this.elementType = elementType;
	}
}

export class RNullType {
	readonly tag = RDataTypeTag.Null;
}

export class UnresolvedRFunctionType {
	readonly tag = RDataTypeTag.Function;
	readonly parameterTypes = new Map<number | string, UnresolvedRTypeVariable>();
	readonly returnType = new UnresolvedRTypeVariable();

	getParameterType(indexOrName: number | string): UnresolvedRTypeVariable {
		if(!this.parameterTypes.has(indexOrName)) {
			this.parameterTypes.set(indexOrName, new UnresolvedRTypeVariable());
		}
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		return this.parameterTypes.get(indexOrName)!;
	}

	constrainWithLowerBound(bound: UnresolvedRFunctionType): void {
		for(const [key, type] of bound.parameterTypes) {
			this.getParameterType(key).constrainWithUpperBound(type);
		}
		this.returnType.constrainWithLowerBound(bound.returnType);
	}

	constrainWithUpperBound(bound: UnresolvedRFunctionType): void {
		for(const [key, type] of bound.parameterTypes) {
			this.getParameterType(key).constrainWithLowerBound(type);
		}
		this.returnType.constrainWithUpperBound(bound.returnType);
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

export class UnresolvedRTypeVariable {
	readonly tag = RDataTypeTag.Variable;
	readonly lowerBounds: Set<UnresolvedDataType> = new Set();
	readonly upperBounds: Set<UnresolvedDataType> = new Set();

	constrainWithLowerBound(bound: UnresolvedDataType): void {
		this.lowerBounds.add(bound);
		
		for(const upperBound of this.upperBounds) {
			if(upperBound instanceof UnresolvedRTypeVariable && upperBound !== bound) {
				upperBound.constrainWithLowerBound(bound);
			} else if(bound instanceof UnresolvedRTypeVariable && bound !== upperBound) {
				bound.constrainWithUpperBound(upperBound);
			} else if(upperBound instanceof UnresolvedRFunctionType && bound instanceof UnresolvedRFunctionType && upperBound !== bound) {
				upperBound.constrainWithLowerBound(bound);
			} else if(upperBound instanceof UnresolvedRListType && bound instanceof UnresolvedRListType && upperBound !== bound) {
				upperBound.constrainWithLowerBound(bound);
			} else if(upperBound instanceof UnresolvedRAtomicVectorType && bound instanceof UnresolvedRAtomicVectorType && upperBound !== bound) {
				upperBound.constrainWithLowerBound(bound);
			}
		}
	}

	constrainWithUpperBound(bound: UnresolvedDataType): void {
		this.upperBounds.add(bound);

		for(const lowerBound of this.lowerBounds) {
			if(lowerBound instanceof UnresolvedRTypeVariable && lowerBound !== bound) {
				lowerBound.constrainWithUpperBound(bound);
			} else if(bound instanceof UnresolvedRTypeVariable && bound !== lowerBound) {
				bound.constrainWithLowerBound(lowerBound);
			} else if(lowerBound instanceof UnresolvedRFunctionType && bound instanceof UnresolvedRFunctionType && lowerBound !== bound) {
				lowerBound.constrainWithUpperBound(bound);
			} else if(lowerBound instanceof UnresolvedRListType && bound instanceof UnresolvedRListType && lowerBound !== bound) {
				lowerBound.constrainWithUpperBound(bound);
			} else if(lowerBound instanceof UnresolvedRAtomicVectorType && bound instanceof UnresolvedRAtomicVectorType && lowerBound !== bound) {
				lowerBound.constrainWithUpperBound(bound);
			}
		}
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
		this.lowerBound = lowerBound;
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

export class RAnyType {
	readonly tag = RDataTypeTag.Any;
}

export class RNoneType {
	readonly tag = RDataTypeTag.None;
}


export function resolveType(type: UnresolvedDataType): DataType {
	if(type instanceof UnresolvedRTypeVariable) {
		let lowerBound: DataType = new RNoneType();
		for(const bound of type.lowerBounds) {
			const resolvedBound = resolveType(bound);
			lowerBound = union(lowerBound, resolvedBound);
		}
		let upperBound: DataType = new RAnyType();
		for(const bound of type.upperBounds) {
			const resolvedBound = resolveType(bound);
			upperBound = intersection(upperBound, resolvedBound);
		}

		if(!subsumes(lowerBound, upperBound)) {
			return new RErrorType(lowerBound, upperBound);
		} else if(subsumes(lowerBound, upperBound) && subsumes(upperBound, lowerBound)) {
			return lowerBound; // If both bounds are equal, return one of them
		} else {
			return new RTypeVariable(
				lowerBound instanceof RTypeVariable ? lowerBound.lowerBound : lowerBound,
				upperBound instanceof RTypeVariable ? upperBound.upperBound : upperBound
			);
		}
	} else if(type instanceof UnresolvedRFunctionType) {
		const resolvedParameterTypes = new Map(type.parameterTypes.entries().toArray().map(([key, type]) => [key, resolveType(type)]));
		const resolvedReturnType = resolveType(type.returnType);
		return new RFunctionType(resolvedParameterTypes, resolvedReturnType);
	} else if(type instanceof UnresolvedRVectorType) {
		const resolvedElementType = resolveType(type.elementType);
		return new RVectorType(resolvedElementType);
	} else if(type instanceof UnresolvedRAtomicVectorType) {
		const resolvedElementType = resolveType(type.elementType);
		return new RAtomicVectorType(resolvedElementType);
	} else if(type instanceof UnresolvedRListType) {
		const resolvedElementType = resolveType(type.elementType);
		return new RListType(resolvedElementType);
	} else {
		return type;
	}
}

function subsumes(subtype: DataType, supertype: DataType): boolean {
	if(subtype === supertype) {
		return true;
	} else if(subtype instanceof RErrorType || supertype instanceof RErrorType) {
		return false; // Error types do not subsume and are not subsumed by any other type
	} else if(subtype instanceof RNoneType || supertype instanceof RAnyType) {
		return true; // None subsumes any type, Any is subsumed by any type
	} else if(subtype instanceof RTypeVariable) {
		return subsumes(subtype.lowerBound, supertype) && subsumes(subtype.upperBound, supertype);
	} else if(supertype instanceof RTypeVariable) {
		return subsumes(supertype.lowerBound, subtype) && subsumes(subtype, supertype.upperBound);
	} else if(subtype instanceof RListType && (supertype instanceof RListType || supertype instanceof RVectorType)) {
		return subsumes(subtype.elementType, supertype.elementType);
	} else if(subtype instanceof RAtomicVectorType && (supertype instanceof RAtomicVectorType || supertype instanceof RVectorType)) {
		return subsumes(subtype.elementType, supertype.elementType);
	} else if(isAtomicVectorElementType(subtype) && (supertype instanceof RAtomicVectorType || supertype instanceof RVectorType)) {
		// A scalar subsumes a vector type if it subsumes the element type of the vector
		return subsumes(subtype, supertype.elementType);
	} else if(subtype instanceof RFunctionType && supertype instanceof RFunctionType) {
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
		|| subtype === RDataTypeTag.None || supertype === RDataTypeTag.Any
		|| subtype === RDataTypeTag.Variable || supertype === RDataTypeTag.Variable
		|| [RDataTypeTag.Logical, RDataTypeTag.Integer, RDataTypeTag.Double, RDataTypeTag.Complex, RDataTypeTag.String, RDataTypeTag.Raw].includes(subtype) && (supertype === RDataTypeTag.AtomicVector || supertype === RDataTypeTag.Vector)
		|| subtype === RDataTypeTag.AtomicVector && supertype === RDataTypeTag.Vector
		|| subtype === RDataTypeTag.List && supertype === RDataTypeTag.Vector;
}

function union(type1: DataType, type2: DataType): DataType {
	if(type1 instanceof RErrorType) {
		return type1;
	} else if(type2 instanceof RErrorType) {
		return type2;
	} else if(type1 instanceof RFunctionType && type2 instanceof RFunctionType) {
		const parameterTypes = new Map<number | string, DataType>();
		const keys1 = new Set(type1.parameterTypes.keys());
		const keys2 = new Set(type2.parameterTypes.keys());
		for(const key of keys1.union(keys2)) {
			const parameterType1 = type1.parameterTypes.get(key) ?? new RNoneType();
			const parameterType2 = type2.parameterTypes.get(key) ?? new RNoneType();
			parameterTypes.set(key, intersection(parameterType1, parameterType2));
		}
		const returnType = union(type1.returnType, type2.returnType);
		return new RFunctionType(parameterTypes, returnType);
	} else if(type1 instanceof RListType && type2 instanceof RListType) {
		return new RListType(union(type1.elementType, type2.elementType));
	} else if(type1 instanceof RAtomicVectorType && type2 instanceof RAtomicVectorType) {
		return new RAtomicVectorType(union(type1.elementType, type2.elementType));
	} else if(isVectorType(type1) && isVectorType(type2)) {
		return new RVectorType(union(type1.elementType, type2.elementType));
	} else if(isAtomicVectorElementType(type1) && (type2.tag === RDataTypeTag.AtomicVector || type2.tag === RDataTypeTag.Vector)) {
		if(type2 instanceof RAtomicVectorType) {
			return new RAtomicVectorType(union(type1, type2.elementType));
		} else {
			return new RVectorType(union(type1, type2.elementType));
		}
	} else if(isAtomicVectorElementType(type2) && (type1.tag === RDataTypeTag.AtomicVector || type1.tag === RDataTypeTag.Vector)) {
		if(type1 instanceof RAtomicVectorType) {
			return new RAtomicVectorType(union(type2, type1.elementType));
		} else {
			return new RVectorType(union(type2, type1.elementType));
		}
	} else if(subsumesByTag(type1.tag, type2.tag)) {
		return type2;
	} else if(subsumesByTag(type2.tag, type1.tag)) {
		return type1;
	}
	return new RAnyType();
}

function intersection(type1: DataType, type2: DataType): DataType {
	if(type1 instanceof RErrorType) {
		return type1;
	} else if(type2 instanceof RErrorType) {
		return type2;
	} else if(type1 instanceof RFunctionType && type2 instanceof RFunctionType) {
		const parameterTypes = new Map<number | string, DataType>();
		const keys1 = new Set(type1.parameterTypes.keys());
		const keys2 = new Set(type2.parameterTypes.keys());
		for(const key of keys1.intersection(keys2)) {
			const parameterType1 = type1.parameterTypes.get(key) ?? new RAnyType();
			const parameterType2 = type2.parameterTypes.get(key) ?? new RAnyType();
			parameterTypes.set(key, union(parameterType1, parameterType2));
		}
		const returnType = intersection(type1.returnType, type2.returnType);
		return new RFunctionType(parameterTypes, returnType);
	} else if(isVectorType(type1) && isVectorType(type2) && (type1 instanceof RListType || type2 instanceof RListType)) {
		return new RListType(intersection(type1.elementType, type2.elementType));
	} else if(isVectorType(type1) && isVectorType(type2) && (type1 instanceof RAtomicVectorType || type2 instanceof RAtomicVectorType)) {
		return new RAtomicVectorType(intersection(type1.elementType, type2.elementType));
	} else if(type1 instanceof RVectorType && type2 instanceof RVectorType) {
		return new RVectorType(intersection(type1.elementType, type2.elementType));
	} else if(isAtomicVectorElementType(type1) && (type2.tag === RDataTypeTag.AtomicVector || type2.tag === RDataTypeTag.Vector)) {
		return intersection(type1, type2.elementType);
	} else if(isAtomicVectorElementType(type2) && (type1.tag === RDataTypeTag.AtomicVector || type1.tag === RDataTypeTag.Vector)) {
		return intersection(type2, type1.elementType);
	} else if(subsumesByTag(type1.tag, type2.tag)) {
		return type1;
	} else if(subsumesByTag(type2.tag, type1.tag)) {
		return type2;
	}
	return new RNoneType();
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
	
export type VectorType = RVectorType | RAtomicVectorType | RListType;

export type UnresolvedVectorType = UnresolvedRVectorType | UnresolvedRAtomicVectorType | UnresolvedRListType;

export function isVectorType(type: UnresolvedDataType): type is UnresolvedVectorType
export function isVectorType(type: DataType): type is VectorType
export function isVectorType(type: DataType | UnresolvedDataType): type is VectorType | UnresolvedVectorType {
	return type.tag === RDataTypeTag.Vector || type.tag === RDataTypeTag.AtomicVector || type.tag === RDataTypeTag.List;
}

/**
 * The `RDataType` type is the union of all possible types that can be inferred
 * by the type inferencer for R objects.
 * It should be used whenever you either not care what kind of
 * type you are dealing with or if you want to handle all possible types.
*/
export type DataType
	= AtomicVectorElementType
	| VectorType
	| RNullType
	| REnvironmentType
	| RLanguageType
	| RFunctionType
	| RTypeVariable
	| RErrorType
	| RAnyType
	| RNoneType;

export type UnresolvedDataType
	= AtomicVectorElementType
	| UnresolvedVectorType
	| RNullType
	| REnvironmentType
	| RLanguageType
	| UnresolvedRFunctionType
	| UnresolvedRTypeVariable
	// | RErrorType
	| RAnyType
	| RNoneType;