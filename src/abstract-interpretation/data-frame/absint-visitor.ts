import type { DataflowGraphVertexFunctionCall } from '../../dataflow/graph/vertex';
import type { RNode } from '../../r-bridge/lang-4.x/ast/model/model';
import type { ParentInformation } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { AbstractInterpretationVisitor } from '../absint-visitor';
import { hasDataFrameExpressionInfo, type AbstractInterpretationInfo } from './absint-info';
import { DataFrameDomain } from './dataframe-domain';
import { mapDataFrameAccess } from './mappers/access-mapper';
import { mapDataFrameFunctionCall } from './mappers/function-mapper';
import { mapDataFrameReplacementFunction } from './mappers/replacement-mapper';
import { applyDataFrameSemantics, ConstraintType, getConstraintType } from './semantics';

/**
 * The control flow graph visitor to infer the shape of data frames using abstract interpretation
 */
export class DataFrameShapeInferenceVisitor extends AbstractInterpretationVisitor<DataFrameDomain, AbstractInterpretationInfo> {
	protected override onFunctionCall({ call }: { call: DataflowGraphVertexFunctionCall }): void {
		const node = this.getNormalizedAst(call.id);

		if(node !== undefined) {
			node.info.dataFrame = mapDataFrameFunctionCall(node, this.config.dfg, this.config.ctx);
			this.applyDataFrameExpression(node);
		}
	}

	protected override onReplacement({ call, source, target }: { call: DataflowGraphVertexFunctionCall, source: NodeId | undefined, target: NodeId | undefined }): void {
		const node = this.getNormalizedAst(call.id);
		const targetNode = this.getNormalizedAst(target);
		const sourceNode = this.getNormalizedAst(source);

		if(node !== undefined && targetNode !== undefined && sourceNode !== undefined) {
			node.info.dataFrame = mapDataFrameReplacementFunction(node, sourceNode, this.config.dfg);
			this.applyDataFrameExpression(node);
		}
	}

	protected override onAccess({ call }: { call: DataflowGraphVertexFunctionCall }): void {
		const node = this.getNormalizedAst(call.id);

		if(node !== undefined) {
			node.info.dataFrame = mapDataFrameAccess(node, this.config.dfg);
			this.applyDataFrameExpression(node);
		}
	}

	private applyDataFrameExpression(node: RNode<ParentInformation & AbstractInterpretationInfo>) {
		if(!hasDataFrameExpressionInfo(node)) {
			return;
		}
		const maxColNames = this.config.ctx.config.abstractInterpretation.dataFrame.maxColNames;
		let value = DataFrameDomain.top(maxColNames);

		for(const { operation, operand, type, options, ...args } of node.info.dataFrame.operations) {
			const operandValue = operand !== undefined ? this.getValue(operand, this.newDomain) : value;
			value = applyDataFrameSemantics(operation, operandValue ?? DataFrameDomain.top(maxColNames), args, options);
			const constraintType = type ?? getConstraintType(operation);

			if(operand !== undefined && constraintType === ConstraintType.OperandModification) {
				this.newDomain.set(operand, value);

				for(const origin of this.getVariableOrigins(operand)) {
					this.newDomain.set(origin, value);
				}
			} else if(constraintType === ConstraintType.ResultPostcondition) {
				this.newDomain.set(node.info.id, value);
			}
		}
	}
}
