import { ALL_FEATURES, extract, FeatureKey, FeatureValue, staticRequests } from '../../src/statistics'
import { assert } from 'chai'
import { RShell } from '../../src/r-bridge'
import { deepMergeObject } from '../../src/util/objects'

async function requestFeature<T extends FeatureKey>(shell: RShell, feature: T, code: string): Promise<FeatureValue<T>> {
	const results = await extract(shell, () => { /* do nothing */ }, new Set([feature]), staticRequests({ request: 'text', content: code }))
	return results.features[feature] as FeatureValue<T>
}
async function expectFeature<T extends FeatureKey>(shell: RShell, feature: T, code: string, expected: FeatureValue<T>): Promise<void> {
	const result = await requestFeature(shell, feature, code)
	assert.deepStrictEqual(result, expected, `for feature ${feature} in ${code}`)
}

/**
 * Each `tests.expected` will be merged with its corresponding initial value (so if you do not give a value, it is expected to be 0).
 */
export function testForFeatureForInput<T extends FeatureKey>(shell: RShell, feature: T, tests: { name: string, code: string, expected: Partial<FeatureValue<T>> }[]) {
	const featureInfo = ALL_FEATURES[feature]
	for (const test of tests) {
		const expected = deepMergeObject(featureInfo.initialValue(), test.expected) as FeatureValue<T>
		it(test.name, async() => {
			await expectFeature(shell, feature, test.code, expected)
		})
	}
}

describe('Statistics', () => {
	require('./features/controlflow.ts')
	require('./features/usedFunctions.ts')
})
