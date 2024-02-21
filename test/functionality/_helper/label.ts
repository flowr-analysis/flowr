/**
 * Labels can be used whenever a test name is expected, to wrap around the original
 * string and link it to functionality it refers to. As this is currently work in
 * progress, no automated linkage or validation is performed.
 * @module
 */


import { DefaultMap } from '../../../src/util/defaultmap'
import type { FlowrCapabilityId } from '../../../src/r-bridge/data'
import { getAllCapabilities } from '../../../src/r-bridge/data'

// map flowr ids to the capabilities
const TheGlobalLabelMap: DefaultMap<string, string[]> = new DefaultMap(() => [])

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
	// if ids appear multiple times we only want to count each one once
	const uniques = [...new Set(ids)]

	const id = uniqueTestId()
	const fullName = `#${id} ${testname} [${uniques.join(', ')}]`
	const idName = `#${id} (${testname})`

	for(const i of uniques) {
		TheGlobalLabelMap.get(i).push(idName)
	}

	return fullName
}


function printLabelSummary(): void {
	console.log('='.repeat(80))
	const allCapabilities = [...getAllCapabilities()]
	const entries = allCapabilities.map(c => [c, TheGlobalLabelMap.get(c.id)] as const)

	for(const [label, testNames] of entries) {
		const paddedLabel = `[${label.path.join('/')}] ${label.name}`
		const tests = testNames.length > 1 ? 'tests:' : 'test: '
		if(testNames.length === 0) {
			console.log(`\x1b[1;31m${paddedLabel} is not covered by any tests\x1b[0m`)
			continue
		}
		const formattedTestNames = `\x1b[36m${testNames.map(n => n.length > 25 ? n.substring(0, 25) + '…' : n).join('\x1b[m, \x1b[36m')}\x1b[m`
		console.log(`\x1b[1m${paddedLabel}\x1b[0m is covered by ${testNames.length} ${tests}\n     ${formattedTestNames}`)
	}
}

after(printLabelSummary)
process.on('exit', printLabelSummary)
