import { guard } from '../util/assert';

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
	readonly tag =  RDataTypeTag.Raw;
}

export class RNullType {
	readonly tag = RDataTypeTag.Null;
}

export class UnresolvedRFunctionType {
	readonly tag = RDataTypeTag.Function;

	constructor(argumentCount: number) {
		this.parameterTypes = Array.from({ length: argumentCount }, () => new RTypeVariable());
		this.returnType = new RTypeVariable();
	}

	readonly parameterTypes: RTypeVariable[];
	readonly returnType:     RTypeVariable;

	unify(other: UnresolvedRFunctionType): void {
		guard(this.parameterTypes.length === other.parameterTypes.length, 'Expected the same number of parameters for function types to unify');

		for(let i = 0; i < this.parameterTypes.length; i++) {
			this.parameterTypes[i].unify(other.parameterTypes[i]);
		}
		this.returnType.unify(other.returnType);
	}
}

export class RFunctionType {
	readonly tag = RDataTypeTag.Function;
	readonly parameterTypes: RDataType[];
	readonly returnType:     RDataType;

	constructor(parameterTypes: RDataType[], returnType: RDataType) {
		this.parameterTypes = parameterTypes;
		this.returnType = returnType;
	}
}

export class UnresolvedRListType {
	readonly tag = RDataTypeTag.List;
	readonly elementType:       RTypeVariable;
	readonly namedElementTypes: Map<string, RTypeVariable>;

	constructor(elementType?: UnresolvedRDataType) {
		this.elementType = new RTypeVariable();
		this.namedElementTypes = new Map<string, RTypeVariable>();
		if(elementType !== undefined) {
			this.elementType.unify(elementType);
		}
	}

	constrainTypeForName(name: string, type: UnresolvedRDataType): void {
		const existingType = this.namedElementTypes.get(name) ?? new RTypeVariable();
		existingType.unify(type);

		this.elementType.unify(type);
	}
	
	unify(other: UnresolvedRListType): void {
		this.elementType.unify(other.elementType);
		for(const [name, type] of other.namedElementTypes) {
			this.constrainTypeForName(name, type);
		}
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
		} else if(thisRep instanceof UnresolvedRFunctionType && otherRep instanceof UnresolvedRFunctionType && thisRep.parameterTypes.length === otherRep.parameterTypes.length) {
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
		const resolvedParameterTypes = type.parameterTypes.map(resolveType);
		const resolvedReturnType = resolveType(type.returnType);
		return new RFunctionType(resolvedParameterTypes, resolvedReturnType);
	} else if(type instanceof UnresolvedRListType) {
		const resolvedElementType = resolveType(type.elementType);
		return new RListType(resolvedElementType);
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