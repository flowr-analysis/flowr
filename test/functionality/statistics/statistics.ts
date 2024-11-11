import { assert } from 'chai';
import type { DeepPartial } from 'ts-essentials';
import { jsonReplacer, jsonBigIntRetriever } from '../../../src/util/json';
import type { TestConfiguration } from '../_helper/shell';
import { skipTestBecauseConfigNotMet } from '../_helper/shell';
import { deepMergeObject } from '../../../src/util/objects';
import { extractUsageStatistics, staticRequests } from '../../../src/statistics/statistics';
import type { FeatureKey, FeatureValue } from '../../../src/statistics/features/feature';
import { ALL_FEATURES } from '../../../src/statistics/features/feature';
import type { RShell } from '../../../src/r-bridge/shell';
import type { AppendFnType, DummyAppendMemoryMap } from '../../../src/statistics/output/file-provider';
import { initDummyFileProvider } from '../../../src/statistics/output/statistics-file';
import { test } from 'vitest';

async function requestFeature<T extends FeatureKey>(shell: RShell, feature: T, code: string): Promise<FeatureValue<T>> {
	const results = await extractUsageStatistics(shell, () => { /* do nothing */ }, new Set([feature]), staticRequests({ request: 'text', content: code }));
	return results.features[feature] as FeatureValue<T>;
}

export async function expectFeature<T extends FeatureKey>(shell: RShell, feature: T, code: string, expected: FeatureValue<T>, map: DummyAppendMemoryMap, expectedMap: Map<AppendFnType, string[]> | undefined): Promise<void> {
	const result = await requestFeature(shell, feature, code);
	assert.deepStrictEqual(result, JSON.parse(JSON.stringify(expected, jsonReplacer), jsonBigIntRetriever), `counts, for feature ${feature} in ${code}`);
	const keys = [...map.keys()];
	assert.strictEqual(keys.length, expectedMap === undefined ? 0 : 1, 'written should contain only the given key');
	const out = map.get(keys[0]);
	assert.deepStrictEqual(out, expectedMap, `written, for feature ${feature} in ${code}. Got:\n${JSON.stringify(out, jsonReplacer)}\nExpected:\n${JSON.stringify(expectedMap, jsonReplacer)}`);
}

export interface Statistics {
	name:          string
	code:          string
	requirements?: Partial<TestConfiguration>
	expected:      DeepPartial<FeatureValue<FeatureKey>>
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
export function testForFeatureForInput<T extends FeatureKey>(shell: RShell, feature: T, tests: Statistics[]) {
	const featureInfo = ALL_FEATURES[feature];
	for(const t of tests) {
		test.skipIf(skipTestBecauseConfigNotMet(t.requirements ? {
			...t.requirements,
			needsXmlParseData: true
		} : { needsXmlParseData: true }))(t.name, async function(this: unknown) {
			// create a new feature map to record to, this resets the state as well
			const map: DummyAppendMemoryMap = new Map();
			initDummyFileProvider(map);
			const expected = deepMergeObject(featureInfo.initialValue, t.expected) as FeatureValue<T>;
			const expectedMap = t.written !== 'nothing' ? new Map(t.written.map(([fn, content]) => [fn, content.map(c => typeof c === 'string' ? c : JSON.stringify(c))])) : undefined;
			await expectFeature(shell, feature, t.code, expected, map, expectedMap);
		});
	}
}
