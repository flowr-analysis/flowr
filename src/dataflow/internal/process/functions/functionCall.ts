import { DataflowInformation } from '../../info'
import { DataflowProcessorInformation, processDataflowFor } from '../../../processor'
import { define, overwriteEnvironments, resolveByName } from '../../../environments'
import { NodeId, ParentInformation, RFunctionCall, Type } from '../../../../r-bridge'
import { guard } from '../../../../util/assert'
import { DataflowGraph, dataflowLogger, EdgeType, FunctionArgument } from '../../../index'
import { linkArgumentsOnCall } from '../../linker'
import { LocalScope } from '../../../environments/scopes'

export const UnnamedFunctionCallPrefix = 'unnamed-function-call-'


function getLastNodeInGraph(functionName: DataflowInformation) {
	let functionNameId: NodeId | undefined
	for(const [nodeId] of functionName.graph.vertices(false)) {
		functionNameId = nodeId
	}
	return functionNameId
}


export function processFunctionCall<OtherInfo>(functionCall: RFunctionCall<OtherInfo & ParentInformation>, data: DataflowProcessorInformation<OtherInfo & ParentInformation>): DataflowInformation {
	const named = functionCall.flavor === 'named'
	const functionName = processDataflowFor(named ? functionCall.functionName : functionCall.calledFunction, data)

	let finalEnv = functionName.environments
	// arg env contains the environments with other args defined
	let argEnv = functionName.environments
	const finalGraph = new DataflowGraph()
	const callArgs: FunctionArgument[] = []
	const args = []
	const remainingReadInArgs = []

	const functionRootId = functionCall.info.id

	let functionCallName: string

	if(named) {
		functionCallName = functionCall.functionName.content
		dataflowLogger.debug(`Using ${functionRootId} (name: ${functionCallName}) as root for the function call`)
	} else {
		functionCallName = `${UnnamedFunctionCallPrefix}${functionRootId}`
		dataflowLogger.debug(`Using ${functionRootId} as root for the unnamed function call`)
		// we know, that it calls the toplevel:
		finalGraph.addEdge(functionRootId, functionCall.calledFunction.info.id, EdgeType.Calls, 'always')
		// keep the defined function
		finalGraph.mergeWith(functionName.graph)
	}


	for(const arg of functionCall.arguments) {
		if(arg === undefined) {
			callArgs.push('empty')
			args.push(undefined)
			continue
		}

		const processed = processDataflowFor(arg, { ...data, environments: argEnv })
		args.push(processed)

		finalEnv = overwriteEnvironments(finalEnv, processed.environments)
		argEnv = overwriteEnvironments(argEnv, processed.environments)

		finalGraph.mergeWith(processed.graph)

		guard(processed.out.length > 0, () => `Argument ${JSON.stringify(arg)} has no out references, but needs one for the unnamed arg`)
		if(arg.name === undefined) {
			callArgs.push(processed.out[0])
		} else {
			callArgs.push([arg.name.content, processed.out[0]])
		}

		// add an argument edge to the final graph
		finalGraph.addEdge(functionRootId, processed.out[0], EdgeType.Argument, 'always')
		// resolve reads within argument
		for(const ingoing of [...processed.in, ...processed.unknownReferences]) {
			const tryToResolve = resolveByName(ingoing.name, LocalScope, argEnv)

			if(tryToResolve === undefined) {
				remainingReadInArgs.push(ingoing)
			} else {
				for(const resolved of tryToResolve) {
					finalGraph.addEdge(ingoing.nodeId, resolved.nodeId,EdgeType.Reads, 'always')
				}
			}
		}
		if(arg.type === Type.Argument && arg.name !== undefined) {
			argEnv = define(
				{ ...processed.out[0], definedAt: arg.info.id, kind: 'argument' },
				LocalScope,
				argEnv
			)
		}
	}

	// we update all the usage nodes within the dataflow graph of the function name to
	// mark them as function calls, and append their argument linkages
	const functionNameId = getLastNodeInGraph(functionName)

	guard(functionNameId !== undefined, () => `Function call name id not found for ${JSON.stringify(functionCall)}`)

	finalGraph.addVertex({
		tag:         'function-call',
		id:          functionRootId,
		name:        functionCallName,
		environment: data.environments,
		when:        'always',
		scope:       data.activeScope,
		args:        callArgs // same reference
	})

	const inIds = remainingReadInArgs
	inIds.push({ nodeId: functionRootId, name: functionCallName, scope: data.activeScope, used: 'always' })

	if(!named) {
		if(functionCall.calledFunction.type === Type.FunctionDefinition) {
			linkArgumentsOnCall(callArgs, functionCall.calledFunction.parameters, finalGraph)
		}
		// push the called function to the ids:
		inIds.push(...functionName.in, ...functionName.unknownReferences)
	}

	return {
		unknownReferences: [],
		in:                inIds,
		out:               functionName.out, // we do not keep argument out as it has been linked by the function
		graph:             finalGraph,
		environments:      finalEnv,
		scope:             data.activeScope
	}
}

