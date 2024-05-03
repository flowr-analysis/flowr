import type { NodeId, ParentInformation, RFunctionArgument, RSymbol } from '../../../../../r-bridge'
import type { DataflowProcessorInformation } from '../../../../processor'
import type { DataflowInformation } from '../../../../info'
import { initializeCleanDataflowInformation } from '../../../../info'
import { processKnownFunctionCall } from './known-call-handling'
import { appendEnvironment, resolveByName } from '../../../../environments'
import { VertexType } from '../../../../graph'


function mergeInformation(info: DataflowInformation | undefined, newInfo: DataflowInformation): DataflowInformation {
	if(info === undefined) {
		return newInfo
	}

	return {
		unknownReferences: [...info.unknownReferences, ...newInfo.unknownReferences],
		in:                [...info.in, ...newInfo.in],
		out:               [...info.out, ...newInfo.out],
		graph:             info.graph.mergeWith(newInfo.graph),
		environment:       appendEnvironment(info.environment, newInfo.environment),
		entryPoint:        newInfo.entryPoint,
		exitPoints:        [...info.exitPoints, ...newInfo.exitPoints],
	}
}

function processDefaultFunctionProcessor<OtherInfo>(
	information: DataflowInformation | undefined,
	name: RSymbol<OtherInfo & ParentInformation>,
	args: readonly RFunctionArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>
) {
	const call = processKnownFunctionCall({ name, args, rootId, data })
	return mergeInformation(information, call.information)
}

export function processNamedCall<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation>,
	args: readonly RFunctionArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>
): DataflowInformation {
	const resolved = resolveByName(name.content, data.environment) ?? []
	let defaultProcessor = resolved.length === 0

	let information: DataflowInformation | undefined = undefined
	let builtIn = false

	for(const resolvedFunction of resolved) {
		if(resolvedFunction.kind === 'built-in-function') {
			builtIn = true
			information = mergeInformation(information, resolvedFunction.processor(name, args, rootId, data))
		} else {
			defaultProcessor = true
		}
	}

	if(defaultProcessor) {
		information = processDefaultFunctionProcessor(information, name, args, rootId, data)
	} else if(information && builtIn) {
		// mark the function call as built in only
		const v = information.graph.getVertex(rootId)
		if(v?.tag === VertexType.FunctionCall) {
			v.onlyBuiltin = true
		}
	}

	return information ?? initializeCleanDataflowInformation(rootId, data)
}
