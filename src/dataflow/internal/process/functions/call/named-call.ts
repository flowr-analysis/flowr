import { resolveByName } from '../../../../environments'
import type { ParentInformation, RNode, RSymbol } from '../../../../../r-bridge'
import type { DataflowInformation } from '../../../../info'
import { initializeCleanDataflowInformation } from '../../../../info'
import type { DataflowProcessorInformation } from '../../../../processor'

export function processAsNamedFunctionCall<OtherInfo>(
	functionName: RSymbol<OtherInfo>,
	args: RNode<OtherInfo>[],
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>): DataflowInformation {
	// TODO: handle namespace
	const resolved = resolveByName(functionName.content, data.environment)

	// TODO: if any is undefined use default function handler
	return initializeCleanDataflowInformation(data)
}
