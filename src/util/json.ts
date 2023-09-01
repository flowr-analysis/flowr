// to get the types within JSON.stringify
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function jsonReplacer(key: any, value: any): any {
	if(value instanceof Map || value instanceof Set) {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-return
		return [...value]
	} else if(typeof value === 'bigint') {
		return `${value.toString()}n`
	} else {
		return value
	}
}
