import type { BuiltInMappingName } from '../../dataflow/environments/built-in';
import { DefaultBuiltinConfig } from '../../dataflow/environments/default-builtin-config';
import { EdgeType } from '../../dataflow/graph/edge';
import { type DataflowGraph } from '../../dataflow/graph/graph';
import type { NoInfo, RConstant, RNode, RSingleNode } from '../../r-bridge/lang-4.x/ast/model/model';
import type { RAccess } from '../../r-bridge/lang-4.x/ast/model/nodes/r-access';
import type { RArgument } from '../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import type { RBinaryOp } from '../../r-bridge/lang-4.x/ast/model/nodes/r-binary-op';
import type { RForLoop } from '../../r-bridge/lang-4.x/ast/model/nodes/r-for-loop';
import type { RFunctionCall } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { RIfThenElse } from '../../r-bridge/lang-4.x/ast/model/nodes/r-if-then-else';
import type { RPipe } from '../../r-bridge/lang-4.x/ast/model/nodes/r-pipe';
import type { RRepeatLoop } from '../../r-bridge/lang-4.x/ast/model/nodes/r-repeat-loop';
import type { RUnaryOp } from '../../r-bridge/lang-4.x/ast/model/nodes/r-unary-op';
import type { RWhileLoop } from '../../r-bridge/lang-4.x/ast/model/nodes/r-while-loop';
import type { ParentInformation } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { RType } from '../../r-bridge/lang-4.x/ast/model/type';
import type { RFalse, RTrue } from '../../r-bridge/lang-4.x/convert-values';
import type { AbstractInterpretationInfo } from './absint-info';
import type { DataFrameDomain, DataFrameStateDomain } from './domain';
import { DataFrameTop, joinDataFrames, joinDataFrameStates } from './domain';
import { applySemantics, ConstraintType, getConstraintTypes } from './semantics';
import { mapDataFrameSemantics } from './semantics-mapper';

export type ConditionalDataFrameState = Record<'FD' | typeof RTrue | typeof RFalse, DataFrameStateDomain>;

type ROperation<Info = NoInfo> = RFunctionCall<Info> | RUnaryOp<Info> | RBinaryOp<Info> | RAccess<Info>;
type RComplexNode<Info = NoInfo> = Exclude<RNode<Info>, RSingleNode<Info>>;

type DataFrameProcessor<Node extends RComplexNode<ParentInformation>> = (
	node: Node,
	domain: DataFrameStateDomain,
	dfg: DataflowGraph
) => DataFrameStateDomain;

interface DataFrameEntryExitProcessor<Node extends RComplexNode<ParentInformation>> {
	type:  'entry' | 'exit',
	apply: DataFrameProcessor<Node>
}

type DataFrameProcessorMapping = {
	[Node in RComplexNode<ParentInformation> as Node['type']]: DataFrameEntryExitProcessor<Node>;
}

const DataFrameProcessorMapper: DataFrameProcessorMapping = {
	[RType.ExpressionList]:     { type: 'exit', apply: processDataFrameLeaf },
	[RType.FunctionCall]:       { type: 'exit', apply: processDataFrameOperation },
	[RType.UnaryOp]:            { type: 'exit', apply: processDataFrameOperation },
	[RType.BinaryOp]:           { type: 'exit', apply: processDataFrameOperation },
	[RType.Access]:             { type: 'exit', apply: processDataFrameOperation },
	[RType.Pipe]:               { type: 'exit', apply: processDataFramePipe },
	[RType.Argument]:           { type: 'exit', apply: processDataFrameArgument },
	[RType.IfThenElse]:         { type: 'exit', apply: processDataFrameIfThenElse },
	[RType.ForLoop]:            { type: 'exit', apply: processDataFrameForLoop },
	[RType.RepeatLoop]:         { type: 'exit', apply: processDataFrameRepeatLoop },
	[RType.WhileLoop]:          { type: 'exit', apply: processDataFrameWhileLoop },
	[RType.FunctionDefinition]: { type: 'exit', apply: processDataFrameLeaf },
	[RType.Parameter]:          { type: 'exit', apply: processDataFrameLeaf }
};

export function processDataFrameNode<OtherInfo>(
	type: 'entry' | 'exit',
	node: RNode<OtherInfo & ParentInformation & AbstractInterpretationInfo>,
	domain: DataFrameStateDomain,
	dfg: DataflowGraph
): DataFrameStateDomain {
	if(isRSingleNode(node)) {
		return processDataFrameLeaf(node, domain, dfg);
	} else {
		return processDataFrameExpression(type, node, domain, dfg);
	}
}

function processDataFrameLeaf<OtherInfo>(
	node: RNode<OtherInfo & ParentInformation & AbstractInterpretationInfo>,
	domain: DataFrameStateDomain,
	dfg: DataflowGraph
): DataFrameStateDomain {
	updateDomainOfId(node, domain, dfg);
	return domain;
}

function processDataFrameExpression<Node extends RComplexNode<ParentInformation & AbstractInterpretationInfo>>(
	type: 'entry' | 'exit',
	node: Node,
	domain: DataFrameStateDomain,
	dfg: DataflowGraph
): DataFrameStateDomain {
	const nodeType: Node['type'] = node.type;
	const processor = DataFrameProcessorMapper[nodeType] as DataFrameEntryExitProcessor<Node>;

	if(processor.type === type) {
		const result = processor.apply(node, domain, dfg);
		updateDomainOfId(node, result, dfg);

		return result;
	}
	return domain;
}

function processDataFrameOperation<OtherInfo>(
	node: ROperation<OtherInfo & ParentInformation & AbstractInterpretationInfo>,
	domain: DataFrameStateDomain,
	dfg: DataflowGraph
): DataFrameStateDomain {
	const origin = DefaultBuiltinConfig.find(entry => entry.names.includes(node.lexeme));
	const processor = origin?.type === 'function' ? origin.processor as BuiltInMappingName : 'builtin:default';
	node.info.dataFrame = mapDataFrameSemantics(node, dfg, processor);

	if(node.info.dataFrame?.type === 'assignment') {
		const value = resolveIdToAbstractValue(node.info.dataFrame.expression, domain, dfg);

		if(value !== undefined) {
			domain.set(node.info.dataFrame.identifier, value);
			domain.set(node.info.id, value);
		}
	} else if(node.info.dataFrame?.type === 'expression') {
		let value = DataFrameTop;

		for(const operation of node.info.dataFrame.operations) {
			const operandValue = operation.operand ? resolveIdToAbstractValue(operation.operand, domain, dfg) : value;
			value = applySemantics(operation.operation, operandValue ?? DataFrameTop, operation.args);

			if(operation.operand !== undefined && getConstraintTypes(operation.operation).some(type => type === ConstraintType.OperandPrecondition || type === ConstraintType.OperandModification)) {
				assignAbstractValueToId(operation.operand, value, domain, dfg);
			}
		}
		if(node.info.dataFrame.operations.some(operation => getConstraintTypes(operation.operation).includes(ConstraintType.ResultPostcondition))) {
			domain.set(node.info.id, value);
		}
	}
	return domain;
}

function processDataFramePipe<OtherInfo>(
	node: RPipe<OtherInfo & ParentInformation & AbstractInterpretationInfo>,
	domain: DataFrameStateDomain,
	dfg: DataflowGraph
): DataFrameStateDomain {
	const value = resolveIdToAbstractValue(node.rhs.info.id, domain, dfg);

	if(value !== undefined) {
		domain.set(node.info.id, value);
	}
	return domain;
}

function processDataFrameArgument<OtherInfo>(
	node: RArgument<OtherInfo & ParentInformation & AbstractInterpretationInfo>,
	domain: DataFrameStateDomain,
	dfg: DataflowGraph
): DataFrameStateDomain {
	if(node.value !== undefined) {
		const value = resolveIdToAbstractValue(node.value.info.id, domain, dfg);

		if(value !== undefined) {
			domain.set(node.info.id, value);
		}
	}
	return domain;
}

function processDataFrameIfThenElse<OtherInfo>(
	node: RIfThenElse<OtherInfo & ParentInformation & AbstractInterpretationInfo>,
	domain: DataFrameStateDomain
): DataFrameStateDomain {
	return domain;
}

function processDataFrameForLoop<OtherInfo>(
	node: RForLoop<OtherInfo & ParentInformation & AbstractInterpretationInfo>,
	domain: DataFrameStateDomain
): DataFrameStateDomain {
	return domain;
}

function processDataFrameRepeatLoop<OtherInfo>(
	node: RRepeatLoop<OtherInfo & ParentInformation & AbstractInterpretationInfo>,
	domain: DataFrameStateDomain
): DataFrameStateDomain {
	return domain;
}

function processDataFrameWhileLoop<OtherInfo>(
	node: RWhileLoop<OtherInfo & ParentInformation & AbstractInterpretationInfo>,
	domain: DataFrameStateDomain
): DataFrameStateDomain {
	return domain;
}

function isRConstant<OtherInfo>(
	node: RNode<OtherInfo & ParentInformation>
): node is RConstant<OtherInfo & ParentInformation> {
	return node.type === RType.String || node.type === RType.Number || node.type === RType.Logical;
}

function isRSingleNode<OtherInfo>(
	node: RNode<OtherInfo & ParentInformation>
): node is RSingleNode<OtherInfo & ParentInformation> {
	return isRConstant(node) || node.type === RType.Symbol || node.type === RType.Break || node.type === RType.Next || node.type === RType.Comment || node.type === RType.LineDirective;
}

function assignAbstractValueToId(id: NodeId, value: DataFrameDomain, domain: DataFrameStateDomain, dfg: DataflowGraph): void {
	dfg.outgoingEdges(id)?.entries()
		.filter(([, edge]) => edge.types === EdgeType.Reads)
		.map(([id]) => id)
		.forEach(origin => domain.set(origin, value));
}

function resolveIdToAbstractValue(id: NodeId, domain: DataFrameStateDomain, dfg: DataflowGraph): DataFrameDomain | undefined {
	if(domain.has(id)) {
		return domain.get(id);
	}
	const origins = dfg.outgoingEdges(id)?.entries()
		.filter(([, edge]) => edge.types === EdgeType.Reads)
		.map(([id]) => domain.get(id))
		.toArray();

	if(origins !== undefined && origins.length > 0 && origins.some(origin => origin !== undefined)) {
		const result = joinDataFrames(...origins.map(origin => origin ?? DataFrameTop));
		domain.set(id, result);

		return result;
	}
}

function updateDomainOfId(id: NodeId | RNode<ParentInformation & AbstractInterpretationInfo>, domain: DataFrameStateDomain, dfg: DataflowGraph): void {
	const node: RNode<ParentInformation & AbstractInterpretationInfo> | undefined = typeof id === 'object' ? id : dfg.idMap?.get(id);

	if(node !== undefined) {
		const oldDomain = node.info.dataFrame?.domain;
		node.info.dataFrame ??= { type: 'other' };
		node.info.dataFrame.domain = oldDomain !== undefined ? joinDataFrameStates(oldDomain, domain) : new Map(domain);
	}
}
