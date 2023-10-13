import { jsonReplacer } from '../../util/json'
import { DataflowInformation } from '../../dataflow/internal/info'

/** Should work with larger things as well */
// eslint-disable-next-line @typescript-eslint/require-await
export async function dataflowGraphToJson(ast: DataflowInformation): Promise<string> {
	return JSON.stringify(ast, jsonReplacer)
}

// TODO error
