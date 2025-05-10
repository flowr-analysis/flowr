// import type { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';

// export type TypeId<T extends string | number = string | number> = T & { __brand?: 'type-id' };
// export function typeIdFromNodeId(nodeId: NodeId): TypeId {
// 	return nodeId as TypeId;
// }

// interface UnificationError extends Error {
// 	__brand: 'unification-error';
// }
// function isUnificationError(error: unknown): error is UnificationError {
// 	return typeof error === 'object' && error !== null && '__brand' in error && error.__brand === 'unification-error';
// }


/**
 * This enum lists a tag for each of the possible R data types inferred by the
 * type inferencer. It is mainly used to identify subtypes of {@link RDataType}.
 */
export enum RDataTypeTag {
    /** {@link RAnyType} */
    Any = 'AnyType',
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
    /** {@link RSpecialType} */
    Special = 'RSpecialType',
    /** {@link RBuiltinType} */
    Builtin = 'RBuiltinType',
    /** {@link RTypeVariable} */
    Variable = 'RTypeVariable',
}

export class RAnyType {
	readonly tag = RDataTypeTag.Any;
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

export class RFunctionType {
	readonly tag = RDataTypeTag.Function;
}

export class RListType {
	readonly tag = RDataTypeTag.List;
}

export class REnvironmentType {
	readonly tag = RDataTypeTag.Environment;
}

export class RSpecialType {
	readonly tag = RDataTypeTag.Special;
}

export class RBuiltinType {
	readonly tag = RDataTypeTag.Builtin;
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
		} else if(thisRep.tag !== otherRep.tag) {
			this.boundType = new RAnyType();
		}
	}
}


export function resolveType(type: UnresolvedRDataType): RDataType {
	if(type instanceof RTypeVariable) {
		const typeRep = type.find();
		return typeRep !== type ? resolveType(typeRep) : { tag: RDataTypeTag.Any };
	}
	return type;
}


export type PrimitiveRDataType
	= RAnyType
	| RLogicalType
	| RIntegerType
	| RDoubleType
	| RComplexType
	| RStringType
	| RRawType
	| RNullType
	| RFunctionType
	| RListType
	| REnvironmentType
	| RSpecialType
	| RBuiltinType;

export type CompoundRDataType = never;

/**
 * The `RDataType` type is the union of all possible types that can be inferred
 * by the type inferencer for R objects.
 * It should be used whenever you either not care what kind of
 * type you are dealing with or if you want to handle all possible types.
 */
export type RDataType = PrimitiveRDataType | CompoundRDataType;

export type UnresolvedCompoundRDataType = never;

export type UnresolvedRDataType
	= PrimitiveRDataType
	| UnresolvedCompoundRDataType
	| RTypeVariable;