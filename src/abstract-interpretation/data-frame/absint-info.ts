import type { RNode } from '../../r-bridge/lang-4.x/ast/model/model';
import type { ParentInformation } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { DataFrameStateDomain } from './dataframe-domain';
import type { ConstraintType, DataFrameOperationArgs, DataFrameOperationName, DataFrameOperationOptions } from './semantics';

/**
 * An abstract data frame operation without additional options.
 * - `operation` contains the type of the abstract operation (see {@link DataFrameOperationName})
 * - `operand` contains the ID of the data frame operand of the operation (may be `undefined`)
 * - `...args` contains the arguments of the abstract operation (see {@link DataFrameOperationArgs})
 */
export type DataFrameOperationType<OperationName extends DataFrameOperationName = DataFrameOperationName> = {
	[Name in OperationName]: {
		operation: Name,
		operand:   NodeId | undefined
	} & DataFrameOperationArgs<Name>
}[OperationName];

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
		operation: Name,
		operand:   NodeId | undefined,
		type?:     ConstraintType,
		options?:  DataFrameOperationOptions<Name>
	} & DataFrameOperationArgs<Name>;
}[OperationName];

/**
 * Represents the base data frame information stored in the abstract interpretation info of an AST node.
 * - `type` optionally defines the type of the extra information stored in the data frame info
 * - `domain` contains the abstract data frame shape state of the node
 *   This may not be present if the data frame shape inference has not been executed yet or the program contains no data frames
 */
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
 * Represents the data frame information for a node without extra data frame information,
 * i.e. for all nodes that do not represent a data frame assignment or data frame operation (this is the default).
 *
 * The `marker` can be used to mark nodes during the data frame shape inference.
 */
interface DataFrameEmptyInfo extends DataFrameInfoBase {
	type?:   never,
	marker?: DataFrameInfoMarker
}

/**
 * Represents the data frame information for a data frame assignment with a target identifier (symbol/string) and an assigned expression.
 * This is used during data frame shape inference to mark assignments of data frame expressions to an identifier.
 *
 * Use {@link hasDataFrameAssignmentInfo} to check whether an AST node has attached data frame assignment information.
 */
export interface DataFrameAssignmentInfo extends DataFrameInfoBase {
	type:       'assignment',
	identifier: NodeId,
	expression: NodeId
}

/**
 * Represents the data frame information for a data frame function/operation with mapped abstract operations.
 * This is used during data frame shape inference to store the abstract operations a data frame function/operation is mapped to.
 *
 * The order of the abstract operations is the order in which their semantics are applied (for example, access operations are typically before other operations in the list).
 * Moreover, abstract operations that take the result of previous abstract operation as data frame operand must have the `operand` set to `undefined`.
 *
 * Use {@link hasDataFrameExpressionInfo} to check whether an AST node has attached data frame expression information.
 */
export interface DataFrameExpressionInfo extends DataFrameInfoBase {
	type:       'expression',
	operations: DataFrameOperation[]
}

/**
 * Represents the data frame shape inference information stored in the abstract interpretation info of AST nodes.
 */
export type DataFrameInfo = DataFrameEmptyInfo | DataFrameAssignmentInfo | DataFrameExpressionInfo;

/**
 * Represents the abstract interpretation information attached to AST nodes.
 */
export interface AbstractInterpretationInfo {
	dataFrame?: DataFrameInfo
}

/**
 * Checks whether an AST node has attached data frame assignment information.
 */
export function hasDataFrameAssignmentInfo<OtherInfo>(
	node: RNode<OtherInfo & ParentInformation & AbstractInterpretationInfo>
): node is RNode<OtherInfo & ParentInformation & AbstractInterpretationInfo & { dataFrame: DataFrameAssignmentInfo }> {
	return node.info.dataFrame?.type === 'assignment';
}

/**
 * Checks whether an AST node has attached data frame expression information.
 */
export function hasDataFrameExpressionInfo<OtherInfo>(
	node: RNode<OtherInfo & ParentInformation & AbstractInterpretationInfo>
): node is RNode<OtherInfo & ParentInformation & AbstractInterpretationInfo & { dataFrame: DataFrameExpressionInfo }> {
	return node.info.dataFrame?.type === 'expression';
}

/**
 * Checks whether an AST node has an attached data frame info marker.
 */
export function hasDataFrameInfoMarker<OtherInfo>(
	node: RNode<OtherInfo & ParentInformation & AbstractInterpretationInfo>,
	marker: DataFrameInfoMarker
): boolean {
	return node.info.dataFrame?.type === undefined && node.info.dataFrame?.marker === marker;
}
