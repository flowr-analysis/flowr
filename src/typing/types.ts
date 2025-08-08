import { guard } from '../util/assert';

/**
 * This enum lists a tag for each of the possible R data types inferred by the
 * type inferencer. It is mainly used to identify subtypes of {@link DataType}.
 */
export enum DataTypeTag {
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
	/** {@link RS4Type} */
	S4 = 'RS4Type',
	/** {@link RTypeUnion} */
	Union = 'RTypeUnion',
	/** {@link RTypeIntersection} */
	Intersection = 'RTypeIntersection',
	/** {@link RTypeVariable} */
	Variable = 'RTypeVariable',
	/** {@link RTypeError} */
	Error = 'RTypeError',
}


export class RAtomicVectorType {
	readonly tag = DataTypeTag.AtomicVector;
	readonly elementType: DataType;

	constructor(elementType: DataType) {
		this.elementType = elementType;
	}
}

export class RLogicalType {
	readonly tag = DataTypeTag.Logical;
}

export class RIntegerType {
	readonly tag = DataTypeTag.Integer;
}

export class RDoubleType {
	readonly tag = DataTypeTag.Double;
}

export class RComplexType {
	readonly tag = DataTypeTag.Complex;
}

export class RStringType {
	readonly tag = DataTypeTag.String;
}

export class RRawType {
	readonly tag = DataTypeTag.Raw;
}

export class RListType {
	readonly tag = DataTypeTag.List;
	readonly elementType:         DataType;
	readonly indexedElementTypes: ReadonlyMap<number | string, DataType>;

	constructor(elementType: DataType, indexedElementTypes: Map<number | string, DataType> = new Map()) {
		this.elementType = elementType;
		this.indexedElementTypes = indexedElementTypes;
	}
}

export class RNullType {
	readonly tag = DataTypeTag.Null;
}

export class RFunctionType {
	readonly tag = DataTypeTag.Function;
	readonly parameterTypes: Map<number | string, DataType>;
	readonly returnType:     DataType;

	constructor(parameterTypes: Map<number | string, DataType>, returnType: DataType) {
		this.parameterTypes = parameterTypes;
		this.returnType = returnType;
	}
}

export class REnvironmentType {
	readonly tag = DataTypeTag.Environment;
}

export class RLanguageType {
	readonly tag = DataTypeTag.Language;
}

export class RS4Type {
	readonly tag = DataTypeTag.S4;
}

export class RTypeUnion {
	readonly tag = DataTypeTag.Union;
	readonly types: Set<DataType> = new Set();

	constructor(...types: DataType[]) {
		for(const type of types) {
			guard(type !== this, 'Union cannot contain itself');
			this.types.add(type);
		}
	}
}

export class RTypeIntersection {
	readonly tag = DataTypeTag.Intersection;
	readonly types: Set<DataType> = new Set();

	constructor(...types: DataType[]) {
		for(const type of types) {
			guard(type !== this, 'Intersection cannot contain itself');
			this.types.add(type);
		}
	}
}

export class RTypeVariable {
	readonly tag = DataTypeTag.Variable;
	readonly lowerBound: DataType;
	readonly upperBound: DataType;
	
	constructor(lowerBound: DataType = new RTypeUnion(), upperBound: DataType = new RTypeIntersection()) {
		guard(lowerBound !== this, 'Lower bound cannot be the type variable itself');
		this.lowerBound = lowerBound;
		guard(upperBound !== this, 'Upper bound cannot be the type variable itself');
		this.upperBound = upperBound;
	}
}

export class RTypeError {
	readonly tag = DataTypeTag.Error;
	conflictingBounds: [DataType, DataType];

	constructor(...conflictingBounds: [DataType, DataType]) {
		this.conflictingBounds = conflictingBounds;
	}
}


export type AtomicVectorBaseType
	= RLogicalType
	| RIntegerType
	| RDoubleType
	| RComplexType
	| RStringType
	| RRawType

export function isAtomicVectorBaseType(type: DataType): type is AtomicVectorBaseType {
	return type.tag === DataTypeTag.Logical
		|| type.tag === DataTypeTag.Integer
		|| type.tag === DataTypeTag.Double
		|| type.tag === DataTypeTag.Complex
		|| type.tag === DataTypeTag.String
		|| type.tag === DataTypeTag.Raw;
}

export type SimpleType
	= AtomicVectorBaseType
	| RNullType
	| REnvironmentType
	| RLanguageType
	| RS4Type;

/**
 * The `RDataType` type is the union of all possible types that can be inferred
 * by the type inferencer for R objects.
 * It should be used whenever you either not care what kind of
 * type you are dealing with or if you want to handle all possible types.
*/
export type DataType
	= SimpleType
	| RAtomicVectorType
	| RListType
	| RFunctionType
	| RTypeUnion
	| RTypeIntersection
	| RTypeVariable
	| RTypeError;

export type DataTypeInfo = {
	inferredType: DataType;
}