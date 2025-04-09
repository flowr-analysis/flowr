import type { BuiltInMappingName } from '../../dataflow/environments/built-in';
import { DefaultBuiltinConfig } from '../../dataflow/environments/default-builtin-config';
import { EdgeType } from '../../dataflow/graph/edge';
import { type DataflowGraph } from '../../dataflow/graph/graph';
import type { NoInfo, RNode, RSingleNode } from '../../r-bridge/lang-4.x/ast/model/model';
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
import { DataFrameTop, joinDataFrames } from './domain';
import { applySemantics } from './semantics';
import { mapDataFrameSemantics } from './semantics-mapper';

export type ConditionalDataFrameState = Record<'FD' | typeof RTrue | typeof RFalse, DataFrameStateDomain>;

type ROperation<Info = NoInfo> = RFunctionCall<Info> | RUnaryOp<Info> | RBinaryOp<Info> | RAccess<Info>;
export type RComplexNode<Info = NoInfo> = Exclude<RNode<Info>, RSingleNode<Info>>;

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
	[RType.ExpressionList]:     { type: 'entry', apply: processDataFrameIgnored },
	[RType.FunctionCall]:       { type: 'exit',  apply: processDataFrameOperation },
	[RType.UnaryOp]:            { type: 'exit',  apply: processDataFrameOperation },
	[RType.BinaryOp]:           { type: 'exit',  apply: processDataFrameOperation },
	[RType.Access]:             { type: 'exit',  apply: processDataFrameOperation },
	[RType.Pipe]:               { type: 'exit',  apply: processDataFramePipe },
	[RType.Argument]:           { type: 'exit',  apply: processDataFrameArgument },
	[RType.IfThenElse]:         { type: 'entry', apply: processDataFrameIfThenElse },
	[RType.ForLoop]:            { type: 'entry', apply: processDataFrameForLoop },
	[RType.RepeatLoop]:         { type: 'entry', apply: processDataFrameRepeatLoop },
	[RType.WhileLoop]:          { type: 'entry', apply: processDataFrameWhileLoop },
	[RType.FunctionDefinition]: { type: 'exit',  apply: processDataFrameIgnored },
	[RType.Parameter]:          { type: 'exit',  apply: processDataFrameIgnored }
};

export function processDataFrameNode<Node extends RComplexNode<ParentInformation & AbstractInterpretationInfo>>(
	type: 'entry' | 'exit',
	node: Node,
	domain: DataFrameStateDomain,
	dfg: DataflowGraph
): DataFrameStateDomain {
	const nodeType: Node['type'] = node.type;
	const processor = DataFrameProcessorMapper[nodeType] as DataFrameEntryExitProcessor<Node>;

	if(processor.type === type) {
		const result = processor.apply(node, domain, dfg);
		node.info.dataFrame ??= { type: 'other' };
		node.info.dataFrame.domain = result;

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
		const value = resolveIdToDomain(node.info.dataFrame.expression, domain, dfg);

		if(value !== undefined) {
			domain.set(node.info.dataFrame.identifier, value);
			domain.set(node.info.id, value);
		}
	} else if(node.info.dataFrame?.type === 'expression') {
		let value = DataFrameTop;

		for(const operation of node.info.dataFrame.operations) {
			const operandValue = operation.operand ? resolveIdToDomain(operation.operand, domain, dfg) : value;
			value = applySemantics(operation.operation, operandValue ?? DataFrameTop, operation.args);

			if(operation.operand !== undefined && 'modifyInplace' in operation.args && operation.args.modifyInplace) {
				domain.set(operation.operand, value);
			}
		}
		domain.set(node.info.id, value);
	}
	return domain;
}

function processDataFramePipe<OtherInfo>(
	node: RPipe<OtherInfo & ParentInformation & AbstractInterpretationInfo>,
	domain: DataFrameStateDomain,
	dfg: DataflowGraph
): DataFrameStateDomain {
	const value = resolveIdToDomain(node.rhs.info.id, domain, dfg);

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
		const value = resolveIdToDomain(node.value.info.id, domain, dfg);

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

function processDataFrameIgnored<OtherInfo>(
	node: RNode<OtherInfo & ParentInformation & AbstractInterpretationInfo>,
	domain: DataFrameStateDomain
): DataFrameStateDomain {
	return domain;
}

function resolveIdToDomain(id: NodeId, domain: DataFrameStateDomain, dfg: DataflowGraph): DataFrameDomain | undefined {
	if(domain.has(id)) {
		return domain.get(id);
	}
	const origins = dfg.outgoingEdges(id)?.entries()
		.filter(([, edge]) => edge.types === EdgeType.Reads)
		.map(([id]) => domain.get(id))
		.toArray();

	if(origins !== undefined && origins.length > 0 && origins.some(origin => origin !== undefined)) {
		return joinDataFrames(...origins.map(origin => origin ?? DataFrameTop));
	}
}
