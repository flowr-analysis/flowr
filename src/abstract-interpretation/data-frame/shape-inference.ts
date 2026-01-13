import type { DataflowGraphVertexFunctionCall } from '../../dataflow/graph/vertex';
import type { RNode } from '../../r-bridge/lang-4.x/ast/model/model';
import type { ParentInformation } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { AbstractInterpretationVisitor, type AbsintVisitorConfiguration } from '../absint-visitor';
import { DataFrameDomain, DataFrameStateDomain } from './dataframe-domain';
import { mapDataFrameAccess } from './mappers/access-mapper';
import { mapDataFrameFunctionCall } from './mappers/function-mapper';
import { mapDataFrameReplacementFunction } from './mappers/replacement-mapper';
import { applyDataFrameSemantics, ConstraintType, getConstraintType, type DataFrameOperationArgs, type DataFrameOperationName, type DataFrameOperationOptions } from './semantics';

interface Operation<Name extends DataFrameOperationName> {
	/** The type of the abstract data frame operation (see {@link DataFrameOperationName}) */
	operation: Name;
	/** The ID of the data frame operand of the operation (may be `undefined`) */
	operand:   NodeId | undefined;
	/** The optional constraint type to overwrite the default type of the operation (see {@link ConstraintType}) */
	type?:     ConstraintType;
	/** The optional additional options for the abstract operation (see {@link DataFrameOperationOptions}) */
	options?:  DataFrameOperationOptions<Name>;
}

/**
 * An abstract data frame operation.
 */
export type DataFrameOperation<OperationName extends DataFrameOperationName = DataFrameOperationName> = {
	[Name in OperationName]: Operation<Name> & DataFrameOperationArgs<Name>;
}[OperationName];

/**
 * An abstract data frame operation without additional options.
 */
export type DataFrameOperationType<OperationName extends DataFrameOperationName = DataFrameOperationName> = {
	[Name in OperationName]: Omit<Operation<Name>, 'type' | 'options'> & DataFrameOperationArgs<Name>;
}[OperationName];

/**
 * A possible `undefined` array of abstract data frame operations (see {@link DataFrameOperation}).
 */
export type DataFrameOperations<OperationName extends DataFrameOperationName = DataFrameOperationName> = DataFrameOperation<OperationName>[] | undefined;

interface DataFrameShapeInferenceConfiguration extends Omit<AbsintVisitorConfiguration<DataFrameDomain>, 'domain'> {
	readonly trackOperations?: boolean;
}

/**
 * The control flow graph visitor to infer the shape of data frames using abstract interpretation
 */
export class DataFrameShapeInferenceVisitor extends AbstractInterpretationVisitor<DataFrameDomain, DataFrameShapeInferenceConfiguration & { domain: DataFrameStateDomain }> {
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

	/**
	 * Gets the mapped abstract data frame operations for an AST node (this only includes direct function calls, replacement calls, or access operations).
	 * This requires that the abstract interpretation visitor has been completed, or at least started.
	 * @param id - The ID of the node to get the mapped abstract operations for
	 * @returns The mapped abstract data frame operations for the node, or `undefined` if no abstract operation was mapped for the node or storing mapped abstract operations is disabled via the visitor config.
	 */
	public getAbstractOperations(id: NodeId | undefined): Readonly<DataFrameOperations> {
		return id !== undefined ? this.operations?.get(id) : undefined;
	}

	protected override onFunctionCall({ call }: { call: DataflowGraphVertexFunctionCall }): void {
		super.onFunctionCall({ call });

		const node = this.getNormalizedAst(call.id);

		if(node === undefined) {
			return;
		}
		const operations = mapDataFrameFunctionCall(node, this, this.config.dfg, this.config.ctx);
		this.applyDataFrameExpression(node, operations);
	}

	protected override onReplacementCall({ call, target, source }: { call: DataflowGraphVertexFunctionCall, target?: NodeId, source?: NodeId }): void {
		super.onReplacementCall({ call, target, source });

		const node = this.getNormalizedAst(call.id);
		const targetNode = this.getNormalizedAst(target);
		const sourceNode = this.getNormalizedAst(source);

		if(node === undefined || targetNode === undefined || sourceNode === undefined) {
			return;
		}
		const operations = mapDataFrameReplacementFunction(node, sourceNode, this, this.config.dfg, this.config.ctx);
		this.applyDataFrameExpression(node, operations);
	}

	protected override onAccessCall({ call }: { call: DataflowGraphVertexFunctionCall }): void {
		super.onAccessCall({ call });

		const node = this.getNormalizedAst(call.id);

		if(node === undefined) {
			return;
		}
		const operations = mapDataFrameAccess(node, this, this.config.dfg, this.config.ctx);
		this.applyDataFrameExpression(node, operations);
	}

	private applyDataFrameExpression(node: RNode<ParentInformation>, operations: DataFrameOperations): void {
		if(operations === undefined) {
			return;
		} else if(this.operations !== undefined) {
			this.operations.set(node.info.id, operations);
		}
		const maxColNames = this.config.ctx.config.abstractInterpretation.dataFrame.maxColNames;
		let value = DataFrameDomain.top(maxColNames);

		for(const { operation, operand, type, options, ...args } of operations) {
			const operandValue = operand !== undefined ? this.getAbstractValue(operand, this.currentState) : value;
			value = applyDataFrameSemantics(operation, operandValue ?? DataFrameDomain.top(maxColNames), args, options);
			const constraintType = type ?? getConstraintType(operation);

			if(operand !== undefined && constraintType === ConstraintType.OperandModification) {
				this.currentState.set(operand, value);

				for(const origin of this.getVariableOrigins(operand)) {
					this.currentState.set(origin, value);
				}
			} else if(constraintType === ConstraintType.ResultPostcondition) {
				this.currentState.set(node.info.id, value);
			}
		}
	}
}
