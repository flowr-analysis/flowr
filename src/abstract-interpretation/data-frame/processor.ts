import { type BuiltInMappingName } from '../../dataflow/environments/built-in';
import { DefaultBuiltinConfig } from '../../dataflow/environments/default-builtin-config';
import { EdgeType } from '../../dataflow/graph/edge';
import { type DataflowGraph } from '../../dataflow/graph/graph';
import type { NoInfo, RNode, RSingleNode } from '../../r-bridge/lang-4.x/ast/model/model';
import type { RAccess } from '../../r-bridge/lang-4.x/ast/model/nodes/r-access';
import type { RArgument } from '../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import type { RBinaryOp } from '../../r-bridge/lang-4.x/ast/model/nodes/r-binary-op';
import { EmptyArgument, type RFunctionCall } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { RIfThenElse } from '../../r-bridge/lang-4.x/ast/model/nodes/r-if-then-else';
import type { RPipe } from '../../r-bridge/lang-4.x/ast/model/nodes/r-pipe';
import type { RUnaryOp } from '../../r-bridge/lang-4.x/ast/model/nodes/r-unary-op';
import type { ParentInformation } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { RType } from '../../r-bridge/lang-4.x/ast/model/type';
import { assertUnreachable } from '../../util/assert';
import type { AbstractInterpretationInfo } from './absint-info';
import type { DataFrameDomain, DataFrameStateDomain } from './domain';
import { DataFrameTop, joinDataFrames } from './domain';
import { applySemantics, ConstraintType, getConstraintTypes } from './semantics';
import { mapDataFrameSemantics } from './semantics-mapper';

type ROperation<Info = NoInfo> = RFunctionCall<Info> | RUnaryOp<Info> | RBinaryOp<Info> | RAccess<Info>;
type RComplexNode<Info = NoInfo> = Exclude<RNode<Info>, RSingleNode<Info>>;

type DataFrameProcessor<Node extends RComplexNode<ParentInformation>> = (
	node: Node,
	domain: DataFrameStateDomain,
	dfg: DataflowGraph
) => DataFrameStateDomain;

type DataFrameProcessorMapping = {
	[Node in RComplexNode<ParentInformation> as Node['type']]: DataFrameProcessor<Node>;
}

const DataFrameProcessorMapper: DataFrameProcessorMapping = {
	[RType.ExpressionList]:     processDataFrameNothing,
	[RType.FunctionCall]:       processDataFrameOperation,
	[RType.UnaryOp]:            processDataFrameOperation,
	[RType.BinaryOp]:           processDataFrameOperation,
	[RType.Access]:             processDataFrameOperation,
	[RType.Pipe]:               processDataFramePipe,
	[RType.Argument]:           processDataFrameArgument,
	[RType.IfThenElse]:         processDataFrameIfThenElse,
	[RType.ForLoop]:            processDataFrameNothing,
	[RType.RepeatLoop]:         processDataFrameNothing,
	[RType.WhileLoop]:          processDataFrameNothing,
	[RType.FunctionDefinition]: processDataFrameNothing,
	[RType.Parameter]:          processDataFrameNothing
};

export function processDataFrameLeaf<OtherInfo>(
	node: RSingleNode<OtherInfo & ParentInformation & AbstractInterpretationInfo>,
	domain: DataFrameStateDomain,
	dfg: DataflowGraph
): DataFrameStateDomain {
	if(node.type === RType.Symbol) {
		resolveIdToAbstractValue(node.info.id, domain, dfg);
	}
	updateDomainOfId(node, domain, dfg);
	return domain;
}

export function processDataFrameExpression<Node extends RComplexNode<ParentInformation & AbstractInterpretationInfo>>(
	node: Node,
	domain: DataFrameStateDomain,
	dfg: DataflowGraph
): DataFrameStateDomain {
	const nodeType: Node['type'] = node.type;
	const processor = DataFrameProcessorMapper[nodeType] as DataFrameProcessor<Node>;

	const result = processor(node, domain, dfg);
	updateDomainOfId(node, result, dfg);

	return result;
}

function processDataFrameOperation<OtherInfo>(
	node: ROperation<OtherInfo & ParentInformation & AbstractInterpretationInfo>,
	domain: DataFrameStateDomain,
	dfg: DataflowGraph
): DataFrameStateDomain {
	const name = getFunctionName(node);
	const origin = DefaultBuiltinConfig.find(entry => entry.names.includes(name));
	const processor = origin?.type === 'function' ? origin.processor as BuiltInMappingName : 'builtin:default';
	node.info.dataFrame = mapDataFrameSemantics(node, dfg, processor);

	if(node.info.dataFrame?.type === 'assignment') {
		const value = resolveIdToAbstractValue(node.info.dataFrame.expression, domain, dfg);

		if(value !== undefined) {
			domain.set(node.info.dataFrame.identifier, value);
			updateDomainOfId(node.info.dataFrame.identifier, domain, dfg);
			domain.set(node.info.id, value);
		}
	} else if(node.info.dataFrame?.type === 'expression') {
		let value = DataFrameTop;

		for(const operation of node.info.dataFrame.operations) {
			const operandValue = operation.operand ? resolveIdToAbstractValue(operation.operand, domain, dfg) : value;
			value = applySemantics(operation.operation, operandValue ?? DataFrameTop, operation.args);

			if(operation.operand !== undefined && getConstraintTypes(operation.operation).includes(ConstraintType.OperandModification)) {
				assignAbstractValueToId(operation.operand, value, domain, dfg);
			}
		}
		if(node.info.dataFrame.operations.some(operation => getConstraintTypes(operation.operation).includes(ConstraintType.ResultPostcondition))) {
			domain.set(node.info.id, value);
		}
	} else if(processor === 'builtin:pipe') {
		return processDataFramePipe(node, domain, dfg);
	}
	return domain;
}

function processDataFramePipe<OtherInfo>(
	node: RPipe<OtherInfo & ParentInformation & AbstractInterpretationInfo> | ROperation<OtherInfo & ParentInformation & AbstractInterpretationInfo>,
	domain: DataFrameStateDomain,
	dfg: DataflowGraph
): DataFrameStateDomain {
	let rhs: RNode<OtherInfo & ParentInformation & AbstractInterpretationInfo> | undefined;

	if(node.type === RType.Pipe || node.type === RType.BinaryOp) {
		rhs = node.rhs;
	} else if(node.type === RType.FunctionCall && node.arguments[1] !== EmptyArgument) {
		rhs = node.arguments[1]?.value;
	}
	const value = rhs ? resolveIdToAbstractValue(rhs.info.id, domain, dfg) : undefined;

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
	domain: DataFrameStateDomain,
	dfg: DataflowGraph
): DataFrameStateDomain {
	const thenExit = node.then.children.at(-1);
	const elseExit = node.otherwise?.children.at(-1);
	const thenReturn = thenExit ? resolveIdToAbstractValue(thenExit.info.id, domain, dfg) : undefined;
	const elseReturn = elseExit ? resolveIdToAbstractValue(elseExit.info.id, domain, dfg) : undefined;

	if(thenReturn !== undefined || elseReturn !== undefined) {
		const returnValue = joinDataFrames(thenReturn ?? DataFrameTop, elseReturn ?? DataFrameTop);
		domain.set(node.info.id, returnValue);
	}
	return domain;
}

function processDataFrameNothing<OtherInfo>(
	node: RComplexNode<OtherInfo & ParentInformation & AbstractInterpretationInfo>,
	domain: DataFrameStateDomain
): DataFrameStateDomain {
	return domain;
}

function assignAbstractValueToId(id: NodeId, value: DataFrameDomain, domain: DataFrameStateDomain, dfg: DataflowGraph): void {
	domain.set(id, value);
	getDefinitionOrigin(id, dfg).forEach(origin => domain.set(origin, value));
}

function getFunctionName(operation: ROperation<ParentInformation>): string {
	switch(operation.type) {
		case RType.FunctionCall:
			return operation.named ? operation.functionName.content : '';
		case RType.Access:
		case RType.BinaryOp:
		case RType.UnaryOp:
			return operation.operator;
		default:
			assertUnreachable(operation);
	}
}

function getDefinitionOrigin(id: NodeId, dfg: DataflowGraph): NodeId[] {
	return dfg.outgoingEdges(id)?.entries()
		.filter(([, edge]) => edge.types === EdgeType.Reads)
		.map(([id]) => id)
		.toArray() ?? [];
}

function resolveIdToAbstractValue(id: NodeId, domain: DataFrameStateDomain, dfg: DataflowGraph): DataFrameDomain | undefined {
	if(domain.has(id)) {
		return domain.get(id);
	}
	const origins = getDefinitionOrigin(id, dfg).map(id => domain.get(id));

	if(origins !== undefined && origins.length > 0 && origins.some(origin => origin !== undefined)) {
		const result = joinDataFrames(...origins.map(origin => origin ?? DataFrameTop));
		domain.set(id, result);

		return result;
	}
}

function updateDomainOfId(id: NodeId | RNode<ParentInformation & AbstractInterpretationInfo>, domain: DataFrameStateDomain, dfg: DataflowGraph): void {
	const node: RNode<ParentInformation & AbstractInterpretationInfo> | undefined = typeof id === 'object' ? id : dfg.idMap?.get(id);

	if(node !== undefined) {
		node.info.dataFrame ??= { type: 'other' };
		node.info.dataFrame.domain = new Map(domain);
	}
}
