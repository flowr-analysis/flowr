import type { ResolveInfo } from '../../dataflow/environments/resolve-by-name';
import { resolveByName } from '../../dataflow/environments/resolve-by-name';
import type { RNode } from '../../r-bridge/lang-4.x/ast/model/model';
import type { ParentInformation } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { RType } from '../../r-bridge/lang-4.x/ast/model/type';
import type { DataFrameDomain } from './domain';
import { DataFrameTop, joinDataFrames } from './domain';
import type { AbstractInterpretationInfo, DataFrameAssignmentInfo, DataFrameExpressionInfo, DataFrameOperation } from './absint-info';
import { DataFrameSemanticsMapper } from './expression-semantics';

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
	} else if(node.type === RType.Argument && node.value !== undefined) {
		dataFrameDomain = applySemantics(node.value, domain, resolveInfo);
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
		const operand = operation.operand ? resolveInfo.idMap?.get(operation.operand) : undefined;
		const operandDomain = operand ? applySemantics(operand, domain, resolveInfo) : undefined;
		applyArgumentSemantics(operation, domain, resolveInfo);
		const semanticsApplier = DataFrameSemanticsMapper[operation.operation];
		dataFrameDomain = semanticsApplier(operandDomain ?? dataFrameDomain, operation, resolveInfo);

		if(operand !== undefined && operation.modify) {
			let origins = [operand.info.id];

			if(operand.type === RType.Symbol && resolveInfo.environment !== undefined) {
				const identifiers = resolveByName(operand.content, resolveInfo.environment);
				origins = identifiers?.map(id => id.nodeId) ?? origins;
			}
			origins.forEach(origin => domain.set(origin, dataFrameDomain));
		}
	}
	return dataFrameDomain;
}

function applyArgumentSemantics(
	operation: DataFrameOperation,
	domain: Map<NodeId, DataFrameDomain>,
	resolveInfo : ResolveInfo<AbstractInterpretationInfo>
): void {
	operation.arguments
		.map(arg => arg ? resolveInfo.idMap?.get(arg) : undefined)
		.filter(arg => arg !== undefined)
		.forEach(arg => applySemantics(arg, domain, resolveInfo));
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
