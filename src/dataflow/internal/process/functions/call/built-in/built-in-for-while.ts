import type { NodeId, ParentInformation, RFunctionArgument, RSymbol } from '../../../../../../r-bridge'
import type { DataflowProcessorInformation } from '../../../../../processor'
import { processDataflowFor } from '../../../../../processor'
import type { DataflowInformation } from '../../../../../info'
import {
	linkCircularRedefinitionsWithinALoop, linkInputs,
	produceNameSharedIdMap
} from '../../../../linker'
import { dataflowLogger, makeAllMaybe } from '../../../../../index'
import { processKnownFunctionCall } from '../known-call-handling'
import { unpackArgument } from '../argument/unpack-argument'
import { guard } from '../../../../../../util/assert'
import { appendEnvironment } from '../../../../../environments'
import { addControlEdges } from '../common'

export function processWhileLoop<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation>,
	args: readonly RFunctionArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>
): DataflowInformation {
	if(args.length !== 2) {
		dataflowLogger.warn(`While-Loop ${name.content} does not have 2 arguments, skipping`)
		return processKnownFunctionCall(name, args, rootId, data).information
	}

	const [conditionArg, bodyArg] = args.map(unpackArgument)

	guard(conditionArg !== undefined && bodyArg !== undefined, () => `while-Loop ${JSON.stringify(args)} has missing arguments! Bad!`)

	const condition = processDataflowFor(conditionArg, data)
	data = { ...data, environment: condition.environment }
	const body = processDataflowFor(bodyArg, data)

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
		in:                addControlEdges(remainingInputs, name.info.id),
		out:               addControlEdges([...makeAllMaybe(body.out, nextGraph, finalEnvironment), ...condition.out], name.info.id),
		graph:             nextGraph,
		/* the body might not happen if the condition is false */
		environment:       finalEnvironment
	}
}
