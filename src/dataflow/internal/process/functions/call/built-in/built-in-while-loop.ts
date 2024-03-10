import type { NodeId, ParentInformation, RFunctionArgument, RSymbol } from '../../../../../../r-bridge'
import type { DataflowProcessorInformation } from '../../../../../processor'
import type { DataflowInformation } from '../../../../../info'
import {
	linkCircularRedefinitionsWithinALoop, linkInputs,
	produceNameSharedIdMap
} from '../../../../linker'
import { dataflowLogger, makeAllMaybe } from '../../../../../index'
import { processKnownFunctionCall } from '../known-call-handling'
import { guard } from '../../../../../../util/assert'
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

	const { information, processedArguments } = processKnownFunctionCall(name, args, rootId, data)
	const [condition, body] = processedArguments

	guard(condition !== undefined && body !== undefined, () => `While-Loop ${name.content} has no condition or body, impossible!`)

	const remainingInputs = linkInputs([
		...makeAllMaybe(body.unknownReferences, information.graph, information.environment),
		...makeAllMaybe(body.in, information.graph, information.environment)
	], information.environment, [...condition.in, ...condition.unknownReferences], information.graph, true)
	linkCircularRedefinitionsWithinALoop(information.graph, produceNameSharedIdMap(remainingInputs), body.out)

	return {
		unknownReferences: [],
		in:                [{ nodeId: name.info.id, name: name.lexeme }, ...addControlEdges(remainingInputs, name.info.id, information.graph)],
		out:               addControlEdges([...makeAllMaybe(body.out, information.graph, information.environment), ...condition.out], name.info.id, information.graph),
		graph:             information.graph,
		environment:       information.environment
	}
}
