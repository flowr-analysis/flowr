import type { NodeId, ParentInformation, RFunctionArgument, RSymbol } from '../../../../../../r-bridge'
import { EmptyArgument } from '../../../../../../r-bridge'
import type { DataflowProcessorInformation } from '../../../../../processor'
import type { DataflowInformation } from '../../../../../info'
import { filterOutLoopExitPoints } from '../../../../../info'
import {
	linkCircularRedefinitionsWithinALoop,
	produceNameSharedIdMap
} from '../../../../linker'
import { dataflowLogger } from '../../../../../index'
import { processKnownFunctionCall } from '../known-call-handling'
import { guard } from '../../../../../../util/assert'
import { unpackArgument } from '../argument/unpack-argument'

export function processRepeatLoop<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation>,
	args: readonly RFunctionArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>
): DataflowInformation {
	if(args.length !== 1 || args[0] === EmptyArgument) {
		dataflowLogger.warn(`Repeat-Loop ${name.content} does not have 1 argument, skipping`)
		return processKnownFunctionCall({ name, args, rootId, data }).information
	}

	const unpacked = unpackArgument(args[0])
	const { information, processedArguments } = processKnownFunctionCall({
		name,
		args:      unpacked ? [unpacked] : args,
		rootId,
		data,
		markAsNSE: [0]
	})

	const body = processedArguments[0]
	guard(body !== undefined, () => `Repeat-Loop ${name.content} has no body, impossible!`)

	const namedIdShares = produceNameSharedIdMap([...body.in, ...body.unknownReferences])
	linkCircularRedefinitionsWithinALoop(information.graph, namedIdShares, body.out)

	information.exitPoints = filterOutLoopExitPoints(information.exitPoints)

	return information
}
