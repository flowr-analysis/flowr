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
	/** {@link RNeverType} */
    Variable = 'RTypeVariable',
	/** {@link RErrorType} */
	Error = 'RErrorType',
	/** {@link RUnknownType} */
	Unknown = 'RUnknownType',
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

export class RNullType {
	readonly tag = RDataTypeTag.Null;
}

export class UnresolvedRFunctionType {
	readonly tag = RDataTypeTag.Function;
	readonly parameterTypes = new Map<number | string, RTypeVariable>();
	readonly returnType = new RTypeVariable();

	constrainParameterType(indexOrName: number | string, type: UnresolvedRDataType): void {
		if(!this.parameterTypes.has(indexOrName)) {
			this.parameterTypes.set(indexOrName, new RTypeVariable());
		}
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		this.parameterTypes.get(indexOrName)!.unify(type);
	}

	unify(other: UnresolvedRFunctionType): void {
		for(const [key, type] of other.parameterTypes) {
			this.constrainParameterType(key, type);
		}
		this.returnType.unify(other.returnType);
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
	readonly elementType = new RTypeVariable();
	readonly namedElementTypes = new Map<string, RTypeVariable>();

	constructor(elementType?: UnresolvedRDataType) {
		if(elementType !== undefined) {
			this.elementType.unify(elementType);
		}
	}

	constrainElementTypeForName(name: string, type: UnresolvedRDataType): void {
		if(!this.namedElementTypes.has(name)) {
			this.namedElementTypes.set(name, new RTypeVariable());
		}
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		this.namedElementTypes.get(name)!.unify(type);
		this.elementType.unify(type);
	}
	
	unify(other: UnresolvedRListType): void {
		this.elementType.unify(other.elementType);
		for(const [name, type] of other.namedElementTypes) {
			this.constrainElementTypeForName(name, type);
		}
	}
}

export class RListType {
	readonly tag = RDataTypeTag.List;
	readonly elementType:       RDataType;
	readonly namedElementTypes: Map<string, RDataType>;

	constructor(elementType: RDataType, namedElementTypes?: Map<string, RDataType>) {
		this.elementType = elementType;
		this.namedElementTypes = namedElementTypes ?? new Map<string, RDataType>();
	}
}

export class REnvironmentType {
	readonly tag = RDataTypeTag.Environment;
}

export class RLanguageType {
	readonly tag = RDataTypeTag.Language;
}

export class RTypeVariable {
	readonly tag = RDataTypeTag.Variable;
	private boundType: UnresolvedRDataType | undefined;

	find(): UnresolvedRDataType {
		if(this.boundType instanceof RTypeVariable) {
			this.boundType = this.boundType.find();
		}
		return this.boundType ?? this;
	}

	unify(other: UnresolvedRDataType): void {
		const thisRep = this.find();
		const otherRep = other instanceof RTypeVariable ? other.find() : other;

		if(thisRep === otherRep) {
			return;
		}

		if(thisRep instanceof RTypeVariable) {
			thisRep.boundType = otherRep;
		} else if(otherRep instanceof RTypeVariable) {
			otherRep.boundType = thisRep;
		} else if(thisRep instanceof UnresolvedRFunctionType && otherRep instanceof UnresolvedRFunctionType) {
			thisRep.unify(otherRep);
		} else if(thisRep instanceof UnresolvedRListType && otherRep instanceof UnresolvedRListType) {
			thisRep.unify(otherRep);
		} else if(thisRep instanceof RErrorType && otherRep instanceof RErrorType) {
			otherRep.conflictingTypes.push(...thisRep.conflictingTypes);
			this.boundType = otherRep;
		} else if(thisRep.tag !== otherRep.tag) {
			if(thisRep instanceof RErrorType) {
				thisRep.conflictingTypes.push(otherRep);
			} else if(otherRep instanceof RErrorType) {
				otherRep.conflictingTypes.push(thisRep);
				this.boundType = otherRep;
			} else {
				this.boundType = new RErrorType([thisRep, otherRep]);
			}
		}
	}
}

export class RErrorType {
	readonly tag = RDataTypeTag.Error;

	constructor(conflictingTypes: UnresolvedRDataType[]) {
		this.conflictingTypes = conflictingTypes;
	}	

	conflictingTypes: UnresolvedRDataType[];
}

export class RUnknownType {
	readonly tag = RDataTypeTag.Unknown;
}


export function resolveType(type: UnresolvedRDataType): RDataType {
	if(type instanceof RTypeVariable) {
		const typeRep = type.find();
		return typeRep !== type ? resolveType(typeRep) : { tag: RDataTypeTag.Unknown };
	} else if(type instanceof UnresolvedRFunctionType) {
		const resolvedParameterTypes = new Map(type.parameterTypes.entries().toArray().map(([key, type]) => [key, resolveType(type)]));
		const resolvedReturnType = resolveType(type.returnType);
		return new RFunctionType(resolvedParameterTypes, resolvedReturnType);
	} else if(type instanceof UnresolvedRListType) {
		const resolvedElementType = resolveType(type.elementType);
		const resolvedNamedElementTypes = new Map(type.namedElementTypes.entries().toArray().map(([name, type]) => [name, resolveType(type)]));
		return new RListType(resolvedElementType, resolvedNamedElementTypes);
	} else {
		return type;
	}
}


export type PrimitiveRDataType
	= RLogicalType
	| RIntegerType
	| RDoubleType
	| RComplexType
	| RStringType
	| RRawType
	| RNullType
	| REnvironmentType
	| RLanguageType

export type CompoundRDataType = RFunctionType | RListType;

/**
 * The `RDataType` type is the union of all possible types that can be inferred
 * by the type inferencer for R objects.
 * It should be used whenever you either not care what kind of
 * type you are dealing with or if you want to handle all possible types.
 */
export type RDataType = PrimitiveRDataType | CompoundRDataType | RErrorType | RUnknownType;

export type UnresolvedCompoundRDataType = UnresolvedRFunctionType | UnresolvedRListType;

export type UnresolvedRDataType
	= PrimitiveRDataType
	| UnresolvedCompoundRDataType
	| RTypeVariable
	| RErrorType
	| RUnknownType;