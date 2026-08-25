import { Identifier } from '../../dataflow/environments/identifier';
import { Resolve } from '../../dataflow/environments/resolve-helper';
import type { ResolveInfo } from '../../dataflow/eval/resolve/alias-tracking';
import { RArgument } from '../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import { RString } from '../../r-bridge/lang-4.x/ast/model/nodes/r-string';
import { RSymbol } from '../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { ParentInformation } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { isNotUndefined } from '../../util/assert';
import { unliftRValue, unwrapRValue, unwrapRValueToString, unwrapRVector } from '../../util/r-value';
import { startAndEndsWith } from '../../util/text/strings';

/**
 * Returns the argument name of a function argument
 * @useInstead {@link Resolve.argument.toName}
 */
export function resolveIdToArgName(id: NodeId | RArgument<ParentInformation> | undefined, info: ResolveInfo): string | undefined {
	const node = resolveIdToArgument(id, info);

	return unquoteArgument(node?.name?.content);
}

/**
 * Resolves the value of a function argument as string, number, boolean, or vector using {@link Resolve.toValue}
 * @useInstead {@link Resolve.argument.value}
 */
export function resolveIdToArgValue(id: NodeId | RArgument<ParentInformation> | undefined, info: ResolveInfo): string | number | boolean | (string | number | boolean)[] | undefined {
	const unliftedValue = resolveArgToUnlifted(id, info);

	if(unliftedValue !== undefined) {
		if(Array.isArray(unliftedValue)) {
			return unwrapRVector(unliftedValue);
		} else {
			return unwrapRValue(unliftedValue);
		}
	}
	return undefined;
}

/**
 * Resolves the value of a function argument to a string vector using {@link Resolve.toValue} and {@link unwrapRValueToString}
 * @useInstead {@link Resolve.argument.stringVector}
 */
export function resolveIdToArgStringVector(id: NodeId | RArgument<ParentInformation> | undefined, info: ResolveInfo): string[] | undefined {
	const unliftedValue = resolveArgToUnlifted(id, info);

	if(unliftedValue !== undefined) {
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
 * @useInstead {@link Resolve.argument.symbolName}
 */
export function resolveIdToArgValueSymbolName(id: NodeId | RArgument<ParentInformation> | undefined, info: ResolveInfo): string | undefined {
	const node = resolveIdToArgument(id, info);

	if(RSymbol.is(node?.value)) {
		return unquoteArgument(Identifier.toString(node.value.content));
	} else if(RString.is(node?.value)) {
		return node.value.content.str;
	}
	return undefined;
}

/**
 * Resolves the vector length of the value of a function argument using {@link Resolve.toValue}
 * @useInstead {@link Resolve.argument.vectorLength}
 */
export function resolveIdToArgVectorLength(id: NodeId | RArgument<ParentInformation> | undefined, info: ResolveInfo): number | undefined {
	const unliftedValue = resolveArgToUnlifted(id, info);

	if(unliftedValue !== undefined) {
		if(Array.isArray(unliftedValue)) {
			return unliftedValue.length;
		} else if(unwrapRValue(unliftedValue) !== undefined) {
			return 1;
		}
	}
	return undefined;
}

/** The unlifted value of a function argument, `undefined` if the argument carries no value. */
function resolveArgToUnlifted(id: NodeId | RArgument<ParentInformation> | undefined, info: ResolveInfo) {
	const node = resolveIdToArgument(id, info);
	return node?.value !== undefined ? unliftRValue(Resolve.toValue(node.value, info)) : undefined;
}

function resolveIdToArgument(id: NodeId | RArgument<ParentInformation> | undefined, { graph, idMap }: ResolveInfo): RArgument<ParentInformation> | undefined {
	idMap ??= graph?.idMap;
	const node = id === undefined || typeof id === 'object' ? id : idMap?.get(id);

	if(RArgument.is(node)) {
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
 * Unescapes escape sequences like `\r`, `\n`, `\t`, `\'`, `\"`, `\\` back into actual newlines, tabs, quotes, and backslashes
 */
export function unescapeSpecialChars(argument: undefined): undefined;
export function unescapeSpecialChars(argument: string): string;
export function unescapeSpecialChars(argument: string | undefined): string | undefined;
export function unescapeSpecialChars(argument: string | undefined) {
	if(argument === undefined) {
		return undefined;
	}
	return unescapeQuotes(argument).replaceAll('\\r', '\r').replaceAll('\\n', '\n').replaceAll('\\t', '\t').replaceAll('\\\\', '\\');
}
