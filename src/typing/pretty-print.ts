import type { DataType } from './types';
import { DataTypeTag } from './types';
import { assertUnreachable } from '../util/assert';

/**
 * Visualize a {@link DataType} as a string.
 * The `shorten` parameter will do sever simplification so should not be used for debugging but just for display purposes.
 */
export function prettyPrintDataType(type: DataType, shorten = true): string {
	const tag = type.tag;
	switch(tag) {
		case DataTypeTag.String:
		case DataTypeTag.Integer:
		case DataTypeTag.Double:
		case DataTypeTag.Complex:
		case DataTypeTag.Logical:
		case DataTypeTag.Null:
		case DataTypeTag.Raw:
		case DataTypeTag.Environment:
		case DataTypeTag.Language:
		case DataTypeTag.S4:
			return shorten && tag.startsWith('R') && tag.endsWith('Type') ? tag.slice(1, -4).toLowerCase() : tag.toLowerCase();
		case DataTypeTag.Function:
			return `(${[...type.parameterTypes.entries()].map(([k, v]) => 
				`${k}: ${prettyPrintDataType(v, shorten)}`
			).join(', ')}) ${shorten ? '→' : '->'} ${prettyPrintDataType(type.returnType, shorten)}`;
		case DataTypeTag.List: {
			const elementType = prettyPrintDataType(type.elementType, shorten);
			const indexedElementTypes = `${[...type.indexedElementTypes.entries()].map(([k, v]) => 
				`${k}: ${prettyPrintDataType(v, shorten)}`
			).join(', ')}`;
			return `list[${shorten || indexedElementTypes === '' ? elementType : indexedElementTypes}]`;
		} case DataTypeTag.Variable: {
			const prefix = shorten ? '?' : 'var';
			const lower = prettyPrintDataType(type.lowerBound, shorten);
			const upper = prettyPrintDataType(type.upperBound, shorten);
			if(shorten && lower === '⊥' && upper === '⊤') {
				return `${prefix}`;
			}
			return `${prefix}(${lower}, ${upper})`;
		}
		case DataTypeTag.Union: {
			if(type.types.size === 0) {
				return shorten ? '⊥' : 'none';
			}
			if(shorten && type.types.size === 1) {
				return prettyPrintDataType([...type.types][0], shorten);
			}
			const types = [...type.types].map(d => prettyPrintDataType(d, shorten));
			return shorten ? `${types.join(' ⋃ ')})` : `union(${types.join(', ')})`;
		}
		case DataTypeTag.Intersection: {
			if(type.types.size === 0) {
				return shorten ? '⊤' : 'any';
			}
			if(shorten && type.types.size === 1) {
				return prettyPrintDataType([...type.types][0], shorten);
			}
			const types = [...type.types].map(d => prettyPrintDataType(d, shorten));
			return shorten ? `${types.join(' ⋂ ')})` : `intersection(${types.join(', ')})`;
		}
		case DataTypeTag.AtomicVector:
			return `vector[${prettyPrintDataType(type.elementType, shorten)}]`;
		case DataTypeTag.Error:
			return 'error';
		default:
			assertUnreachable(tag);
	}
}