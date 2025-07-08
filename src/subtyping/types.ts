/**
 * This enum lists a tag for each of the possible R data types inferred by the
 * type inferencer. It is mainly used to identify subtypes of {@link RDataType}.
 */
export enum RDataTypeTag {
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
	/** {@link RVectorType} */
	Vector = 'RVectorType',
    /** {@link RNullType} */
	Null = 'RNullType',
    /** {@link RFunctionType} */
    Function = 'RFunctionType',
    /** {@link RListType} */
    List = 'RListType',
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

export class UnresolvedRVectorType {
	readonly tag = RDataTypeTag.Vector;
	readonly elementType = new UnresolvedRTypeVariable();

	constructor(elementType?: UnresolvedRDataType) {
		if(elementType !== undefined) {
			this.elementType.constrainWithLowerBound(elementType);
		}
	}

	constrainWithLowerBound(bound: UnresolvedRVectorType): void {
		this.elementType.constrainWithLowerBound(bound.elementType);
	}

	constrainWithUpperBound(bound: UnresolvedRVectorType): void {
		this.elementType.constrainWithUpperBound(bound.elementType);
	}
}

export class RVectorType {
	readonly tag = RDataTypeTag.Vector;
	readonly elementType: RDataType;

	constructor(elementType: RDataType) {
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
	readonly parameterTypes: Map<number | string, RDataType>;
	readonly returnType:     RDataType;

	constructor(parameterTypes: Map<number | string, RDataType>, returnType: RDataType) {
		this.parameterTypes = parameterTypes;
		this.returnType = returnType;
	}
}

export class UnresolvedRListType {
	readonly tag = RDataTypeTag.List;
	readonly elementType = new UnresolvedRTypeVariable();

	constructor(elementType?: UnresolvedRDataType) {
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
	readonly elementType: RDataType;

	constructor(elementType: RDataType) {
		this.elementType = elementType;
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
	readonly lowerBounds: Set<UnresolvedRDataType> = new Set();
	readonly upperBounds: Set<UnresolvedRDataType> = new Set();

	constrainWithLowerBound(bound: UnresolvedRDataType): void {
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
			} else if(upperBound instanceof UnresolvedRVectorType && bound instanceof UnresolvedRVectorType && upperBound !== bound) {
				upperBound.constrainWithLowerBound(bound);
			}
		}
	}

	constrainWithUpperBound(bound: UnresolvedRDataType): void {
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
			} else if(lowerBound instanceof UnresolvedRVectorType && bound instanceof UnresolvedRVectorType && lowerBound !== bound) {
				lowerBound.constrainWithUpperBound(bound);
			}
		}
	}

	constrainFromBothSides(other: UnresolvedRDataType): void {
		this.constrainWithLowerBound(other);
		this.constrainWithUpperBound(other);
	}
}

export class RTypeVariable {
	readonly tag = RDataTypeTag.Variable;
	readonly lowerBound: RDataType;
	readonly upperBound: RDataType;
	
	constructor(lowerBound: RDataType, upperBound: RDataType) {
		this.lowerBound = lowerBound;
		this.upperBound = upperBound;
	}
}

export class RErrorType {
	readonly tag = RDataTypeTag.Error;
	conflictingBounds: [RDataType, RDataType];

	constructor(...conflictingBounds: [RDataType, RDataType]) {
		this.conflictingBounds = conflictingBounds;
	}
}

export class RAnyType {
	readonly tag = RDataTypeTag.Any;
}

export class RNoneType {
	readonly tag = RDataTypeTag.None;
}


export function resolveType(type: UnresolvedRDataType): RDataType {
	if(type instanceof UnresolvedRTypeVariable) {
		let lowerBound: RDataType = new RNoneType();
		for(const bound of type.lowerBounds) {
			const resolvedBound = resolveType(bound);
			lowerBound = union(lowerBound, resolvedBound);
		}
		let upperBound: RDataType = new RAnyType();
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
	} else if(type instanceof UnresolvedRListType) {
		const resolvedElementType = resolveType(type.elementType);
		return new RListType(resolvedElementType);
	} else if(type instanceof UnresolvedRVectorType) {
		const resolvedElementType = resolveType(type.elementType);
		return new RVectorType(resolvedElementType);
	} else {
		return type;
	}
}

function subsumes(subtype: RDataType, supertype: RDataType): boolean {
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
	} else if(subtype instanceof RListType && supertype instanceof RListType) {
		return subsumes(subtype.elementType, supertype.elementType);
	} else if(supertype instanceof RVectorType) {
		if(subtype instanceof RVectorType) {
			return subsumes(subtype.elementType, supertype.elementType);
		} else if(subtype instanceof RLogicalType || subtype instanceof RIntegerType || subtype instanceof RDoubleType || subtype instanceof RComplexType || subtype instanceof RStringType || subtype instanceof RRawType) {
			// A scalar subsumes a vector type if it subsumes the element type of the vector
			return subsumes(subtype, supertype.elementType);
		} else {
			return false; // A non-vector type cannot subsume a vector type
		}
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
		|| subtype === RDataTypeTag.Variable || supertype === RDataTypeTag.Variable;
}

function union(type1: RDataType, type2: RDataType): RDataType {
	if(type1 instanceof RErrorType) {
		return type1;
	} else if(type2 instanceof RErrorType) {
		return type2;
	} else if(type1 instanceof RFunctionType && type2 instanceof RFunctionType) {
		const parameterTypes = new Map<number | string, RDataType>();
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
	} else if(subsumesByTag(type1.tag, type2.tag)) {
		return type2;
	} else if(subsumesByTag(type2.tag, type1.tag)) {
		return type1;
	}
	return new RAnyType();
}

function intersection(type1: RDataType, type2: RDataType): RDataType {
	if(type1 instanceof RErrorType) {
		return type1;
	} else if(type2 instanceof RErrorType) {
		return type2;
	} else if(type1 instanceof RFunctionType && type2 instanceof RFunctionType) {
		const parameterTypes = new Map<number | string, RDataType>();
		const keys1 = new Set(type1.parameterTypes.keys());
		const keys2 = new Set(type2.parameterTypes.keys());
		for(const key of keys1.intersection(keys2)) {
			const parameterType1 = type1.parameterTypes.get(key) ?? new RAnyType();
			const parameterType2 = type2.parameterTypes.get(key) ?? new RAnyType();
			parameterTypes.set(key, union(parameterType1, parameterType2));
		}
		const returnType = intersection(type1.returnType, type2.returnType);
		return new RFunctionType(parameterTypes, returnType);
	} else if(type1 instanceof RListType && type2 instanceof RListType) {
		return new RListType(intersection(type1.elementType, type2.elementType));
	} else if(subsumesByTag(type1.tag, type2.tag)) {
		return type1;
	} else if(subsumesByTag(type2.tag, type1.tag)) {
		return type2;
	}
	return new RNoneType();
}


export type RVectorElementType
	= RLogicalType
	| RIntegerType
	| RDoubleType
	| RComplexType
	| RStringType
	| RRawType

export function isVectorType(type: RDataType | UnresolvedRDataType): type is RVectorElementType {
	return type.tag === RDataTypeTag.Logical
		|| type.tag === RDataTypeTag.Integer
		|| type.tag === RDataTypeTag.Double
		|| type.tag === RDataTypeTag.Complex
		|| type.tag === RDataTypeTag.String
		|| type.tag === RDataTypeTag.Raw;
}
	
export type CompoundRDataType = RVectorType | RFunctionType | RListType;

export function isCompoundType(type: UnresolvedRDataType): type is UnresolvedCompoundRDataType
export function isCompoundType(type: RDataType): type is CompoundRDataType
export function isCompoundType(type: RDataType | UnresolvedRDataType): type is CompoundRDataType | UnresolvedCompoundRDataType {
	return type.tag === RDataTypeTag.Vector || type.tag === RDataTypeTag.Function || type.tag === RDataTypeTag.List;
}

/**
 * The `RDataType` type is the union of all possible types that can be inferred
 * by the type inferencer for R objects.
 * It should be used whenever you either not care what kind of
 * type you are dealing with or if you want to handle all possible types.
*/
export type RDataType
	= RVectorElementType
	| RNullType
	| REnvironmentType
	| RLanguageType
	| CompoundRDataType
	| RTypeVariable
	| RErrorType
	| RAnyType
	| RNoneType;
	
export type UnresolvedCompoundRDataType = UnresolvedRVectorType | UnresolvedRFunctionType | UnresolvedRListType;
	
export type UnresolvedRDataType
	= RVectorElementType
	| RNullType
	| REnvironmentType
	| RLanguageType
	| UnresolvedCompoundRDataType
	| UnresolvedRTypeVariable
	// | RErrorType
	| RAnyType
	| RNoneType;