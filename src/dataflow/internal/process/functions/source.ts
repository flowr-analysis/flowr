import type {RArgument, RParseRequest} from '../../../../r-bridge'
import {fileNameDeterministicCountingIdGenerator, type NormalizedAst, type ParentInformation, removeTokenMapQuotationMarks, type RFunctionCall, RType} from '../../../../r-bridge'
import {RShellExecutor} from '../../../../r-bridge/shell-executor'
import {executeSingleSubStep} from '../../../../core'
import {type DataflowProcessorInformation, processDataflowFor} from '../../../processor'
import {type DataflowScopeName, type Identifier, overwriteEnvironments, type REnvironmentInformation, resolveByName} from '../../../environments'
import type {DataflowInformation} from '../../info'

let sourceFileProvider: (path: string) => RParseRequest = path => {
	return {
		request:                'file',
		content:                path,
		ensurePackageInstalled: true
	}
}

export function setSourceFileProvider(provider: (path: string) => RParseRequest): void {
	sourceFileProvider = provider
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

		// parse, normalize and dataflow the sourced file
		const parsed = executeSingleSubStep('parse', sourceFileProvider(path), executor) as string
		const normalized = executeSingleSubStep('normalize', parsed, executor.getTokenMap(), undefined, fileNameDeterministicCountingIdGenerator(path)) as NormalizedAst<OtherInfo & ParentInformation>
		const dataflow = processDataflowFor(normalized.ast, {...data, environments: information.environments})

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