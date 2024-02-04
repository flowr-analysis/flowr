/**
 * Labels can be used whenever a test name is expected, to wrap around the original
 * string and link it to functionality it refers to. As this is currently work in
 * progress, no automated linkage or validation is performed.
 * @module
 */


import { DefaultMap } from '../../../src/util/defaultmap'
import { guard } from '../../../src/util/assert'

/**
 * This type allows to specify a label identifier of *up to* the given depth (+1)
 * in the form of '1', '3/2', '1/4/2', ...
 */
type NumericLabelFormat<DeepestDepth = 3, HelperArray extends number[] = []> =
	HelperArray['length'] extends DeepestDepth ? `${number}` :
		(`${number}` | `${number}/${NumericLabelFormat<DeepestDepth, [0, ...HelperArray]>}`)


const TheGlobalLabelMap: DefaultMap<NumericLabelFormat, string[]> = new DefaultMap(() => [])

const uniqueTestId = (() => {
	let id = 0
	return () => `${id++}`
})()

/**
 * Wraps a test name with a unique identifier and labels it with the given labels.
 * @param testname - the name of the test	(`it`) to be labeled
 * @param labels   - the labels to attach to the test
 */
export function label(testname: string, ...labels: NumericLabelFormat[]): string {
	// assert labels in array are unique
	guard(new Set(labels).size === labels.length, () => `Labels must be unique, but are not for ${JSON.stringify(labels)}`)

	const id = uniqueTestId()
	const fullName = `[${id}, ${labels.join(', ')}] ${testname}`
	const idName = `#${id} (${testname})`

	for(const l of labels) {
		TheGlobalLabelMap.get(l).push(idName)
	}

	return fullName
}

after(() => {
	console.log('='.repeat(80))
	// sort entries alpha-numerically
	const entries = Array.from(TheGlobalLabelMap.entries()).sort(([a], [b]) => a.localeCompare(b))
	const maxTestLength = Math.max(...entries.map(([, tests]) => tests.length.toString().length))
	const maxLabelLength = Math.max(...entries.map(([label]) => label.length))

	for(const [label, testNames] of entries) {
		const paddedLabel = label.padEnd(maxLabelLength, ' ')
		const paddedTestLength = testNames.length.toString().padStart(maxTestLength, ' ')
		const tests = testNames.length > 1 ? 'tests:' : 'test: '
		console.log(`\x1b[1m${paddedLabel}\x1b[0m is covered by ${paddedTestLength} ${tests} \x1b[36m${testNames.join('\x1b[m, \x1b[36m')}\x1b[m`)
	}
})
