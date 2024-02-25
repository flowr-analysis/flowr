/**
 * Labels can be used whenever a test name is expected, to wrap around the original
 * string and link it to functionality it refers to. As this is currently work in
 * progress, no automated linkage or validation is performed.
 * @module
 */


import { DefaultMap } from '../../../src/util/defaultmap'
import type { FlowrCapabilityId } from '../../../src/r-bridge/data'
import { getAllCapabilities } from '../../../src/r-bridge/data'
import type { MergeableRecord } from '../../../src/util/objects'

// map flowr ids to the capabilities
const TheGlobalLabelMap: DefaultMap<string, string[]> = new DefaultMap(() => [])

const uniqueTestId = (() => {
	let id = 0
	return () => `${id++}`
})()


export type TestLabelContext = 'parse' | 'desugar' | 'dataflow'
export interface TestLabel extends MergeableRecord {
	readonly id:           string
	readonly name:         string
	/** even if ids appear multiple times we only want to count each one once */
	readonly capabilities: ReadonlySet<FlowrCapabilityId>
	/** this is automatically set (hihi) by functions like `assertAst` to correctly derive what part of capability we check */
	context?:              ReadonlySet<TestLabelContext>
}


/**
 * Wraps a test name with a unique identifier and label it with the given ids.
 * @param testname - the name of the test (`it`) to be labeled
 * @param ids      - the capability ids to attach to the test
 */
export function label(testname: string, ...ids: FlowrCapabilityId[]): string {
	const capabilities: Set<FlowrCapabilityId> = new Set(ids)
	const label: TestLabel = {
		id:   uniqueTestId(),
		name: testname,
		capabilities
	}

	for(const i of capabilities) {
		TheGlobalLabelMap.get(i).push(testname)
	}

	return testname
}


function limitTestNameLength(n: string) {
	return n.length > 25 ? n.substring(0, 25) + '…' : n
}

function printLabelSummary(): void {
	console.log('== Test Capability Coverage ' + '='.repeat(80))
	// only list those for which we have a support claim
	const allCapabilities = [...getAllCapabilities()]
	const entries = allCapabilities.map(c => [c, TheGlobalLabelMap.get(c.id)] as const)

	for(const [label, testNames] of entries) {
		const supportClaim = label.supported ? ` (claim: ${label.supported} supported)` : ''
		const paddedLabel = `${' '.repeat(label.path.length * 2 - 2)}[${label.path.join('/')}] ${label.name}${supportClaim}`
		const tests = testNames.length > 1 ? 'tests:' : 'test: '
		// we only have to warn if we claim to support but do not offer
		if(testNames.length === 0) {
			if(label.supported !== 'not' && label.supported !== undefined) {
				console.log(`\x1b[1;31m${paddedLabel} is not covered by any tests\x1b[0m`)
			} else {
				console.log(`${paddedLabel}`)
			}
			continue
		}
		const formattedTestNames = `\x1b[36m${testNames.map(limitTestNameLength).join('\x1b[m, \x1b[36m')}\x1b[m`
		console.log(`\x1b[1m${paddedLabel}\x1b[0m is covered by ${testNames.length} ${tests}\n     ${formattedTestNames}`)
	}
}

after(printLabelSummary)
process.on('exit', printLabelSummary)
