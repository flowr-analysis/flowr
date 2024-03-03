import type { NodeId, ParentInformation, RFunctionArgument, RSymbol } from '../../../../../r-bridge'
import type { DataflowProcessorInformation } from '../../../../processor'
import type { DataflowInformation } from '../../../../info'
import { processKnownFunctionCall } from './known-call-handling'
import { resolveByName } from '../../../../environments'

export function processNamedFunctionCall<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation>,
	args: readonly RFunctionArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>
): DataflowInformation {
	// TODO: always?
	let information = processKnownFunctionCall(name, args, rootId, data)

	const resolved = resolveByName(name.content, data.environment) ?? []
	for(const resolvedFunction of resolved) {
		if(resolvedFunction.kind === 'built-in-function') {
			information = resolvedFunction.processor(name, args, rootId, data, information)
		}
	}

	return information
}
