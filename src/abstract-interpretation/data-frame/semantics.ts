import type { ResolveInfo } from '../../dataflow/environments/resolve-by-name';
import { resolveByName } from '../../dataflow/environments/resolve-by-name';
import type { RNode } from '../../r-bridge/lang-4.x/ast/model/model';
import type { ParentInformation } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { RType } from '../../r-bridge/lang-4.x/ast/model/type';
import type { DataFrameDomain, ColNamesDomain } from './domain';
import { DataFrameTop, ColNamesTop, IntervalTop, ColNamesBottom, joinColNames, joinDataFrames } from './domain';
import type { AbstractInterpretationInfo, DataFrameAssignmentInfo, DataFrameExpressionInfo, DataFrameOperation } from './absint-info';
import { resolveIdToArgName, resolveIdToArgVectorLength, resolveIdToArgValueSymbolName } from './resolve-args';

const DataFrameSemanticsMapper = {
	'create':    applyCreateSemantics,
	'accessCol': applyAccessColSemantics,
	'unknown':   applyUnknownSemantics
} as const satisfies Record<string, DataFrameSemanticsApplier>;

type DataFrameSemanticsApplier = (value: DataFrameDomain, event: DataFrameOperation, info: ResolveInfo) => DataFrameDomain;
export type DataFrameOperationName = keyof typeof DataFrameSemanticsMapper;

export function applySemantics<OtherInfo>(
	node: RNode<OtherInfo & ParentInformation & AbstractInterpretationInfo>,
	domain: Map<NodeId, DataFrameDomain>,
	resolveInfo : ResolveInfo<AbstractInterpretationInfo>
): DataFrameDomain {
	let dataFrameDomain = DataFrameTop;

	if(isAssignment(node)) {
		dataFrameDomain = applyAssignmentSemantics(node, domain, resolveInfo);
	} else if(isExpression(node)) {
		dataFrameDomain = applyExpressionSemantics(node, domain, resolveInfo);
	} else if(node.type === RType.FunctionCall && node.named) {
		dataFrameDomain = applySemantics(node.functionName, domain, resolveInfo);
	} else if(node.type === RType.Symbol && resolveInfo.environment !== undefined) {
		const identifiers = resolveByName(node.content, resolveInfo.environment);
		const values = identifiers?.map(id => domain.get(id.nodeId) ?? DataFrameTop);
		dataFrameDomain = values ? joinDataFrames(...values) : DataFrameTop;
	}
	node.info.dataFrame ??= { type: 'other' };
	node.info.dataFrame.domain = new Map(domain);

	return dataFrameDomain;
}

function applyAssignmentSemantics<OtherInfo>(
	node: RNode<OtherInfo & ParentInformation & {dataFrame: DataFrameAssignmentInfo}>,
	domain: Map<NodeId, DataFrameDomain>,
	resolveInfo : ResolveInfo<AbstractInterpretationInfo>
): DataFrameDomain {
	let dataFrameDomain = DataFrameTop;

	const identifier = resolveInfo.idMap?.get(node.info.dataFrame.identifier);
	const expression = resolveInfo.idMap?.get(node.info.dataFrame.expression);

	if(identifier?.type === RType.Symbol && expression !== undefined) {
		dataFrameDomain = applySemantics(expression, domain, resolveInfo);
		domain.set(identifier.info.id, dataFrameDomain);
	}
	if(identifier !== undefined) {
		identifier.info.dataFrame ??= { type: 'other' };
		identifier.info.dataFrame.domain = new Map(domain);
	}
	return dataFrameDomain;
}

function applyExpressionSemantics<OtherInfo>(
	node: RNode<OtherInfo & ParentInformation & {dataFrame: DataFrameExpressionInfo}>,
	domain: Map<NodeId, DataFrameDomain>,
	resolveInfo : ResolveInfo<AbstractInterpretationInfo>
): DataFrameDomain {
	let dataFrameDomain = DataFrameTop;

	for(const operation of node.info.dataFrame.operations) {
		if(operation.operand === undefined) {
			const semanticsApplier = DataFrameSemanticsMapper[operation.operation];
			dataFrameDomain = semanticsApplier(dataFrameDomain, operation, resolveInfo);
		} else {
			const operand = resolveInfo.idMap?.get(operation.operand);
			const operandDomain = operand ? applySemantics(operand, domain, resolveInfo) : DataFrameTop;
			const semanticsApplier = DataFrameSemanticsMapper[operation.operation];
			dataFrameDomain = semanticsApplier(operandDomain, operation, resolveInfo);

			if(operand !== undefined && operation.modify) {
				let origins = [operand.info.id];

				if(operand.type === RType.Symbol && resolveInfo.environment !== undefined) {
					const identifiers = resolveByName(operand.content, resolveInfo.environment);
					origins = identifiers?.map(id => id.nodeId) ?? origins;
				}
				for(const origin of origins) {
					domain.set(origin, dataFrameDomain);
				}
			}
		}
	}
	return dataFrameDomain;
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

function isAssignment<OtherInfo>(
	node: RNode<OtherInfo & ParentInformation & AbstractInterpretationInfo>
): node is RNode<OtherInfo & ParentInformation & {dataFrame: DataFrameAssignmentInfo}> {
	return node.info.dataFrame?.type === 'assignment';
}

function isExpression<OtherInfo>(
	node: RNode<OtherInfo & ParentInformation & AbstractInterpretationInfo>
): node is RNode<OtherInfo & ParentInformation & {dataFrame: DataFrameExpressionInfo}> {
	return node.info.dataFrame?.type === 'expression';
}
