import type { DataflowInformation } from '../common/info'
import { initializeCleanEnvironments } from '../common/environments'
import { type DataflowProcessors, processDataflowFor } from '../v1/processor'
import type { NormalizedAst, ParentInformation, RParseRequest } from '../../r-bridge'
import { requestFingerprint } from '../../r-bridge'
import { processors } from '../v1'

// TODO: move from legacy
export function produceDataFlowGraph<OtherInfo>(request: RParseRequest, ast: NormalizedAst<OtherInfo & ParentInformation>): DataflowInformation {
	return processDataflowFor<OtherInfo>(ast.ast, {
		completeAst:    ast,
		environments:   initializeCleanEnvironments(),
		processors:     processors as DataflowProcessors<OtherInfo & ParentInformation>,
		currentRequest: request,
		referenceChain: [requestFingerprint(request)]
	})
}
