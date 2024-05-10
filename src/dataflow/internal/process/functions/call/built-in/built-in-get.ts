import type { NodeId, ParentInformation, RFunctionArgument, RSymbol } from '../../../../../../r-bridge'
import { RType, EmptyArgument } from '../../../../../../r-bridge'
import type { DataflowProcessorInformation } from '../../../../../processor'
import type { DataflowInformation } from '../../../../../info'
import { makeAllMaybe, makeReferenceMaybe } from '../../../../../environments'
import { dataflowLogger, EdgeType } from '../../../../../index'
import { guard } from '../../../../../../util/assert'
import type { ProcessKnownFunctionCallResult } from '../known-call-handling'
import { processKnownFunctionCall } from '../known-call-handling'

export function processGet<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation>,
	args: readonly RFunctionArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
	config: { fixNamespace?: string }
): DataflowInformation {
	if(args.length !== 1) {
		dataflowLogger.warn(`symbol access with ${name.content} has not 1 argument, skipping`)
		return processKnownFunctionCall({ name, args, rootId, data }).information
	}
	const retrieve = args[0]
	guard(retrieve !== EmptyArgument, () => `Retrieve ${name.content} has an empty argument!`)
	console.log(args)
	return processKnownFunctionCall({ name, args, rootId, data }).information
}
