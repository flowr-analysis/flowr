import { type ResolveInfo , resolveIdToValue } from '../../dataflow/eval/resolve/alias-tracking';
import type { RArgument } from '../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import type { ParentInformation } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { RType } from '../../r-bridge/lang-4.x/ast/model/type';
import { isNotUndefined } from '../../util/assert';
import { unliftRValue, unwrapRValue, unwrapRValueToString, unwrapRVector } from '../../util/r-value';
import { startAndEndsWith } from '../../util/text/strings';

/**
 * Returns the argument name of a function argument
 */
export function resolveIdToArgName(id: NodeId | RArgument<ParentInformation> | undefined, info: ResolveInfo): string | undefined {
	const node = resolveIdToArgument(id, info);

	return unquoteArgument(node?.name?.content);
}

/**
 * Resolves the value of a function argument as string, number, boolean, or vector using {@link resolveIdToValue}
 */
export function resolveIdToArgValue(id: NodeId | RArgument<ParentInformation> | undefined, info: ResolveInfo): string | number | boolean | (string | number | boolean)[] | undefined {
	const node = resolveIdToArgument(id, info);

	if(node?.value !== undefined) {
		const resolvedValue = resolveIdToValue(node.value, info);
		const unliftedValue = unliftRValue(resolvedValue);

		if(Array.isArray(unliftedValue)) {
			return unwrapRVector(unliftedValue);
		} else {
			return unwrapRValue(unliftedValue);
		}
	}
	return undefined;
}

/**
 * Resolves the value of a function argument to a string vector using {@link resolveIdToValue} and {@link unwrapRValueToString}
 */
export function resolveIdToArgStringVector(id: NodeId | RArgument<ParentInformation> | undefined, info: ResolveInfo): string[] | undefined {
	const node = resolveIdToArgument(id, info);

	if(node?.value !== undefined) {
		const resolvedValue = resolveIdToValue(node.value, info);
		const unliftedValue = unliftRValue(resolvedValue);

		if(Array.isArray(unliftedValue)) {
			const array = unliftedValue.map(unwrapRValueToString);
			return array.every(isNotUndefined) ? array : undefined;
		} else {
			const result = unwrapRValueToString(unliftedValue);
			return result !== undefined ? [result] : undefined;
		}
	}
	return undefined;
}

/**
 * Returns the symbol name or string value of the value of a function argument
 */
export function resolveIdToArgValueSymbolName(id: NodeId | RArgument<ParentInformation> | undefined, info: ResolveInfo): string | undefined {
	const node = resolveIdToArgument(id, info);

	if(node?.value?.type === RType.Symbol) {
		return unquoteArgument(node.value.content);
	} else if(node?.value?.type === RType.String) {
		return node.value.content.str;
	}
	return undefined;
}

/**
 * Resolves the vector length of the value of a function argument using {@link resolveIdToValue}
 */
export function resolveIdToArgVectorLength(id: NodeId | RArgument<ParentInformation> | undefined, info: ResolveInfo): number | undefined {
	const node = resolveIdToArgument(id, info);

	if(node?.value !== undefined) {
		const resolvedValue = resolveIdToValue(node.value, info);
		const unliftedValue = unliftRValue(resolvedValue);

		if(Array.isArray(unliftedValue)) {
			return unliftedValue.length;
		} else if(unwrapRValue(unliftedValue) !== undefined) {
			return 1;
		}
	}
	return undefined;
}

function resolveIdToArgument(id: NodeId | RArgument<ParentInformation> | undefined, { graph, idMap }: ResolveInfo): RArgument<ParentInformation> | undefined {
	idMap ??= graph?.idMap;
	const node = id === undefined || typeof id === 'object' ? id : idMap?.get(id);

	if(node?.type === RType.Argument) {
		return node;
	}
	return undefined;
}

/* eslint-disable tsdoc/syntax */
/**
 * Removes a leading and trailing quote like `` ` ``, `"`, `'` from a string argument
 */
export function unquoteArgument(argument: undefined): undefined;
export function unquoteArgument(argument: string): string;
export function unquoteArgument(argument: string | undefined): string | undefined;
export function unquoteArgument(argument: string | undefined): string | undefined {
	if(argument === undefined) {
		return undefined;
	} else if(startAndEndsWith(argument, '`') || startAndEndsWith(argument, '"') || startAndEndsWith(argument, '\'')) {
		return argument.slice(1, -1);
	}
	return argument;
}

/**
 * Unescapes escaped quotes like `\'`, `\"` back into actual single and double quotes
 */
export function unescapeQuotes(argument: undefined): undefined;
export function unescapeQuotes(argument: string): string;
export function unescapeQuotes(argument: string | undefined): string | undefined;
export function unescapeQuotes(argument: string | undefined) {
	if(argument === undefined) {
		return undefined;
	}
	return argument.replaceAll('\\\'', '\'').replaceAll('\\"', '"');
}

/**
 * Unescapes escape sequences like `\n`, `\t`, `\'`, `\"`, `\\` back into actual newlines, tabs, quotes, and backslashes
 */
export function unescapeSpecialChars(argument: undefined): undefined;
export function unescapeSpecialChars(argument: string): string;
export function unescapeSpecialChars(argument: string | undefined): string | undefined;
export function unescapeSpecialChars(argument: string | undefined) {
	if(argument === undefined) {
		return undefined;
	}
	return unescapeQuotes(argument).replaceAll('\\n', '\n').replaceAll('\\t', '\t').replaceAll('\\\\', '\\');
}
