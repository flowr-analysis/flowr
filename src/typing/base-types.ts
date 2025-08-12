import { DataTypeTag } from './types';

/* eslint-disable @typescript-eslint/naming-convention */
export enum RBaseType {
    NILSXP     = 'NULL',
	LGLSXP     = 'logical',
    INTSXP     = 'integer',
    REALSXP    = 'double',
	CPLXSXP    = 'complex',
    STRSXP     = 'character',
    VECSXP     = 'list',
    RAWSXP     = 'raw',
    CLOSXP     = 'closure',
    SPECIALSXP = 'special',
    BUILTINSXP = 'builtin',
    ENVSXP     = 'environment',
    // S4SXP      = 'S4',
    SYMSXP     = 'symbol',
    LANGSXP    = 'language',
    // LISTSXP    = 'pairlist',
    EXPRSXP    = 'expression',
    // EXTPTRSXP  = 'externalptr',
    // WEAKREFSXP = 'weakref',
    // BCODESXP   = 'bytecode',
    // PROMSXP    = 'promise',
    // DOTSXP     = '...',
    // ANYSXP     = 'any',
}

export function baseTypeToDataTypeTag(baseType: RBaseType): DataTypeTag {
	switch(baseType) {
		case RBaseType.NILSXP:     return DataTypeTag.Null;
		case RBaseType.LGLSXP:     return DataTypeTag.Logical;
		case RBaseType.INTSXP:     return DataTypeTag.Integer;
		case RBaseType.REALSXP:    return DataTypeTag.Double;
		case RBaseType.CPLXSXP:    return DataTypeTag.Complex;
		case RBaseType.STRSXP:     return DataTypeTag.String;
		case RBaseType.VECSXP:     return DataTypeTag.List;
		case RBaseType.RAWSXP:     return DataTypeTag.Raw;
		case RBaseType.CLOSXP:     return DataTypeTag.Function;
		case RBaseType.SPECIALSXP: return DataTypeTag.Function; // Special functions are a kind of function
		case RBaseType.BUILTINSXP: return DataTypeTag.Function; // Builtin functions are a kind of function
		case RBaseType.ENVSXP:     return DataTypeTag.Environment;
		// case RBaseType.S4SXP:      return RDataTypeTag.Unknown; // Not yet supported
		case RBaseType.SYMSXP:     return DataTypeTag.Language; // Symbols are a kind of language object
		case RBaseType.LANGSXP:    return DataTypeTag.Language;
		// case RBaseType.LISTSXP:    return RDataTypeTag.List; // Not supported
		case RBaseType.EXPRSXP:    return DataTypeTag.Language; // Expressions are a kind of language object
		// case RBaseType.EXTPTRSXP:  return RDataTypeTag.Unknown; // Not supported
		// case RBaseType.WEAKREFSXP: return RDataTypeTag.Unknown; // Not supported
		// case RBaseType.BCODESXP:   return RDataTypeTag.Unknown; // Not supported
		// case RBaseType.PROMSXP:    return RDataTypeTag.Unknown; // Not supported
		// case RBaseType.DOTSXP:     return RDataTypeTag.Language; // Not included in the type system
		// case RBaseType.ANYSXP:     return RDataTypeTag.Unknown; // Not supported
	}
}