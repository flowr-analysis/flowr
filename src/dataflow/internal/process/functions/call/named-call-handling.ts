import type { ParentInformation, RNamedFunctionCall } from '../../../../../r-bridge'
import type { DataflowProcessorInformation } from '../../../../processor'
import type { DataflowInformation } from '../../../../info'
import { processKnownFunctionCall } from './known-call-handling'
import { resolveByName } from '../../../../environments'

export function processNamedFunctionCall<OtherInfo>(
	functionCall: RNamedFunctionCall<OtherInfo & ParentInformation>,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>
): DataflowInformation {
	const resolved = resolveByName(functionCall.functionName.content, data.environment) ?? []

	// TODO: always?
	let information = processKnownFunctionCall(functionCall, data)
	for(const resolvedFunction of resolved) {
		if(resolvedFunction.kind === 'built-in-function') {
			information = resolvedFunction.processor(functionCall, data, information)
		}
	}

	return information
}
