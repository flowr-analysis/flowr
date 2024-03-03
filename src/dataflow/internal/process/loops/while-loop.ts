import type { DataflowInformation } from '../../../info'
import type { DataflowProcessorInformation } from '../../../processor'
import { processDataflowFor } from '../../../processor'
import {
	appendEnvironment,
	makeAllMaybe,
} from '../../../environments'
import { linkCircularRedefinitionsWithinALoop, linkInputs, produceNameSharedIdMap } from '../../linker'
import type { ParentInformation, RWhileLoop } from '../../../../r-bridge'

export function processWhileLoop<OtherInfo>(loop: RWhileLoop<OtherInfo & ParentInformation>, data: DataflowProcessorInformation<OtherInfo & ParentInformation>): DataflowInformation {
	const condition = processDataflowFor(loop.condition, data)
	data = { ...data, environment: condition.environment }
	const body = processDataflowFor(loop.body, data)

	const environment = condition.environment
	const nextGraph = condition.graph.mergeWith(body.graph)

	const finalEnvironment = appendEnvironment(condition.environment, body.environment)

	// this is theoretically redundant, but we would have to manually mark all affected edges as maybe this way. This does that for us.
	const remainingInputs = linkInputs([
		...makeAllMaybe(body.unknownReferences, nextGraph, finalEnvironment),
		...makeAllMaybe(body.in, nextGraph, finalEnvironment)],
	environment, [...condition.in, ...condition.unknownReferences], nextGraph, true)

	linkCircularRedefinitionsWithinALoop(nextGraph, produceNameSharedIdMap(remainingInputs), body.out)

	return {
		unknownReferences: [],
		in:                remainingInputs,
		out:               [...makeAllMaybe(body.out, nextGraph, finalEnvironment), ...condition.out],
		graph:             nextGraph,
		/* the body might not happen if the condition is false */
		environment:       finalEnvironment
	}
}
