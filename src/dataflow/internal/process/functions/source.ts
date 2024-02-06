import type {RArgument, RParseRequestProvider} from '../../../../r-bridge'
import {requestProviderFromFile} from '../../../../r-bridge'
import {fileNameDeterministicCountingIdGenerator, type NormalizedAst, type ParentInformation, removeTokenMapQuotationMarks, type RFunctionCall, RType} from '../../../../r-bridge'
import {RShellExecutor} from '../../../../r-bridge/shell-executor'
import {executeSingleSubStep} from '../../../../core'
import {type DataflowProcessorInformation, processDataflowFor} from '../../../processor'
import {type DataflowScopeName, type Identifier, overwriteEnvironments, type REnvironmentInformation, resolveByName} from '../../../environments'
import type {DataflowInformation} from '../../info'
import {dataflowLogger} from '../../../index'

let sourceProvider = requestProviderFromFile()

export function setSourceProvider(provider: RParseRequestProvider): void {
	sourceProvider = provider
}

export function isSourceCall(name: Identifier, scope: DataflowScopeName, environments: REnvironmentInformation): boolean {
	if(name != 'source')
		return false
	const definitions = resolveByName(name, scope, environments)
	return definitions !== undefined && definitions.some(d => d.kind == 'built-in-function')
}

export function processSourceCall<OtherInfo>(functionCall: RFunctionCall<OtherInfo & ParentInformation>, data: DataflowProcessorInformation<OtherInfo & ParentInformation>, information: DataflowInformation): DataflowInformation {
	const sourceFile = functionCall.arguments[0] as RArgument<ParentInformation> | undefined
	if(sourceFile?.value?.type == RType.String) {
		const executor = new RShellExecutor()
		const path = removeTokenMapQuotationMarks(sourceFile.lexeme)
		const request = sourceProvider.createRequest(path)

		// check if the sourced file has already been dataflow analyzed, and if so, skip it
		const requestString = JSON.stringify(request)
		if(data.referenceChain.some(r => JSON.stringify(r) == requestString)) {
			dataflowLogger.info(`Found loop in dataflow analysis for ${requestString}: ${JSON.stringify(data.referenceChain)}, skipping further dataflow analysis`)
			return information
		}
		// we push the request into the reference chain regardless of whether it fails so that it doesn't have to re-fail later
		data.referenceChain.push(request)

		// parse, normalize and dataflow the sourced file
		let normalized: NormalizedAst<OtherInfo & ParentInformation>
		let dataflow: DataflowInformation
		try {
			const parsed = executeSingleSubStep('parse', request, executor) as string
			normalized = executeSingleSubStep('normalize', parsed, executor.getTokenMap(), undefined, fileNameDeterministicCountingIdGenerator(path)) as NormalizedAst<OtherInfo & ParentInformation>
			dataflow = processDataflowFor(normalized.ast, {...data, currentRequest: request, environments: information.environments})
		} catch(e) {
			dataflowLogger.warn(`Failed to analyze sourced file ${requestString}, skipping: ${(e as Error).message}`)
			return information
		}

		// update our graph with the sourced file's information
		const newInformation = {...information}
		newInformation.environments = overwriteEnvironments(information.environments, dataflow.environments)
		newInformation.graph.mergeWith(dataflow.graph)
		// this can be improved, see issue #628
		for(const [k, v] of normalized.idMap)
			data.completeAst.idMap.set(k, v)
		return newInformation
	}
	return information
}
