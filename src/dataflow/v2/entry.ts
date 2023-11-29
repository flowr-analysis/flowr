import { DataflowInformation, initializeCleanDataflowInformation } from '../v1/internal/info'
import { initializeCleanEnvironments } from '../common/environments'
import { GlobalScope } from '../common/environments/scopes'

export function produceDataFlowGraph(): DataflowInformation {
	return initializeCleanDataflowInformation({ environments: initializeCleanEnvironments(), activeScope: GlobalScope })
}
