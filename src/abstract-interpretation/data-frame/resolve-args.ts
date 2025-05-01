import type { ResolveInfo } from '../../dataflow/environments/resolve-by-name';
import { resolveIdToValue } from '../../dataflow/environments/resolve-by-name';
import type { RArgument } from '../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import type { ParentInformation } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { RType } from '../../r-bridge/lang-4.x/ast/model/type';
import { unwrapRValue, unwrapRValueToString, unwrapRVector } from '../../util/r-value';
import { startAndEndsWith } from '../../util/strings';

/**
 * Returns the argument name of a function argument
 */
export function resolveIdToArgName(id: NodeId | RArgument<ParentInformation>, info: ResolveInfo): string | undefined {
	const node = resolveIdToArgument(id, info);

	return unescapeArgument(node?.name?.content);
}

/**
 * Resolves the value of a function argument as string, number, boolean, string vector, number vector, boolean vector, or mixed vector using {@link resolveIdToValue}
 */
export function resolveIdToArgValue(id: NodeId | RArgument<ParentInformation>, info: ResolveInfo): string | number | boolean | string[] | number[] | boolean[] | (string | number | boolean)[] | undefined {
	const node = resolveIdToArgument(id, info);

	if(node?.value !== undefined) {
		const resolvedValue = resolveIdToValue(node.value, info);

		if(resolvedValue?.length === 1) {
			if(Array.isArray(resolvedValue[0])) {
				return unwrapRVector(resolvedValue[0]);
			} else {
				return unwrapRValue(resolvedValue[0]);
			}
		}
	}
	return undefined;
}

/**
 * Resolves the value of a function argument to a string vector using {@link resolveIdToValue} and {@link unwrapRValueToString}
 */
export function resolveIdToArgStringVector(id: NodeId | RArgument<ParentInformation>, info: ResolveInfo): string[] | undefined {
	const node = resolveIdToArgument(id, info);

	if(node?.value !== undefined) {
		const resolvedValue = resolveIdToValue(node.value, info);

		if(resolvedValue?.length === 1) {
			if(Array.isArray(resolvedValue[0])) {
				const array = resolvedValue[0].map(unwrapRValueToString);
				return array.every(value => value !== undefined) ? array : undefined;
			} else {
				const value: unknown = resolvedValue[0];
				const result = unwrapRValueToString(value);
				return result !== undefined ? [result] : undefined;
			}
		}
	}
	return undefined;
}

/**
 * Returns the symbol name or string value of the value of a function argument
 */
export function resolveIdToArgValueSymbolName(id: NodeId | RArgument<ParentInformation>, info: ResolveInfo): string | undefined {
	const node = resolveIdToArgument(id, info);

	if(node?.value?.type === RType.Symbol) {
		return unescapeArgument(node.value.content);
	} else if(node?.value?.type === RType.String) {
		return node.value.content.str;
	}
	return undefined;
}

/**
 * Resolves the vector length of the value of a function argument using {@link resolveIdToValue}
 */
export function resolveIdToArgVectorLength(id: NodeId | RArgument<ParentInformation>, info: ResolveInfo): number | undefined {
	const node = resolveIdToArgument(id, info);

	if(node?.value !== undefined) {
		const resolvedValue = resolveIdToValue(node.value, info);

		if(resolvedValue?.length === 1) {
			if(Array.isArray(resolvedValue[0])) {
				return resolvedValue[0].length;
			} else if(unwrapRValue(resolvedValue[0]) !== undefined) {
				return 1;
			}
		}
	}
	return undefined;
}

function resolveIdToArgument(id: NodeId | RArgument<ParentInformation>, { graph, idMap }: ResolveInfo): RArgument<ParentInformation> | undefined {
	idMap ??= graph?.idMap;
	const node = typeof id === 'object' ? id : idMap?.get(id);

	if(node?.type === RType.Argument) {
		return node;
	}
	return undefined;
}

export function unescapeArgument(argument: undefined): undefined;
export function unescapeArgument(argument: string): string;
export function unescapeArgument(argument: string | undefined): string | undefined;
export function unescapeArgument(argument: string | undefined): string | undefined {
	if(argument === undefined) {
		return undefined;
	} else if(startAndEndsWith(argument, '`') || startAndEndsWith(argument, '"') || startAndEndsWith(argument, '\'')) {
		return argument.slice(1, -1);
	}
	return argument;
}
