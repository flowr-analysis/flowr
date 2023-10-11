import { jsonReplacer } from '../../util/json'
import { DataflowInformation } from '../../dataflow/internal/info'

/** Should work with larger things as well */
export async function dataflowGraphToJson(ast: DataflowInformation): Promise<string> {
	return JSON.stringify(ast, jsonReplacer)
}
