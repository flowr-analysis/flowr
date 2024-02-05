/**
 * Labels can be used whenever a test name is expected, to wrap around the original
 * string and link it to functionality it refers to. As this is currently work in
 * progress, no automated linkage or validation is performed.
 * @module
 */


import { DefaultMap } from '../../../src/util/defaultmap'
import { guard } from '../../../src/util/assert'
import type { FlowrCapabilityWithPath, FlowrCapabilityId} from '../../../src/r-bridge/data'
import { getCapabilityById } from '../../../src/r-bridge/data'

const TheGlobalLabelMap: DefaultMap<FlowrCapabilityWithPath, string[]> = new DefaultMap(() => [])

const uniqueTestId = (() => {
	let id = 0
	return () => `${id++}`
})()

/**
 * Wraps a test name with a unique identifier and label it with the given ids.
 * @param testname - the name of the test	(`it`) to be labeled
 * @param ids      - the capability ids to attach to the test
 */
export function label(testname: string, ...ids: FlowrCapabilityId[]): string {
	// assert ids in array are unique
	guard(new Set(ids).size === ids.length, () => `Labels must be unique, but are not for ${JSON.stringify(ids)}`)

	const id = uniqueTestId()
	const fullName = `[${id}, ${ids.join(', ')}] ${testname}`
	const idName = `#${id} (${testname})`

	for(const l of ids) {
		const capability = getCapabilityById(l)
		TheGlobalLabelMap.get(capability).push(idName)
	}

	return fullName
}

function getSortedByPath(): [FlowrCapabilityWithPath, string[]][] {
	// sort entries by path
	return Array.from(TheGlobalLabelMap.entries()).sort(([{ path: a }], [{ path: b }]) => {
		for(let i = 0; i < Math.min(a.length, b.length); i++) {
			if(a[i] < b[i]) {
				return -1
			}
			if(a[i] > b[i]) {
				return 1
			}
		}
		return a.length - b.length
	})
}

function printLabelSummary(): void {
	console.log('='.repeat(80))
	const entries = getSortedByPath()

	for(const [label, testNames] of entries) {
		const paddedLabel = `[${label.path.join('/')}] ${label.name}`
		const tests = testNames.length > 1 ? 'tests:' : 'test: '
		console.log(`\x1b[1m${paddedLabel}\x1b[0m is covered by ${testNames.length} ${tests}\n     \x1b[36m${testNames.join('\x1b[m, \x1b[36m')}\x1b[m`)
	}
}

after(printLabelSummary)
process.on('exit', printLabelSummary)
