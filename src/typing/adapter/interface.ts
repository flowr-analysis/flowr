import type { UnresolvedDataType, UnresolvedRFunctionType } from '../subtyping/types';

export interface RohdeFunctionTypeInformation {
    readonly name:    string;
    readonly package: string;
    readonly types:   readonly UnresolvedRFunctionType[]
}

export interface RohdeConstantTypeInformation {
    readonly name:    string;
    readonly package: string;
    readonly type:    UnresolvedDataType;
}

export interface RohdeTypes {
    readonly info: (RohdeFunctionTypeInformation | RohdeConstantTypeInformation)[];
}