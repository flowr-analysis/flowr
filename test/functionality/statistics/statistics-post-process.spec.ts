import { ensureConfig, withShell } from '../_helper/shell';
import type { FeatureKey, FeatureValue } from '../../../src/statistics/features/feature';
import { ALL_FEATURES } from '../../../src/statistics/features/feature';
import {StatisticsTest, testForFeatureForInput} from './statistics.spec';
import { expectFeature } from './statistics.spec';
import type { RShell } from '../../../src/r-bridge/shell';
import type { DummyAppendMemoryMap } from '../../../src/statistics/output/file-provider';
import { initDummyFileProvider } from '../../../src/statistics/output/statistics-file';
import { deepMergeObject } from '../../../src/util/objects';
import {MIN_VERSION_LAMBDA} from "../../../src/r-bridge/lang-4.x/ast/model/versions";
import {postProcessFeatures} from "../../../src/statistics/summarizer/second-phase/process";

/* postProcessFeatureFolder */
export function testSummaryForFeatureForInput<T extends FeatureKey>(shell: RShell, feature: T, test: StatisticsTest) {
	const featureInfo = ALL_FEATURES[feature];
	it(test.name, async function() {
		await ensureConfig(shell, this, test.requirements ? {
			...test.requirements,
			needsPackages: ['xmlparsedata', ...(test.requirements.needsPackages ?? [])]
		} : { needsPackages: ['xmlparsedata'] });
		// create a new feature map to record to, this resets the state as well
		const map: DummyAppendMemoryMap = new Map();
		initDummyFileProvider(map);
		const expected = deepMergeObject(featureInfo.initialValue, test.expected) as FeatureValue<T>;
		const expectedMap = test.written !== 'nothing' ? new Map(test.written.map(([fn, content]) => [fn, content.map(c => typeof c === 'string' ? c : JSON.stringify(c))])) : undefined;
		await expectFeature(shell, feature, test.code, expected, map, expectedMap);
        console.log(map)
        /* TODO: summarize file output*/
/*		postProcessFeatures({
			featuresToUse: new Set([feature]),
			inputPath: 'test',
			logger: () => {},
			intermediateOutputPath: './',
			outputPath: './',
			projectSkip: 0
		}, './', './', () => {}, map)*/
	});
}


describe('Post-Processing', withShell(shell => {
    testSummaryForFeatureForInput(shell, 'definedFunctions',
		{
			name:         'the identity lambda function',
			code:         '\\(x) x',
			requirements: {
				minRVersion: MIN_VERSION_LAMBDA
			},
			expected: {
				total:       1,
				lambdasOnly: 1
			},
			written: [
				['usedParameterNames', [['x']]],
				['allLambdas', [['\\(x) x']]],
				['all-definitions', [ [{
					location:           [1,1],
					callsites:          [],
					numberOfParameters: 1,
					returns:            [
						{ location: [1,6] }
					],
					length: {
						lines:                   1,
						characters:              6,
						nonWhitespaceCharacters: 5
					}
				}]]]
			]
		}
    );
}));
