import type { ResolveInfo } from '../../dataflow/environments/resolve-by-name';
import { resolveIdToValue } from '../../dataflow/environments/resolve-by-name';
import type { RNodeWithParent } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { RType } from '../../r-bridge/lang-4.x/ast/model/type';

export function resolveIdToArgName(id: NodeId | RNodeWithParent, { graph, idMap } : ResolveInfo): string | undefined {
	idMap ??= graph?.idMap;
	const node = typeof id === 'object' ? id : idMap?.get(id);

	if(node?.type === RType.Argument) {
		return node.name?.content;
	}
	return undefined;
}

export function resolveIdToArgValueSymbolName(id: NodeId | RNodeWithParent, { graph, idMap } : ResolveInfo): string | undefined {
	idMap ??= graph?.idMap;
	const node = typeof id === 'object' ? id : idMap?.get(id);

	if(node?.type === RType.Argument && node.value !== undefined) {
		if(node.value.type === RType.Symbol) {
			return node.value.content;
		} else if(node.value.type === RType.String) {
			return node.value.content.str;
		}
	}
	return undefined;
}

export function resolveIdToArgVectorLength(id: NodeId | RNodeWithParent, { graph, idMap, ...resolveInfo } : ResolveInfo): number | undefined {
	idMap ??= graph?.idMap;
	const node = typeof id === 'object' ? id : idMap?.get(id);

	if(node?.type !== RType.Argument || node.value === undefined) {
		return undefined;
	}
	const resolvedValue = resolveIdToValue(node.value, { graph, idMap, ...resolveInfo });

	if(resolvedValue?.length === 1) {
		return Array.isArray(resolvedValue[0]) ? resolvedValue[0].length : undefined;
	}
	return undefined;
}
