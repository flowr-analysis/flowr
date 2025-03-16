import type { DataflowProcessorInformation } from '../../../dataflow/processor';
import type { RFunctionArgument } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { EmptyArgument } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { RSymbol } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { ParentInformation } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { RType } from '../../../r-bridge/lang-4.x/ast/model/type';
import type { DataFrameDomain } from '../domain';
import type { AbstractInterpretationInfo } from '../absint-info';
import { applyExpressionSemantics } from '../semantics';

export function processDataFrameExpressionList<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation>,
	args: readonly RFunctionArgument<OtherInfo & ParentInformation & AbstractInterpretationInfo>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation & AbstractInterpretationInfo>
) {
	const domain: Map<NodeId, DataFrameDomain> = new Map();

	for(const arg of args) {
		if(arg !== EmptyArgument && arg.value?.info.dataFrame?.type === 'assignment') {
			const resolveInfo = { environment: data.environment, idMap: data.completeAst.idMap, full: true };
			const identifier = resolveInfo.idMap.get(arg.value.info.dataFrame.identifier);
			const expression = resolveInfo.idMap.get(arg.value.info.dataFrame.expression);

			if(identifier?.type === RType.Symbol && expression !== undefined) {
				const dataFrameDomain = applyExpressionSemantics(expression, domain, resolveInfo);

				if(dataFrameDomain !== undefined) {
					domain.set(identifier.info.id, dataFrameDomain);
					identifier.info.dataFrame = {
						type:  'symbol',
						value: dataFrameDomain
					};
				}
			}
		}
	}
}
