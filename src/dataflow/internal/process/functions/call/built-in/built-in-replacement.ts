import type {
	NodeId,
	ParentInformation,
	RFunctionArgument,
	RSymbol
} from '../../../../../../r-bridge'
import type { DataflowProcessorInformation } from '../../../../../processor'
import type { DataflowInformation } from '../../../../../info'
import { dataflowLogger  } from '../../../../../index'
import { processKnownFunctionCall } from '../known-call-handling'

export function processReplacementFunction<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation>,
	/** last one has to be the value */
	args: readonly RFunctionArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
	config: { superAssignment?: boolean, makeMaybe?: boolean }
): DataflowInformation {
	if(args.length < 2) {
		dataflowLogger.warn(`Replacement ${name.content} has less than 2 arguments, skipping`)
		return processKnownFunctionCall(name, args, rootId, data).information
	}

	console.log('processReplacementFunction', name, args, rootId, data, config)

	return processKnownFunctionCall(name, args, rootId, data).information
}

