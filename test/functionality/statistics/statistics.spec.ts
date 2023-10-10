import {
	ALL_FEATURES, AppendFnType,
	DummyAppendMemoryMap,
	extractUsageStatistics,
	FeatureKey,
	FeatureValue, initDummyFileProvider,
	staticRequests
} from '../../../src/statistics'
import { assert } from 'chai'
import { RShell } from '../../../src/r-bridge'
import { deepMergeObject } from '../../../src/util/objects'
import { jsonReplacer } from '../../../src/util/json'
import { ensureConfig, TestConfiguration } from '../helper/shell'

async function requestFeature<T extends FeatureKey>(shell: RShell, feature: T, code: string): Promise<FeatureValue<T>> {
	const results = await extractUsageStatistics(shell, () => { /* do nothing */ }, new Set([feature]), staticRequests({ request: 'text', content: code }))
	return results.features[feature] as FeatureValue<T>
}

async function expectFeature<T extends FeatureKey>(shell: RShell, feature: T, code: string, expected: FeatureValue<T>, map: DummyAppendMemoryMap, expectedMap: Map<AppendFnType, string[]> | undefined): Promise<void> {
	const result = await requestFeature(shell, feature, code)
	assert.deepStrictEqual(result, expected, `counts, for feature ${feature} in ${code}`)
	const keys = [...map.keys()]
	assert.strictEqual(keys.length, expectedMap === undefined ? 0 : 1, 'written should contain only the given key')
	const out = map.get(keys[0])
	assert.deepStrictEqual(out, expectedMap, `written, for feature ${feature} in ${code}. Got:\n${JSON.stringify(out, jsonReplacer)}\nExpected:\n${JSON.stringify(expectedMap, jsonReplacer)}`)
}

export interface StatisticsTest {
	name:          string
	code:          string
	requirements?: Partial<TestConfiguration>
	expected:      Partial<FeatureValue<FeatureKey>>
	/**
	 * the expected output written to file, the feature is inferred from the feature given to {@link testForFeatureForInput},
	 * set to 'nothing' if nothing should be recorded.
	 * If, for the file contents you pass objects, `JSON.stringify` will be called automatically them.
	 */
	written:       [AppendFnType, (string | object)[]][] | 'nothing'
}

/**
 * Each `tests.expected` will be merged with its corresponding initial value (so if you do not give a value, it is expected to be 0).
 */
export function testForFeatureForInput<T extends FeatureKey>(shell: RShell, feature: T, tests: StatisticsTest[]) {
	const featureInfo = ALL_FEATURES[feature]
	for(const test of tests) {
		it(test.name, async function(){
			await ensureConfig(shell, this, test.requirements)
			// create a new feature map to record to, this resets the state as well
			const map: DummyAppendMemoryMap = new Map()
			initDummyFileProvider(map)
			const expected = deepMergeObject(featureInfo.initialValue, test.expected) as FeatureValue<T>
			const expectedMap = test.written !== 'nothing' ? new Map(test.written.map(([fn, content]) => [fn, content.map(c => typeof c === 'string' ? c : JSON.stringify(c))])) : undefined
			await expectFeature(shell, feature, test.code, expected, map, expectedMap)
		})
	}
}

describe('Statistics', () => {
	require('./features/control-flow.ts')
	require('./features/used-functions.ts')
	require('./features/loops.ts')
	require('./features/data-access.ts')
	require('./features/defined-functions.ts')
})
