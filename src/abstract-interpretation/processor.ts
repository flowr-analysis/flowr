import { DataflowInformation } from '../dataflow/internal/info'

export function runAbstractInterpretation(dfg: DataflowInformation): DataflowInformation {
	console.log('hi from abstract interpretation')
	return dfg
}
