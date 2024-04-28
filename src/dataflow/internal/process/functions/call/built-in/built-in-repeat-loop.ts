import type { NodeId, ParentInformation, RFunctionArgument, RSymbol } from '../../../../../../r-bridge'
import { EmptyArgument } from '../../../../../../r-bridge'
import type { DataflowProcessorInformation } from '../../../../../processor'
import { processDataflowFor } from '../../../../../processor'
import type { DataflowInformation } from '../../../../../info'
import {
	linkCircularRedefinitionsWithinALoop,
	produceNameSharedIdMap
} from '../../../../linker'
import { dataflowLogger } from '../../../../../index'
import { processKnownFunctionCall } from '../known-call-handling'
import { guard } from '../../../../../../util/assert'

export function processRepeatLoop<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation>,
	args: readonly RFunctionArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>
): DataflowInformation {
	if(args.length !== 1 || args[0] === EmptyArgument) {
		dataflowLogger.warn(`Repeat-Loop ${name.content} does not have 1 argument, skipping`)
		return processKnownFunctionCall(name, args, rootId, data).information
	}

	/* similar to the for loop, we ignore the last argument, as it is a reverse dep. */
	const { information } = processKnownFunctionCall(name, [], rootId, data)

	const body = processDataflowFor(args[0], data)
	guard(body !== undefined, () => `Repeat-Loop ${name.content} has no body, impossible!`)

	// integrate the body again (TODO: unify merge)
	information.graph = information.graph.mergeWith(body.graph)
	information.environment = body.environment
	information.in = [...information.in, ...body.in, ...body.unknownReferences]
	information.out = [...information.out, ...body.out]
	information.returns = [...information.returns, ...body.returns]
	information.breaks = [...information.breaks, ...body.breaks]
	information.nexts = [...information.nexts, ...body.nexts]

	const namedIdShares = produceNameSharedIdMap([...body.in, ...body.unknownReferences])
	linkCircularRedefinitionsWithinALoop(information.graph, namedIdShares, body.out)

	return information
}
