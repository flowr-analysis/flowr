import type { ParentInformation, RNamedFunctionCall } from '../../../../../r-bridge'
import type { DataflowProcessorInformation } from '../../../../processor'
import { processDataflowFor } from '../../../../processor'
import type { DataflowInformation } from '../../../../info'
import { DataflowGraph } from '../../../../graph'
import { dataflowLogger } from '../../../../index'
import { processAllArguments } from './common'

export function processKnownFunctionCall<OtherInfo>(functionCall: RNamedFunctionCall<OtherInfo & ParentInformation>, data: DataflowProcessorInformation<OtherInfo & ParentInformation>): DataflowInformation {
	const functionName = processDataflowFor(functionCall.functionName, data)

	const finalGraph = new DataflowGraph()
	const functionRootId = functionCall.info.id
	const functionCallName = functionCall.functionName.content
	dataflowLogger.debug(`Using ${functionRootId} (name: ${functionCallName}) as root for the named function call`)

	const {
		finalEnv,
		callArgs,
		remainingReadInArgs
	} = processAllArguments(functionName, functionCall, data, finalGraph, functionRootId)

	finalGraph.addVertex({
		tag:         'function-call',
		id:          functionRootId,
		name:        functionCallName,
		environment: data.environment,
		when:        'always',
		args:        callArgs // same reference
	})

	const inIds = remainingReadInArgs
	inIds.push({ nodeId: functionRootId, name: functionCallName, used: 'always' })

	return {
		unknownReferences: [],
		in:                inIds,
		out:               functionName.out, // we do not keep argument out as it has been linked by the function
		graph:             finalGraph,
		environment:       finalEnv
	}
}
