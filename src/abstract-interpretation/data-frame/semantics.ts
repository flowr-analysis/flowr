import type { ResolveInfo } from '../../dataflow/environments/resolve-by-name';
import { resolveByName, resolveIdToValue } from '../../dataflow/environments/resolve-by-name';
import type { RNode } from '../../r-bridge/lang-4.x/ast/model/model';
import type { ParentInformation, RNodeWithParent } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { RType } from '../../r-bridge/lang-4.x/ast/model/type';
import type { DataFrameDomain, ColNamesDomain } from './domain';
import { DataFrameTop, ColNamesTop, IntervalTop, ColNamesBottom, joinColNames } from './domain';
import type { AbstractInterpretationInfo, DataFrameOperation } from './processor-decorator';

const DataFrameSemanticsMapper = {
	'create':    applyCreateSemantics,
	'accessCol': applyAccessColSemantics,
	'unknown':   applyUnknownSemantics
} as const satisfies Record<string, DataFrameSemanticsApplier>;

type DataFrameSemanticsApplier = (value: DataFrameDomain, event: DataFrameOperation, info: ResolveInfo) => DataFrameDomain;
export type DataFrameOperationName = keyof typeof DataFrameSemanticsMapper;

export function applyExpressionSemantics<OtherInfo>(
	node: RNode<OtherInfo & ParentInformation & AbstractInterpretationInfo>,
	domain: Map<NodeId, DataFrameDomain>,
	resolveInfo : ResolveInfo
): DataFrameDomain | undefined {
	if(node.type === RType.FunctionCall && node.named && node.functionName.info.dataFrame?.type === 'expression') {
		let dataFrameDomain: DataFrameDomain = DataFrameTop;

		for(const operation of node.functionName.info.dataFrame.operations) {
			if(operation.operand === undefined) {
				const semanticsApplier = DataFrameSemanticsMapper[operation.operation];
				dataFrameDomain = semanticsApplier(dataFrameDomain, operation, resolveInfo);
			} else {
				const operand = resolveInfo.idMap?.get(operation.operand);
				const operandDomain = operand ? applyExpressionSemantics(operand, domain, resolveInfo) ?? DataFrameTop : DataFrameTop;
				const semanticsApplier = DataFrameSemanticsMapper[operation.operation];
				dataFrameDomain = semanticsApplier(operandDomain, operation, resolveInfo);
			}
		}
		return dataFrameDomain;
	} else if(node.type === RType.Symbol && resolveInfo.environment !== undefined) {
		const identifiers = resolveByName(node.content, resolveInfo.environment);

		if(identifiers?.length === 1) {
			const dataFrameDomain = domain.get(identifiers[0].nodeId);

			if(dataFrameDomain !== undefined) {
				node.info.dataFrame = {
					type:  'symbol',
					value: dataFrameDomain
				};
			}
			return dataFrameDomain;
		}
	}
	return undefined;
}

function applyCreateSemantics(value: DataFrameDomain, event: DataFrameOperation, info: ResolveInfo): DataFrameDomain {
	const argNames = event.arguments.map(arg => arg ? resolveIdToArgName(arg, info) : undefined);
	const argLengths = event.arguments.map(arg => arg ? resolveIdToArgVectorLength(arg, info) : undefined);
	const colnames = argNames.some(arg => arg === undefined) ? ColNamesTop : argNames as ColNamesDomain;
	const rowCount = argLengths.some(arg => arg === undefined) ? undefined : Math.max(...argLengths as number[], 0);

	return {
		colnames: colnames,
		cols:     [event.arguments.length, event.arguments.length],
		rows:     rowCount !== undefined ? [rowCount, rowCount] : IntervalTop
	};
}

function applyAccessColSemantics(value: DataFrameDomain, event: DataFrameOperation, info: ResolveInfo): DataFrameDomain {
	const argNames = event.arguments.map(arg => arg ? resolveIdToArgValueSymbolName(arg, info) : undefined);
	const colnames = argNames.some(arg => arg === undefined) ? ColNamesBottom : argNames as ColNamesDomain;

	return {
		...value,
		colnames: joinColNames(value.colnames, colnames)
	};
}

function applyUnknownSemantics(): DataFrameDomain {
	return DataFrameTop;
}

function resolveIdToArgName(id: NodeId | RNodeWithParent, { graph, idMap } : ResolveInfo): string | undefined {
	idMap ??= graph?.idMap;
	const node = typeof id === 'object' ? id : idMap?.get(id);

	if(node?.type === RType.Argument) {
		return node.name?.content;
	}
	return undefined;
}

function resolveIdToArgValueSymbolName(id: NodeId | RNodeWithParent, { graph, idMap } : ResolveInfo): string | undefined {
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

function resolveIdToArgVectorLength(id: NodeId | RNodeWithParent, { graph, idMap, ...resolveInfo } : ResolveInfo): number | undefined {
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
