import {
	type NormalizedAst,
	type ParentInformation,
	requestFingerprint,
	type RParseRequest,
	RType
} from '../../r-bridge'
import type { DataflowProcessors, RNodeV2 } from './internal/processor'
import { processDataflowFor } from './internal/processor'
import { processUninterestingLeaf } from './internal/uninteresting-leaf'
import { initializeCleanEnvironments } from '../common/environments'
import type { DataflowInformation } from '../common/info'

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- allows type adaption without re-creation
export const processors: DataflowProcessors<any> = {
	[RType.Number]:             processUninterestingLeaf,
	[RType.String]:             processUninterestingLeaf,
	[RType.Logical]:            processUninterestingLeaf,
	[RType.Symbol]:             processUninterestingLeaf,
	[RType.Comment]:            processUninterestingLeaf,
	[RType.LineDirective]:      processUninterestingLeaf,
	[RType.FunctionCall]:       processUninterestingLeaf,
	[RType.FunctionDefinition]: processUninterestingLeaf,
	[RType.Parameter]:          processUninterestingLeaf,
	[RType.Argument]:           processUninterestingLeaf,
	[RType.ExpressionList]:     processUninterestingLeaf
}


export function produceDataFlowGraph<OtherInfo>(request: RParseRequest, ast: NormalizedAst<OtherInfo & ParentInformation, RNodeV2<OtherInfo & ParentInformation>>): DataflowInformation {
	return processDataflowFor<OtherInfo>(ast.ast, {
		completeAst:    ast,
		environments:   initializeCleanEnvironments(),
		processors:     processors as DataflowProcessors<OtherInfo & ParentInformation>,
		currentRequest: request,
		referenceChain: [requestFingerprint(request)]
	})
}
