import type { ParentInformation, RFunctionCall } from '../../../r-bridge'
import { RType, EmptyArgument } from '../../../r-bridge'
import type { DataflowProcessorInformation } from './processor'
import { processDataflowFor } from './processor'
import type { DataflowInformation } from '../../common/info'
import type { FunctionArgument } from '../../common/graph'
import { EdgeType, DataflowGraph } from '../../common/graph'
import { define, overwriteEnvironments, resolveByName } from '../../common/environments'
import { linkArgumentsOnCall } from '../../v1/internal/linker'
import { isSourceCall, processSourceCall } from '../../v1/internal/process/functions/source'

export const UnnamedFunctionCallPrefix = 'unnamed-function-call-'

export function processFunctionCall<OtherInfo>(
	functionCall: RFunctionCall<OtherInfo & ParentInformation>,
	data:         DataflowProcessorInformation<OtherInfo & ParentInformation>
): DataflowInformation {
	const named = functionCall.flavor === 'named'

	const functionName = processDataflowFor(named ? functionCall.functionName : functionCall.calledFunction, data)

	let finalEnv = functionName.environments
	// arg env contains the environments with other args defined
	let argEnv = functionName.environments
	const finalGraph = new DataflowGraph()
	const callArgs: FunctionArgument[] = []
	const remainingReadInArgs = []

	const functionRootId = functionCall.info.id

	let functionCallName: string

	if(named) {
		functionCallName = functionCall.functionName.content
		const functionCallNamespace = functionCall.functionName.namespace
		console.log('Calling Function', functionCallName, 'in namespace', functionCallNamespace)
	} else {
		functionCallName = `${UnnamedFunctionCallPrefix}${functionRootId}`
		// we know, that it calls the toplevel:
		finalGraph.addEdge(functionRootId, functionCall.calledFunction.info.id, EdgeType.Calls, 'always')
		// keep the defined function
		finalGraph.mergeWith(functionName.graph)
	}

	for(const arg of functionCall.arguments) {
		if(arg === EmptyArgument) {
			callArgs.push('empty')
			continue
		}

		const processed = processDataflowFor(arg, { ...data, environments: argEnv })

		finalEnv = overwriteEnvironments(finalEnv, processed.environments)
		argEnv = overwriteEnvironments(argEnv, processed.environments)

		finalGraph.mergeWith(processed.graph)

		if(processed.out.length > 0 || processed.unknownReferences.length > 0) {
			const ref = processed.out[0] ?? processed.unknownReferences[0]
			if(arg.type !== RType.Argument || !arg.name) {
				callArgs.push(ref)
			} else {
				callArgs.push([arg.name.content, ref])
			}

			// add an argument edge to the final graph
			finalGraph.addEdge(functionRootId, ref, EdgeType.Argument, 'always')
		}

		// resolve reads within argument
		for(const ingoing of [...processed.in, ...processed.unknownReferences]) {
			const tryToResolve = resolveByName(ingoing.name, argEnv)

			if(tryToResolve === undefined) {
				remainingReadInArgs.push(ingoing)
			} else {
				for(const resolved of tryToResolve) {
					finalGraph.addEdge(ingoing.nodeId, resolved.nodeId,EdgeType.Reads, 'always')
				}
			}
		}
		if(arg.type as RType === RType.Argument && arg.name !== undefined) {
			argEnv = define(
				{ ...processed.out[0], definedAt: arg.info.id, kind: 'argument' },
				false,
				argEnv
			)
		}
	}

	finalGraph.addVertex({
		tag:         'function-call',
		id:          functionRootId,
		name:        functionCallName,
		environment: data.environments,
		when:        'always',
		args:        callArgs // same reference
	})

	const inIds = remainingReadInArgs
	inIds.push({ nodeId: functionRootId, name: functionCallName, used: 'always' })

	if(!named) {
		if(functionCall.calledFunction.type === RType.FunctionDefinition) {
			linkArgumentsOnCall(callArgs, functionCall.calledFunction.parameters, finalGraph)
		}
		// push the called function to the ids:
		inIds.push(...functionName.in, ...functionName.unknownReferences)
	}

	let info: DataflowInformation = {
		unknownReferences: [],
		in:                inIds,
		out:               functionName.out, // we do not keep argument out as it has been linked by the function
		graph:             finalGraph,
		environments:      finalEnv
	}

	// parse a source call and analyze the referenced code
	if(isSourceCall(functionCallName, finalEnv)) {
		info = processSourceCall(functionCall, data, info)
	}

	return info
}
