import type { DataflowGraph } from '../../../dataflow/graph/graph';
import type { RNode } from '../../../r-bridge/lang-4.x/ast/model/model';
import type { RString } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-string';
import type { RSymbol } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { ParentInformation } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { AbstractInterpretationInfo, DataFrameAssignmentInfo } from '../absint-info';
import { resolveIdToAbstractValue } from '../absint-visitor';

export function mapDataFrameVariableAssignment(
	identifier: RSymbol<ParentInformation> | RString<ParentInformation>,
	expression: RNode<ParentInformation & AbstractInterpretationInfo>,
	dfg: DataflowGraph
): DataFrameAssignmentInfo | undefined {
	if(resolveIdToAbstractValue(expression, dfg) === undefined) {
		return;
	}
	return {
		type:       'assignment',
		identifier: identifier.info.id,
		expression: expression.info.id
	};
}
