import type { RArgument} from '../../../../r-bridge'
import {fileNameDeterministicCountingIdGenerator, type NormalizedAst, type ParentInformation, removeTokenMapQuotationMarks, type RFunctionCall, RType} from '../../../../r-bridge'
import {RShellExecutor} from '../../../../r-bridge/shell-executor'
import {executeSingleSubStep} from '../../../../core'
import {type DataflowProcessorInformation, processDataflowFor} from '../../../processor'
import {overwriteEnvironments} from '../../../environments'
import type {DataflowInformation} from '../../info'

export function processSourceCall<OtherInfo>(functionCall: RFunctionCall<OtherInfo & ParentInformation>, data: DataflowProcessorInformation<OtherInfo & ParentInformation>, information: DataflowInformation): DataflowInformation {
	const sourceFile = functionCall.arguments[0] as RArgument<ParentInformation>
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
		const dataflow = processDataflowFor(normalized.ast, {...data, environments: information.environments})

		// update our graph with the sourced file's information
	    const newInformation = {...information}
		newInformation.environments = overwriteEnvironments(information.environments, dataflow.environments)
		newInformation.graph.mergeWith(dataflow.graph)
		// TODO is this the way it should be?? just changing the data ast seems fishy
		for(const [k, v] of normalized.idMap)
			data.completeAst.idMap.set(k, v)
		return newInformation
	}
	return information
}