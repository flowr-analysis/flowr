import type { DataflowInformation } from '../../info'
import type {DataflowProcessorInformation} from '../../../processor'
import { processDataflowFor } from '../../../processor'
import {define, overwriteEnvironments, resolveByName} from '../../../environments'
import type {NormalizedAst, ParentInformation, RFunctionCall} from '../../../../r-bridge'
import {fileNameDeterministicCountingIdGenerator} from '../../../../r-bridge'
import { removeTokenMapQuotationMarks} from '../../../../r-bridge'
import { RType} from '../../../../r-bridge'
import { guard } from '../../../../util/assert'
import type {FunctionArgument} from '../../../index'
import { graphToMermaidUrl} from '../../../index'
import { DataflowGraph, dataflowLogger, EdgeType } from '../../../index'
import { linkArgumentsOnCall } from '../../linker'
import { LocalScope } from '../../../environments/scopes'
import {RShellExecutor} from '../../../../r-bridge/shell-executor'
import {executeSingleSubStep} from '../../../../core'

export const UnnamedFunctionCallPrefix = 'unnamed-function-call-'

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
		if(arg.type as RType === RType.Argument && arg.name !== undefined) {
			argEnv = define(
				{ ...processed.out[0], definedAt: arg.info.id, kind: 'argument' },
				LocalScope,
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
		scope:       data.activeScope,
		args:        callArgs // same reference
	})

	const inIds = remainingReadInArgs
	inIds.push({ nodeId: functionRootId, name: functionCallName, scope: data.activeScope, used: 'always' })

	if(!named) {
		if(functionCall.calledFunction.type === RType.FunctionDefinition) {
			linkArgumentsOnCall(callArgs, functionCall.calledFunction.parameters, finalGraph)
		}
		// push the called function to the ids:
		inIds.push(...functionName.in, ...functionName.unknownReferences)
	}

	// parse a source call and analyze the referenced code
	if(named && functionCallName == 'source') {
		const sourceFile = functionCall.arguments[0]
		if(sourceFile?.value?.type == RType.String) {
			const executor = new RShellExecutor()
			const path = removeTokenMapQuotationMarks(sourceFile.lexeme)

			// parse, normalize and dataflow the sourced file
			const parsed = executeSingleSubStep('parse', {
				request:                'file',
				content:                path,
				ensurePackageInstalled: true
			}, executor) as string
			const normalized = executeSingleSubStep('normalize', parsed, executor.getTokenMap(), undefined, fileNameDeterministicCountingIdGenerator(path)) as NormalizedAst<OtherInfo & ParentInformation>
			const dataflow = processDataflowFor(normalized.ast, { ...data, environments: finalEnv })

			// update our graph with the sourced file's information
			// TODO just set finalEnv, use overwriteEnvironments or appendEnvironments? makes no difference in the current example
			finalEnv = overwriteEnvironments(finalEnv, dataflow.environments)
			finalGraph.mergeWith(dataflow.graph)
			// TODO is this the way it should be?? just changing the data ast seems fishy
			for(const [k,v] of normalized.idMap)
				data.completeAst.idMap.set(k,v)
		}
	}

	console.log(graphToMermaidUrl(finalGraph, data.completeAst.idMap))

	return {
		unknownReferences: [],
		in:                inIds,
		out:               functionName.out, // we do not keep argument out as it has been linked by the function
		graph:             finalGraph,
		environments:      finalEnv,
		scope:             data.activeScope
	}
}

