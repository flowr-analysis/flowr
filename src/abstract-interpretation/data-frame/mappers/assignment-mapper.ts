import { VariableResolve } from '../../../config';
import type { DataflowGraph } from '../../../dataflow/graph/graph';
import type { RNode } from '../../../r-bridge/lang-4.x/ast/model/model';
import type { RString } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-string';
import type { RSymbol } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { ParentInformation } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { RType } from '../../../r-bridge/lang-4.x/ast/model/type';
import type { DataFrameAssignmentInfo } from '../absint-info';
import { isDataFrameArgument } from './arguments';

/**
 * Maps a concrete data frame assignment to data frame assignment info containing the ids of the identifier and assigned expression.
 *
 * @param identifier - The R node of the variable identifier
 * @param expression - The R node of the assigned expression
 * @param dfg  - The data flow graph for resolving the arguments
 * @returns Data frame assignment info containing the IDs of the identifier and expression, or `undefined` if the node does not represent a data frame assignment
 */
export function mapDataFrameVariableAssignment(
	identifier: RSymbol<ParentInformation> | RString<ParentInformation>,
	expression: RNode<ParentInformation>,
	dfg: DataflowGraph
): DataFrameAssignmentInfo | undefined {
	const resolveInfo = { graph: dfg, idMap: dfg.idMap, full: true, resolve: VariableResolve.Alias };

	if(!isDataFrameArgument(expression, resolveInfo)) {
		return;
	}
	return {
		type:       'assignment',
		identifier: identifier.info.id,
		expression: expression.info.id
	};
}

/**
 * Checks whether a R node represents an assignment target, i.e. is a `RSymbol` or `RString`.
 */
export function isAssignmentTarget(node: RNode<ParentInformation> | undefined): node is RSymbol<ParentInformation> | RString<ParentInformation> {
	return node?.type === RType.Symbol || node?.type === RType.String;
}
