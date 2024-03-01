import type { DataflowInformation } from '../v1/internal/info'
import { type DataflowScopeName, initializeCleanEnvironments } from '../common/environments'
import {  LocalScope } from '../common/environments/scopes'
import { type DataflowProcessors, processDataflowFor } from '../v1/processor'
import type { NormalizedAst, ParentInformation, RParseRequest } from '../../r-bridge'
import { requestFingerprint } from '../../r-bridge'
import { processors } from '../v1'

// TODO: move from legacy
export function produceDataFlowGraph<OtherInfo>(request: RParseRequest, ast: NormalizedAst<OtherInfo & ParentInformation>, initialScope: DataflowScopeName = LocalScope): DataflowInformation {
	return processDataflowFor<OtherInfo>(ast.ast, {
		completeAst:    ast,
		activeScope:    initialScope,
		environments:   initializeCleanEnvironments(),
		processors:     processors as DataflowProcessors<OtherInfo & ParentInformation>,
		currentRequest: request,
		referenceChain: [requestFingerprint(request)]
	})
}
