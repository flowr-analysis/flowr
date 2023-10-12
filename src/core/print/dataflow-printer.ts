import { jsonReplacer } from '../../util/json'
import { DataflowInformation } from '../../dataflow/internal/info'

// TODO: make this better
function objectJson(df: object): string {
	const elems: [string, string][] = []

	for(const [key, value] of Object.entries(df)) {
		switch(typeof value) {
			case 'undefined':
			case 'function':
				continue
			case 'object':
				if(Array.isArray(value)) {
					elems.push([key, `[${value.map(x => JSON.stringify(x, jsonReplacer)).join(',')}]`])
				} else if(value instanceof Set) {
					elems.push([key, `[${[...value].map(x => JSON.stringify(x, jsonReplacer)).join(',')}]`])
				} else if(value instanceof Map) {
					elems.push([key, `[${[...value].map(([k, v]) => `[${JSON.stringify(k, jsonReplacer)},${JSON.stringify(v, jsonReplacer)}]`).join(',')}]`])
				} else {
					elems.push([key, objectJson(value as object)])
				}
				break
			case 'bigint':
				elems.push([key, `${value.toString()}n`])
				break
			default:
				elems.push([key, JSON.stringify(value, jsonReplacer)])
		}
	}

	return `{${elems.map(([key, value]) => `"${key}":${value}`).join(',')}}`
}

/** Should work with larger things as well */
// eslint-disable-next-line @typescript-eslint/require-await
export async function dataflowGraphToJson(df: DataflowInformation): Promise<string> {
	return objectJson(df)
}
