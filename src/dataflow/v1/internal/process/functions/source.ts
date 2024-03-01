import type { IdGenerator, NoInfo, NormalizedAst, ParentInformation, RArgument, RFunctionCall, RParseRequest, RParseRequestProvider } from '../../../../../r-bridge'
import { requestFingerprint, sourcedDeterministicCountingIdGenerator, requestProviderFromFile, RType, removeTokenMapQuotationMarks, retrieveParseDataFromRCode } from '../../../../../r-bridge'
import { RShellExecutor } from '../../../../../r-bridge/shell-executor'
import { type DataflowProcessorInformation, processDataflowFor } from '../../../processor'
import type { DataflowInformation } from '../../../../common/info'
import type { Identifier } from '../../../index'
import { dataflowLogger } from '../../../index'
import type { REnvironmentInformation } from '../../../../common/environments'
import { overwriteEnvironments, resolveByName } from '../../../../common/environments'
import { getConfig } from '../../../../../config'
import { normalize } from '../../../../../r-bridge/lang-4.x/ast/parser/json/parser'

let sourceProvider = requestProviderFromFile()

export function setSourceProvider(provider: RParseRequestProvider): void {
	sourceProvider = provider
}

export function isSourceCall(name: Identifier, environments: REnvironmentInformation): boolean {
	const definitions = resolveByName(name, environments)
	if(definitions === undefined) {
		return false
	}
	// fail if there are multiple definitions because then we must treat the complete import as a maybe because it might do something different
	if(definitions.length !== 1) {
		return false
	}
	const def = definitions[0]
	return def.name == 'source' && def.kind == 'built-in-function'
}

export function processSourceCall<OtherInfo>(functionCall: RFunctionCall<OtherInfo & ParentInformation>, data: DataflowProcessorInformation<OtherInfo & ParentInformation>, information: DataflowInformation): DataflowInformation {
	const sourceFile = functionCall.arguments[0] as RArgument<ParentInformation> | undefined

	if(getConfig().ignoreSourceCalls) {
		dataflowLogger.info(`Skipping source call ${JSON.stringify(sourceFile)} (disabled in config file)`)
		return information
	}

	if(sourceFile?.value?.type == RType.String) {
		const path = removeTokenMapQuotationMarks(sourceFile.lexeme)
		const request = sourceProvider.createRequest(path)

		// check if the sourced file has already been dataflow analyzed, and if so, skip it
		if(data.referenceChain.includes(requestFingerprint(request))) {
			dataflowLogger.info(`Found loop in dataflow analysis for ${JSON.stringify(request)}: ${JSON.stringify(data.referenceChain)}, skipping further dataflow analysis`)
			return information
		}

		return sourceRequest(request, data, information, sourcedDeterministicCountingIdGenerator(path, functionCall.location))
	} else {
		dataflowLogger.info(`Non-constant argument ${JSON.stringify(sourceFile)} for source is currently not supported, skipping`)
		return information
	}
}

export function sourceRequest<OtherInfo>(request: RParseRequest, data: DataflowProcessorInformation<OtherInfo & ParentInformation>, information: DataflowInformation, getId: IdGenerator<NoInfo>): DataflowInformation {
	const executor = new RShellExecutor()

	// parse, normalize and dataflow the sourced file
	let normalized: NormalizedAst<OtherInfo & ParentInformation>
	let dataflow: DataflowInformation
	try {
		const parsed = retrieveParseDataFromRCode(request, executor) as string
		normalized = normalize(parsed, undefined, getId) as NormalizedAst<OtherInfo & ParentInformation>
		dataflow = processDataflowFor(normalized.ast, {
			...data,
			currentRequest: request,
			environments:   information.environments,
			referenceChain: [...data.referenceChain, requestFingerprint(request)]
		})
	} catch(e) {
		dataflowLogger.warn(`Failed to analyze sourced file ${JSON.stringify(request)}, skipping: ${(e as Error).message}`)
		return information
	}

	// update our graph with the sourced file's information
	const newInformation = { ...information }
	newInformation.environments = overwriteEnvironments(information.environments, dataflow.environments)
	newInformation.graph.mergeWith(dataflow.graph)
	// this can be improved, see issue #628
	for(const [k, v] of normalized.idMap) {
		data.completeAst.idMap.set(k, v)
	}
	return newInformation
}
