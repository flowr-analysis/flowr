import type { AtomicVectorBaseType, DataType, REnvironmentType, RLanguageType, RNullType } from '../types';
import { DataTypeTag, RFunctionType, RListType, RTypeError, RTypeVariable } from '../types';

export class UnresolvedRListType {
	readonly tag = DataTypeTag.List;
	readonly elementType = new UnresolvedRTypeVariable();

	constructor(elementType?: UnresolvedRDataType) {
		if(elementType !== undefined) {
			this.elementType.unify(elementType);
		}
	}
}

export class UnresolvedRFunctionType {
	readonly tag = DataTypeTag.Function;
	readonly parameterTypes = new Map<number | string, UnresolvedRTypeVariable>();
	readonly returnType = new UnresolvedRTypeVariable();

	getParameterType(indexOrName: number | string): UnresolvedRTypeVariable {
		let parameterType = this.parameterTypes.get(indexOrName);
		if(parameterType === undefined) {
			parameterType = new UnresolvedRTypeVariable();
			this.parameterTypes.set(indexOrName, parameterType);
		}
		return parameterType;
	}
}

export class UnresolvedRTypeVariable {
	readonly tag = DataTypeTag.Variable;
	private boundType: UnresolvedRDataType | undefined;

	find(): UnresolvedRDataType {
		if(this.boundType instanceof UnresolvedRTypeVariable) {
			this.boundType = this.boundType.find();
		}
		return this.boundType ?? this;
	}

	unify(other: UnresolvedRDataType): void {
		const thisRep = this.find();
		const otherRep = other instanceof UnresolvedRTypeVariable ? other.find() : other;

		if(thisRep === otherRep) {
			return;
		}

		if(thisRep instanceof UnresolvedRTypeVariable) {
			thisRep.boundType = otherRep;
		} else if(otherRep instanceof UnresolvedRTypeVariable) {
			otherRep.boundType = thisRep;
		} else if(thisRep instanceof UnresolvedRFunctionType && otherRep instanceof UnresolvedRFunctionType) {
			for(const [key, type] of otherRep.parameterTypes) {
				thisRep.getParameterType(key).unify(type);
			}
			thisRep.returnType.unify(otherRep.returnType);
		} else if(thisRep instanceof UnresolvedRListType && otherRep instanceof UnresolvedRListType) {
			thisRep.elementType.unify(otherRep.elementType);
		} else if(thisRep instanceof RTypeError || thisRep.tag !== otherRep.tag) {
			this.boundType = new RTypeError(resolve(thisRep), resolve(otherRep));
		}
	}
}


export function resolve(type: UnresolvedRDataType): DataType {
	if(type instanceof UnresolvedRTypeVariable) {
		const typeRep = type.find();
		return typeRep !== type ? resolve(typeRep) : new RTypeVariable();
	} else if(type instanceof UnresolvedRFunctionType) {
		const resolvedParameterTypes = new Map(type.parameterTypes.entries().toArray().map(([key, type]) => [key, resolve(type)]));
		const resolvedReturnType = resolve(type.returnType);
		return new RFunctionType(resolvedParameterTypes, resolvedReturnType);
	} else if(type instanceof UnresolvedRListType) {
		const resolvedElementType = resolve(type.elementType);
		return new RListType(resolvedElementType);
	} else {
		return type;
	}
}
	
export type UnresolvedRDataType
	= AtomicVectorBaseType
	| UnresolvedRListType
	| RNullType
	| UnresolvedRFunctionType
	| REnvironmentType
	| RLanguageType
	| UnresolvedRTypeVariable
	| RTypeError;