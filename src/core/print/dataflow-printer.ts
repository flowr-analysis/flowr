import { jsonReplacer } from '../../util/json'
import { DataflowInformation } from '../../dataflow/internal/info'
import { guard } from '../../util/assert'

function dfGraphReconstruct(df: object): string {
	const elems: [string, string][] = []

	for(const [key, value] of Object.entries(df)) {
		if(key === 'graph') {
			guard(typeof value === 'object', 'graph must be an object')
			elems.push([key, dfGraphReconstruct(value as object)])
		} else {
			elems.push([key, JSON.stringify(value, jsonReplacer)])
		}
	}

	return `{${elems.map(([key, value]) => `"${key}":${value}`).join(',')}}`
}

/** Should work with larger things as well */
// eslint-disable-next-line @typescript-eslint/require-await
export async function dataflowGraphToJson(df: DataflowInformation): Promise<string> {
	return dfGraphReconstruct(df)
}
