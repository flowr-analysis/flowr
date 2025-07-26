import type { DataType } from './types';
import { DataTypeTag } from './types';
import { assertUnreachable } from '../util/assert';

function isAny(t: DataType): boolean {
	return t.tag === DataTypeTag.Variable &&
        t.lowerBound.tag === DataTypeTag.Union && t.lowerBound.types.size === 0 &&
        t.upperBound.tag === DataTypeTag.Intersection && t.upperBound.types.size === 0;
}

/**
 * Visualize a {@link DataType} as a string.
 * The `shorten` parameter will do sever simplification so should not be used for debugging but just for display purposes.
 */
export function prettyPrint(t: DataType, shorten = true): string {
	const tag = t.tag;
	if(isAny(t)) {
		return 'any';
	}
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
			return shorten && tag.startsWith('R') && tag.endsWith('Type') ? tag.slice(1, -4) : tag;
		case DataTypeTag.Function:
			return `${shorten ? 'fn' : 'function'}(${[...t.parameterTypes.entries()].map(([k, v]) => 
				k ? `${k}: ${prettyPrint(v, shorten)}` : prettyPrint(v, shorten)
			).join(', ')}) ${shorten ? '→' : '->'} ${prettyPrint(t.returnType, shorten)}`;
		case DataTypeTag.List: {
			const type = prettyPrint(t.elementType, shorten);
			const indexed = t.indexedElementTypes.size > 0 ? `, idx: {${[...t.indexedElementTypes.entries()].map(([k, v]) => 
				k ? `${k}: ${prettyPrint(v, shorten)}` : prettyPrint(v, shorten)).join(', ')}}` : '';
			if(shorten && indexed === '' && type === 'any' || type === '$(any)') {
				return 'list';
			}
			return `list<${type}${indexed}>`;
		} case DataTypeTag.Variable: {
			const prefix = shorten ? '$' : 'var(';
			// subsumes didn't work :/
			const lower = prettyPrint(t.lowerBound, shorten);
			const upper = prettyPrint(t.upperBound, shorten);
			if(shorten && lower === upper) {
				return `${prefix}(${prettyPrint(t.lowerBound, shorten)})`;
			}
			return `${prefix}(${lower}, ${upper})`;
		}
		case DataTypeTag.Union: {
			if(shorten && t.types.size === 1) {
				return prettyPrint([...t.types][0], shorten);
			}
			const types = [...t.types].map(d => prettyPrint(d, shorten));
			if(shorten && types.some(t => t === 'any' || t === '$(any)')) {
				return '⋃(any*)';
			}
			return `${shorten ? '⋃' : 'union'}(${types.join(', ')}))`;
		}
		case DataTypeTag.Intersection:
			if(shorten && t.types.size === 1) {
				return prettyPrint([...t.types][0], shorten);
			}
			return `${shorten ? '⋂' : 'intersection'}(${[...t.types].map(d => prettyPrint(d, shorten)).join(', ')})`;
		case DataTypeTag.AtomicVector:
			return `${shorten ? 'c' : 'vector'}<${prettyPrint(t.elementType, shorten)}>`;
		case DataTypeTag.Error:
			return `error(${JSON.stringify(t.conflictingBounds)})`;
		default:
			assertUnreachable(tag);
	}
}