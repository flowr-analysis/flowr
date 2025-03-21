import { resolveByName } from '../../dataflow/environments/resolve-by-name';
import type { RNode } from '../../r-bridge/lang-4.x/ast/model/model';
import type { NormalizedAst, ParentInformation } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { RType } from '../../r-bridge/lang-4.x/ast/model/type';
import type { DataFrameDomain } from './domain';
import { DataFrameTop, joinDataFrames } from './domain';
import type { AbstractInterpretationInfo, DataFrameAssignmentInfo, DataFrameExpressionInfo, DataFrameOperation } from './absint-info';
import { DataFrameSemanticsMapper } from './expression-semantics';
import type { REnvironmentInformation } from '../../dataflow/environments/environment';
import type { DataflowGraph } from '../../dataflow/graph/graph';
import { ReferenceType } from '../../dataflow/environments/identifier';
import type { RSymbol } from '../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';

export interface SemanticsInfo<OtherInfo> {
	environment: REnvironmentInformation,
	ast:         NormalizedAst<OtherInfo>,
	graph?:      DataflowGraph
}

export function applySemantics<OtherInfo>(
	node: RNode<OtherInfo & ParentInformation & AbstractInterpretationInfo>,
	domain: Map<NodeId, DataFrameDomain>,
	info : SemanticsInfo<AbstractInterpretationInfo>
): DataFrameDomain {
	let dataFrameDomain = DataFrameTop;

	if(isAssignment(node)) {
		dataFrameDomain = applyAssignmentSemantics(node, domain, info);
	} else if(isExpression(node)) {
		dataFrameDomain = applyExpressionSemantics(node, domain, info);
	} else if(node.type === RType.FunctionCall && node.named) {
		dataFrameDomain = applySemantics(node.functionName, domain, info);
	} else if(node.type === RType.Argument && node.value !== undefined) {
		dataFrameDomain = applySemantics(node.value, domain, info);
	} else if(node.type === RType.Symbol) {
		const identifiers = resolveVariableOrigin(node, info);
		const values = identifiers?.map(nodeId => domain.get(nodeId) ?? DataFrameTop);
		dataFrameDomain = values ? joinDataFrames(...values) : DataFrameTop;
	}
	node.info.dataFrame ??= { type: 'other' };
	node.info.dataFrame.domain = new Map(domain);

	return dataFrameDomain;
}

function applyAssignmentSemantics<OtherInfo>(
	node: RNode<OtherInfo & ParentInformation & {dataFrame: DataFrameAssignmentInfo}>,
	domain: Map<NodeId, DataFrameDomain>,
	info : SemanticsInfo<AbstractInterpretationInfo>
): DataFrameDomain {
	let dataFrameDomain = DataFrameTop;

	const identifier = info.ast.idMap.get(node.info.dataFrame.identifier);
	const expression = info.ast.idMap.get(node.info.dataFrame.expression);

	if(identifier?.type === RType.Symbol && expression !== undefined) {
		dataFrameDomain = applySemantics(expression, domain, info);
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
	info : SemanticsInfo<AbstractInterpretationInfo>
): DataFrameDomain {
	const resolveInfo = { ...info, idMap: info.ast.idMap, full: true };
	let dataFrameDomain = DataFrameTop;

	for(const operation of node.info.dataFrame.operations) {
		const operand = operation.operand ? info.ast.idMap.get(operation.operand) : undefined;
		const operandDomain = operand ? applySemantics(operand, domain, info) : undefined;
		applyArgumentSemantics(operation, domain, info);
		const semanticsApplier = DataFrameSemanticsMapper[operation.operation];
		dataFrameDomain = semanticsApplier(operandDomain ?? dataFrameDomain, operation, resolveInfo);

		if(operand !== undefined && operation.modify) {
			let origins = [operand.info.id];

			if(operand.type === RType.Symbol) {
				origins = resolveVariableOrigin(operand, info) ?? origins;
			}
			origins.forEach(origin => domain.set(origin, dataFrameDomain));
		}
	}
	return dataFrameDomain;
}

function applyArgumentSemantics(
	operation: DataFrameOperation,
	domain: Map<NodeId, DataFrameDomain>,
	info : SemanticsInfo<AbstractInterpretationInfo>
): void {
	operation.arguments
		.map(arg => arg ? info.ast.idMap.get(arg) : undefined)
		.filter(arg => arg !== undefined)
		.forEach(arg => applySemantics(arg, domain, info));
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

export function resolveVariableOrigin<OtherInfo>(
	node: RSymbol<OtherInfo & ParentInformation>,
	info: SemanticsInfo<OtherInfo>
): NodeId[] | undefined {
	return resolveByName(node.content, info.environment, ReferenceType.Variable)
		?.filter(identifier => identifier.type !== ReferenceType.BuiltInConstant && identifier.type !== ReferenceType.BuiltInFunction && (identifier.indicesCollection?.length ?? 0) === 0)
		.map(identifier => identifier.nodeId)
		.filter(nodeId => nodeId !== node.id);
}
