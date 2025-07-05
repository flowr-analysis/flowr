import { VariableResolve } from '../../../config';
import type { DataflowGraph } from '../../../dataflow/graph/graph';
import type { RNode } from '../../../r-bridge/lang-4.x/ast/model/model';
import type { RString } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-string';
import type { RSymbol } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { ParentInformation } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { RType } from '../../../r-bridge/lang-4.x/ast/model/type';
import type { DataFrameAssignmentInfo } from '../absint-info';
import { isDataFrameArgument } from './arguments';

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

export function isAssignmentTarget(node: RNode<ParentInformation> | undefined): node is RSymbol<ParentInformation> | RString<ParentInformation> {
	return node?.type === RType.Symbol || node?.type === RType.String;
}
