import { DataflowInformation } from '../dataflow/internal/info'
import { NormalizedAst } from '../r-bridge'

export function runAbstractInterpretation(ast: NormalizedAst, dfg: DataflowInformation): DataflowInformation {
	console.log('hi from abstract interpretation')
	return dfg
}
