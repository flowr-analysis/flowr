import type { RNode } from '../../../r-bridge/lang-4.x/ast/model/model';
import type { RString } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-string';
import type { RSymbol } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { ParentInformation } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { RType } from '../../../r-bridge/lang-4.x/ast/model/type';
import type { AbstractInterpretationInfo, DataFrameAssignmentInfo, DataFrameInfo } from '../absint-info';

export function mapDataFrameAssignment(
	node: RNode<ParentInformation>
): DataFrameInfo | undefined {
	if(node.type === RType.BinaryOp && node.lhs !== undefined && node.rhs !== undefined) {
		if(node.lhs.type === RType.Symbol || node.lhs.type === RType.String) {
			return mapDataFrameVariableAssignment(node.lhs, node.rhs);
		}
	}
}

export function mapDataFrameVariableAssignment(
	identifier: RSymbol<ParentInformation> | RString<ParentInformation>,
	expression: RNode<ParentInformation & AbstractInterpretationInfo>
): DataFrameAssignmentInfo | undefined {
	if(expression.info.dataFrame?.domain?.get(expression.info.id) === undefined) {
		return;
	}
	return {
		type:       'assignment',
		identifier: identifier.info.id,
		expression: expression.info.id
	};
}
