import type { DataflowGraphVertexFunctionCall } from '../../dataflow/graph/vertex';
import type { NoInfo, RNode } from '../../r-bridge/lang-4.x/ast/model/model';
import type { ParentInformation } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { AbstractInterpretationVisitor, type AbsintVisitorConfiguration } from '../absint-visitor';
import { DataFrameDomain, DataFrameStateDomain } from './dataframe-domain';
import { mapDataFrameAccess } from './mappers/access-mapper';
import { mapDataFrameFunctionCall } from './mappers/function-mapper';
import { mapDataFrameReplacementFunction } from './mappers/replacement-mapper';
import { applyDataFrameSemantics, ConstraintType, getConstraintType, type DataFrameOperationArgs, type DataFrameOperationName, type DataFrameOperationOptions } from './semantics';

/**
 * An abstract data frame operation.
 * - `operation` contains the type of the abstract operation (see {@link DataFrameOperationName})
 * - `operand` contains the ID of the data frame operand of the operation (may be `undefined`)
 * - `type` optionally contains the constraint type to overwrite the default type of the operation (see {@link ConstraintType})
 * - `options` optionally contains additional options for the abstract operation (see {@link DataFrameOperationOptions})
 * - `...args` contains the arguments of the abstract operation (see {@link DataFrameOperationArgs})
 */
export type DataFrameOperation<OperationName extends DataFrameOperationName = DataFrameOperationName> = {
	[Name in OperationName]: {
		operation: Name;
		operand:   NodeId | undefined;
		type?:     ConstraintType;
		options?:  DataFrameOperationOptions<Name>;
	} & DataFrameOperationArgs<Name>;
}[OperationName];

/**
 * An abstract data frame operation without additional options.
 * - `operation` contains the type of the abstract operation (see {@link DataFrameOperationName})
 * - `operand` contains the ID of the data frame operand of the operation (may be `undefined`)
 * - `...args` contains the arguments of the abstract operation (see {@link DataFrameOperationArgs})
 */
export type DataFrameOperationType<OperationName extends DataFrameOperationName = DataFrameOperationName> = {
	[Name in OperationName]: {
		operation: Name;
		operand:   NodeId | undefined;
	} & DataFrameOperationArgs<Name>;
}[OperationName];

interface DataFrameShapeInferenceConfiguration extends Omit<AbsintVisitorConfiguration<DataFrameDomain>, 'domain'> {
	readonly trackOperations?: boolean;
}

/**
 * The control flow graph visitor to infer the shape of data frames using abstract interpretation
 */
export class DataFrameShapeInferenceVisitor extends AbstractInterpretationVisitor<DataFrameDomain, NoInfo, DataFrameShapeInferenceConfiguration & { domain: DataFrameStateDomain }> {
	/**
	 * The abstract data frame operations the function call nodes are mapped to.
	 */
	private readonly operations?: Map<NodeId, DataFrameOperation[]>;

	constructor({ trackOperations = true, ...config }: DataFrameShapeInferenceConfiguration) {
		super({ ...config, domain: DataFrameStateDomain.bottom() });

		if(trackOperations) {
			this.operations = new Map();
		}
	}

	public getGlobalState(): ReadonlyMap<NodeId, DataFrameStateDomain> {
		return this.state;
	}

	/**
	 * Gets the mapped abstract data frame operations for an AST node.
	 * This requires that the abstract interpretation visitor has been completed, or at least started..
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
		const operations = mapDataFrameFunctionCall(node, this, this.config.dfg, this.config.ctx);

		return this.applyDataFrameExpression(node, operations, domain);
	}

	protected override evalReplacementCall(call: DataflowGraphVertexFunctionCall, target: NodeId, source: NodeId, domain: DataFrameStateDomain): DataFrameStateDomain {
		const node = this.getNormalizedAst(call.id);
		const targetNode = this.getNormalizedAst(target);
		const sourceNode = this.getNormalizedAst(source);

		if(node === undefined || targetNode === undefined || sourceNode === undefined) {
			return domain;
		}
		const operations = mapDataFrameReplacementFunction(node, sourceNode, this, this.config.dfg, this.config.ctx);

		return this.applyDataFrameExpression(node, operations, domain);
	}

	protected override evalAccessCall(call: DataflowGraphVertexFunctionCall, domain: DataFrameStateDomain): DataFrameStateDomain {
		const node = this.getNormalizedAst(call.id);

		if(node === undefined) {
			return domain;
		}
		const operations = mapDataFrameAccess(node, this, this.config.dfg, this.config.ctx);

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
