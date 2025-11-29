import type { DataflowGraphVertexFunctionCall } from '../../dataflow/graph/vertex';
import type { NoInfo, RNode } from '../../r-bridge/lang-4.x/ast/model/model';
import type { ParentInformation } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { type AbsintVisitorConfiguration, AbstractInterpretationVisitor } from '../absint-visitor';
import { type DataFrameOperation } from './absint-info';
import type { DataFrameStateDomain } from './dataframe-domain';
import { DataFrameDomain } from './dataframe-domain';
import { mapDataFrameAccess } from './mappers/access-mapper';
import { mapDataFrameFunctionCall } from './mappers/function-mapper';
import { mapDataFrameReplacementFunction } from './mappers/replacement-mapper';
import { applyDataFrameSemantics, ConstraintType, getConstraintType } from './semantics';

export interface DataFrameShapeInferenceConfig extends AbsintVisitorConfiguration<DataFrameDomain> {
	readonly inferOperations?: boolean;
}

/**
 * The control flow graph visitor to infer the shape of data frames using abstract interpretation
 */
export class DataFrameShapeInferenceVisitor extends AbstractInterpretationVisitor<DataFrameDomain, NoInfo, DataFrameShapeInferenceConfig> {
	/**
	 * The abstract data frame operations the function call nodes are mapped to.
	 */
	private readonly operations?: Map<NodeId, DataFrameOperation[]>;

	constructor({ inferOperations = true, ...config }: DataFrameShapeInferenceConfig) {
		super(config);

		if(inferOperations) {
			this.operations = new Map();
		}
	}

	/**
	 * Gets the mapped abstract data frame operations for an AST node.
	 * This requires that the abstract interpretation visitor has been completed, or at least started..
	 *
	 * @param id - The ID of the node to get the mapped abstract operations for
	 * @returns The mapped abstract data frame operations for the node, or `undefined` if no abstract operation was mapped for the node or storing mapped abstract operations is disabled via the visitor config.
	 */
	public getOperations(id: NodeId | undefined): readonly DataFrameOperation[] | undefined {
		return id !== undefined ? this.operations?.get(id) : undefined;
	}

	protected override evalFunctionCall(call: DataflowGraphVertexFunctionCall, domain: DataFrameStateDomain): DataFrameStateDomain {
		const node = this.getNormalizedAst(call.id);

		if(node === undefined) {
			return domain;
		}
		const operations = mapDataFrameFunctionCall(node, this.config.dfg, this.config.ctx);

		return this.applyDataFrameExpression(node, operations, domain);
	}

	protected override evalReplacementCall(call: DataflowGraphVertexFunctionCall, target: NodeId, source: NodeId, domain: DataFrameStateDomain): DataFrameStateDomain {
		const node = this.getNormalizedAst(call.id);
		const targetNode = this.getNormalizedAst(target);
		const sourceNode = this.getNormalizedAst(source);

		if(node === undefined || targetNode === undefined || sourceNode === undefined) {
			return domain;
		}
		const operations = mapDataFrameReplacementFunction(node, sourceNode, this.config.dfg);

		return this.applyDataFrameExpression(node, operations, domain);
	}

	protected override evalAccessCall(call: DataflowGraphVertexFunctionCall, domain: DataFrameStateDomain): DataFrameStateDomain {
		const node = this.getNormalizedAst(call.id);

		if(node === undefined) {
			return domain;
		}
		const operations = mapDataFrameAccess(node, this.config.dfg);

		return this.applyDataFrameExpression(node, operations, domain);
	}

	private applyDataFrameExpression(node: RNode<ParentInformation>, operations: DataFrameOperation[] | undefined, domain: DataFrameStateDomain): DataFrameStateDomain {
		if(operations === undefined) {
			return domain;
		} else if(this.operations !== undefined) {
			this.operations.set(node.info.id, operations);
		}
		const maxColNames = this.config.ctx.config.abstractInterpretation.dataFrame.maxColNames;
		let value = DataFrameDomain.top(maxColNames);

		for(const { operation, operand, type, options, ...args } of operations) {
			const operandValue = operand !== undefined ? this.getValue(operand, domain) : value;
			value = applyDataFrameSemantics(operation, operandValue ?? DataFrameDomain.top(maxColNames), args, options);
			const constraintType = type ?? getConstraintType(operation);

			if(operand !== undefined && constraintType === ConstraintType.OperandModification) {
				domain.set(operand, value);

				for(const origin of this.getVariableOrigins(operand)) {
					domain.set(origin, value);
				}
			} else if(constraintType === ConstraintType.ResultPostcondition) {
				domain.set(node.info.id, value);
			}
		}
		return domain;
	}
}
