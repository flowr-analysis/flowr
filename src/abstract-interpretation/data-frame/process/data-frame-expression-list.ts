import type { DataflowProcessorInformation } from '../../../dataflow/processor';
import type { RFunctionArgument } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { EmptyArgument } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { RSymbol } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { ParentInformation } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { DataFrameDomain } from '../domain';
import type { AbstractInterpretationInfo } from '../absint-info';
import { applySemantics } from '../semantics';

export function processDataFrameExpressionList<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation>,
	args: readonly RFunctionArgument<OtherInfo & ParentInformation & AbstractInterpretationInfo>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation & AbstractInterpretationInfo>
) {
	const info = { environment: data.environment, ast: data.completeAst };
	const domain: Map<NodeId, DataFrameDomain> = new Map();

	for(const arg of args) {
		if(arg !== EmptyArgument && arg.value !== undefined) {
			applySemantics(arg.value, domain, info);
		}
	}
}
