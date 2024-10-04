import { RShellExecutor } from '../../../../../../r-bridge/shell-executor'
import { type DataflowProcessorInformation, processDataflowFor } from '../../../../../processor'
import type { DataflowInformation } from '../../../../../info'
import { initializeCleanDataflowInformation } from '../../../../../info'
import { getConfig } from '../../../../../../config'
import { normalize } from '../../../../../../r-bridge/lang-4.x/ast/parser/json/parser'
import { processKnownFunctionCall } from '../known-call-handling'
import type { RParseRequestProvider, RParseRequest } from '../../../../../../r-bridge/retriever'
import { retrieveParseDataFromRCode , requestFingerprint , removeRQuotes , requestProviderFromFile } from '../../../../../../r-bridge/retriever'
import type {
	NormalizedAst,
	ParentInformation
} from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate'
import type { RFunctionArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call'
import { EmptyArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call'
import type { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol'
import type { NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id'
import { dataflowLogger } from '../../../../../logger'
import { RType } from '../../../../../../r-bridge/lang-4.x/ast/model/type'
import { overwriteEnvironment } from '../../../../../environments/overwrite'
import { expensiveTrace } from '../../../../../../util/log'

let sourceProvider = requestProviderFromFile()

export function setSourceProvider(provider: RParseRequestProvider): void {
	sourceProvider = provider
}

export function processSourceCall<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation>,
	args: readonly RFunctionArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
	config: {
		/** should this produce an explicit source function call in the graph? */
		includeFunctionCall?: boolean,
		/** should this function call be followed, even when the configuration disables it? */
		forceFollow?:         boolean
	}
): DataflowInformation {
	const information = config.includeFunctionCall ?
		processKnownFunctionCall({ name, args, rootId, data }).information
		: initializeCleanDataflowInformation(rootId, data)

	const sourceFile = args[0]

	if(!config.forceFollow && getConfig().ignoreSourceCalls) {
		expensiveTrace(dataflowLogger, () => `Skipping source call ${JSON.stringify(sourceFile)} (disabled in config file)`)
		information.graph.markIdForUnknownSideEffects(rootId)
		return information
	}

	if(sourceFile !== EmptyArgument && sourceFile?.value?.type === RType.String) {
		const path = removeRQuotes(sourceFile.lexeme)
		const request = sourceProvider.createRequest(path)

		// check if the sourced file has already been dataflow analyzed, and if so, skip it
		if(data.referenceChain.includes(requestFingerprint(request))) {
			expensiveTrace(dataflowLogger, () => `Found loop in dataflow analysis for ${JSON.stringify(request)}: ${JSON.stringify(data.referenceChain)}, skipping further dataflow analysis`)
			information.graph.markIdForUnknownSideEffects(rootId)
			return information
		}

		return sourceRequest(rootId, request, data, information)
	} else {
		expensiveTrace(dataflowLogger, () => `Non-constant argument ${JSON.stringify(sourceFile)} for source is currently not supported, skipping`)
		information.graph.markIdForUnknownSideEffects(rootId)
		return information
	}
}

function sourceRequest<OtherInfo>(rootId: NodeId, request: RParseRequest, data: DataflowProcessorInformation<OtherInfo & ParentInformation>, information: DataflowInformation): DataflowInformation {
	const executor = new RShellExecutor()

	// parse, normalize and dataflow the sourced file
	let normalized: NormalizedAst<OtherInfo & ParentInformation>
	let dataflow: DataflowInformation
	try {
		const parsed = retrieveParseDataFromRCode(request, executor)
		normalized = normalize(parsed) as NormalizedAst<OtherInfo & ParentInformation>
		dataflow = processDataflowFor(normalized.ast, {
			...data,
			currentRequest: request,
			environment:    information.environment,
			referenceChain: [...data.referenceChain, requestFingerprint(request)]
		})
	} catch(e) {
		dataflowLogger.warn(`Failed to analyze sourced file ${JSON.stringify(request)}, skipping: ${(e as Error).message}`)
		information.graph.markIdForUnknownSideEffects(rootId)
		return information
	}

	// take the entry point as well as all the written references, and give them a control dependency to the source call to show that they are conditional
	dataflow.graph.addControlDependency(dataflow.entryPoint, rootId)
	for(const out of dataflow.out) {
		dataflow.graph.addControlDependency(out.nodeId, rootId)
	}

	// update our graph with the sourced file's information
	const newInformation = { ...information }
	newInformation.environment = overwriteEnvironment(information.environment, dataflow.environment)
	newInformation.graph.mergeWith(dataflow.graph)
	// this can be improved, see issue #628
	for(const [k, v] of normalized.idMap) {
		data.completeAst.idMap.set(k, v)
	}
	return newInformation
}