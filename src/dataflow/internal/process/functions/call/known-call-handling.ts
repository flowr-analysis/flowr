import type { NodeId, ParentInformation, RFunctionArgument, RSymbol } from '../../../../../r-bridge'
import type { DataflowProcessorInformation } from '../../../../processor'
import { processDataflowFor } from '../../../../processor'
import type { DataflowInformation } from '../../../../info'
import { DataflowGraph } from '../../../../graph'
import { dataflowLogger } from '../../../../index'
import { processAllArguments } from './common'

export function processKnownFunctionCall<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation>,
	args: readonly RFunctionArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>
): DataflowInformation {
	const functionName = processDataflowFor(name, data)

	const finalGraph = new DataflowGraph()
	const functionCallName = name.content
	dataflowLogger.debug(`Using ${rootId} (name: ${functionCallName}) as root for the named function call`)

	const {
		finalEnv,
		callArgs,
		remainingReadInArgs
	} = processAllArguments(functionName, args, data, finalGraph, rootId)

	finalGraph.addVertex({
		tag:         'function-call',
		id:          rootId,
		name:        functionCallName,
		environment: data.environment,
		when:        'always',
		args:        callArgs // same reference
	})

	const inIds = remainingReadInArgs
	inIds.push({ nodeId: rootId, name: functionCallName, used: 'always' })

	return {
		unknownReferences: [],
		in:                inIds,
		out:               functionName.out, // we do not keep argument out as it has been linked by the function
		graph:             finalGraph,
		environment:       finalEnv
	}
}
