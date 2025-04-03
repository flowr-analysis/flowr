import type { ResolveInfo } from '../../dataflow/environments/resolve-by-name';
import { resolveIdToValue } from '../../dataflow/environments/resolve-by-name';
import type { RArgument } from '../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import type { ParentInformation, RNodeWithParent } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { RType } from '../../r-bridge/lang-4.x/ast/model/type';
import { unwrapRValue, unwrapRValueToString } from '../../util/r-value';

export function resolveIdToArgName(id: NodeId | RNodeWithParent, info: ResolveInfo): string | undefined {
	const node = resolveIdToArgument(id, info);

	return node?.name?.content;
}

export function resolveIdToArgValue(id: NodeId | RNodeWithParent, info: ResolveInfo): string | number | boolean | undefined {
	const node = resolveIdToArgument(id, info);

	if(node?.value !== undefined) {
		const resolvedValue = resolveIdToValue(node.value, info);

		if(resolvedValue?.length === 1) {
			return unwrapRValue(resolvedValue[0]);
		}
	}
	return undefined;
}

export function resolveIdToArgStringVector(id: NodeId | RNodeWithParent, info: ResolveInfo): string[] | undefined {
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

export function resolveIdToArgValueSymbolName(id: NodeId | RNodeWithParent, info: ResolveInfo): string | undefined {
	const node = resolveIdToArgument(id, info);

	if(node?.value?.type === RType.Symbol) {
		return node.value.content;
	} else if(node?.value?.type === RType.String) {
		return node.value.content.str;
	}
	return undefined;
}

export function resolveIdToArgVectorLength(id: NodeId | RNodeWithParent, info: ResolveInfo): number | undefined {
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

function resolveIdToArgument(id: NodeId | RNodeWithParent, { graph, idMap }: ResolveInfo): RArgument<ParentInformation> | undefined {
	idMap ??= graph?.idMap;
	const node = typeof id === 'object' ? id : idMap?.get(id);

	if(node?.type === RType.Argument) {
		return node;
	}
	return undefined;
}
