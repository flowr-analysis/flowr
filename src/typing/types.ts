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
}

export interface RAnyType {
    readonly tag: RDataTypeTag.Any;
}

export interface RLogicalType {
    readonly tag: RDataTypeTag.Logical;
}

export interface RIntegerType {
    readonly tag: RDataTypeTag.Integer;
}

export interface RDoubleType {
    readonly tag: RDataTypeTag.Double;
}

export interface RComplexType {
    readonly tag: RDataTypeTag.Complex;
}

export interface RStringType {
    readonly tag: RDataTypeTag.String;
}

export interface RRawType {
    readonly tag: RDataTypeTag.Raw;
}

export interface RNullType {
    readonly tag: RDataTypeTag.Null;
}

export interface RFunctionType {
    readonly tag: RDataTypeTag.Function;
}

export interface RListType {
    readonly tag: RDataTypeTag.List;
}

export interface REnvironmentType {
    readonly tag: RDataTypeTag.Environment;
}

export interface RSpecialType {
    readonly tag: RDataTypeTag.Special;
}

export interface RBuiltinType {
    readonly tag: RDataTypeTag.Builtin;
}

/**
 * The `RDataType` type is the union of all possible types that can be inferred
 * by the type inferencer for R objects.
 * It should be used whenever you either not care what kind of
 * type you are dealing with or if you want to handle all possible types.
 */
export type RDataType
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
    | RBuiltinType