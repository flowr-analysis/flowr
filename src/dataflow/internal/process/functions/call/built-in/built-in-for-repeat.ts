import type { NodeId, ParentInformation, RFunctionArgument, RSymbol } from '../../../../../../r-bridge'
import type { DataflowProcessorInformation } from '../../../../../processor'
import { processDataflowFor } from '../../../../../processor'
import type { DataflowInformation } from '../../../../../info'
import {
	linkCircularRedefinitionsWithinALoop,
	produceNameSharedIdMap
} from '../../../../linker'
import { dataflowLogger } from '../../../../../index'
import { processKnownFunctionCall } from '../known-call-handling'
import { unpackArgument } from '../argument/unpack-argument'
import { guard } from '../../../../../../util/assert'

export function processRepeatLoop<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation>,
	args: readonly RFunctionArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>
): DataflowInformation {
	if(args.length !== 1) {
		dataflowLogger.warn(`Repeat-Loop ${name.content} does not have 1 argument, skipping`)
		return processKnownFunctionCall(name, args, rootId, data).information
	}

	const [bodyArg] = args.map(unpackArgument)

	guard(bodyArg !== undefined, () => `repeat-Loop ${JSON.stringify(args)} has missing arguments! Bad!`)

	const body = processDataflowFor(bodyArg, data)

	const graph = body.graph
	const namedIdShares = produceNameSharedIdMap([...body.in, ...body.unknownReferences])
	linkCircularRedefinitionsWithinALoop(graph, namedIdShares, body.out)

	return {
		unknownReferences: [],
		in:                [...body.in, ...body.unknownReferences],
		out:               body.out,
		environment:       body.environment,
		graph:             body.graph
	}
}
