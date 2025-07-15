import { RDataTypeTag } from './unification/types';

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

export function baseTypeToDataTypeTag(baseType: RBaseType): RDataTypeTag {
	switch(baseType) {
		case RBaseType.NILSXP:     return RDataTypeTag.Null;
		case RBaseType.LGLSXP:     return RDataTypeTag.Logical;
		case RBaseType.INTSXP:     return RDataTypeTag.Integer;
		case RBaseType.REALSXP:    return RDataTypeTag.Double;
		case RBaseType.CPLXSXP:    return RDataTypeTag.Complex;
		case RBaseType.STRSXP:     return RDataTypeTag.String;
		case RBaseType.VECSXP:     return RDataTypeTag.List;
		case RBaseType.RAWSXP:     return RDataTypeTag.Raw;
		case RBaseType.CLOSXP:     return RDataTypeTag.Function;
		case RBaseType.SPECIALSXP: return RDataTypeTag.Function; // Special functions are a kind of function
		case RBaseType.BUILTINSXP: return RDataTypeTag.Function; // Builtin functions are a kind of function
		case RBaseType.ENVSXP:     return RDataTypeTag.Environment;
		// case RBaseType.S4SXP:      return RDataTypeTag.Unknown; // Not yet supported
		case RBaseType.SYMSXP:     return RDataTypeTag.Language; // Symbols are a kind of language object
		case RBaseType.LANGSXP:    return RDataTypeTag.Language;
		// case RBaseType.LISTSXP:    return RDataTypeTag.List; // Not supported
		case RBaseType.EXPRSXP:    return RDataTypeTag.Language; // Expressions are a kind of language object
		// case RBaseType.EXTPTRSXP:  return RDataTypeTag.Unknown; // Not supported
		// case RBaseType.WEAKREFSXP: return RDataTypeTag.Unknown; // Not supported
		// case RBaseType.BCODESXP:   return RDataTypeTag.Unknown; // Not supported
		// case RBaseType.PROMSXP:    return RDataTypeTag.Unknown; // Not supported
		// case RBaseType.DOTSXP:     return RDataTypeTag.Language; // Not included in the type system
		// case RBaseType.ANYSXP:     return RDataTypeTag.Unknown; // Not supported
	}
}