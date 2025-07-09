import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { DataFrameStateDomain } from './domain';
import type { ConstraintType, DataFrameOperationArgs, DataFrameOperationName, DataFrameOperationOptions } from './semantics';

/**
 * An abstract data frame operation.
 * - `operation` contains the type of the abstract operations (see {@link DataFrameOperationName})
 * - `operand` contains the ID of the data frame operand of the operations (may be `undefined`)
 * - `type` optionally contains the constraint type to overwrite the default type of the operations (see {@link ConstraintType})
 * - `options` optionally contains additional options for the abstract operation (see {@link DataFrameOperationOptions})
 * - `...args` contains the arguments of the abstract operation (see {@link DataFrameOperationArgs})
 */
export type DataFrameOperation = {
    [Name in DataFrameOperationName]: {
		operation: Name,
		operand:   NodeId | undefined,
		type?:     ConstraintType,
		options?:  DataFrameOperationOptions<Name>
	} & DataFrameOperationArgs<Name>;
}[DataFrameOperationName];

interface DataFrameInfoBase {
	type?:   string,
	domain?: DataFrameStateDomain
}

/** Enum to mark nodes during the data frame shape inference */
export enum DataFrameInfoMarker {
	/** Marks the target symbol of assignments as "unassigned" until the assigned expression is evaluated */
	Unassigned = 'unassigned'
}

/**
 * Represents a node without extra data frame information.
 * The `marker` can be used to mark nodes during the data frame shape inference
 */
interface DataFrameEmptyInfo extends DataFrameInfoBase {
	type?:   never,
	marker?: DataFrameInfoMarker
}

/**
 * Represents a symbol assignment with a target identifier (symbol) and assigned expression.
 */
export interface DataFrameAssignmentInfo extends DataFrameInfoBase {
	type:       'assignment',
	identifier: NodeId,
	expression: NodeId
}

/**
 * Represents a data frame expression with mapped abstract operations.
 */
export interface DataFrameExpressionInfo extends DataFrameInfoBase {
	type:       'expression',
	operations: DataFrameOperation[]
}

/**
 * Represents the data frame shape inference information attached to AST nodes
 */
export type DataFrameInfo = DataFrameEmptyInfo | DataFrameAssignmentInfo | DataFrameExpressionInfo;


/**
 * Represents the abstract interpretation information attached to AST nodes
 */
export interface AbstractInterpretationInfo {
	dataFrame?: DataFrameInfo
}
