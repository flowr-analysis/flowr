import fs from 'fs'
import path from 'path'
import { ALL_FEATURES, FeatureKey, FeatureSelection } from '../../../../statistics'
import { CommonSummarizerConfiguration } from '../../summarizer'
import LineByLine from 'n-readlines'
import { processNestMeasurement } from '../../benchmark/first-phase/input'

/**
 * Post process the collections in a given folder, reducing them in a memory preserving way.
 *
 * @param logger                 - The logger to use for outputs
 * @param filepath               - Path to the root file of the data collection (contains all of zhe archives)
 * @param features               - Collection of features to post process, expects corresponding folders to exist
 * @param intermediateOutputPath - Path to the intermediate output
 *
 * @returns non-aggregated reports for each sub-key of each feature
 */
export function postProcessFeatureFolder(logger: CommonSummarizerConfiguration['logger'], filepath: string, features: FeatureSelection, intermediateOutputPath: string): Map<FeatureKey, unknown> {
	const featureOutputMap = new Map<FeatureKey, unknown>()

	if(!fs.existsSync(filepath)) {
		logger(`    Folder for ${filepath} does not exist, skipping post processing`)
		return featureOutputMap
	}

	for(const feature of features) {
		const featureInfo = ALL_FEATURES[feature]
		const targetPath = path.join(filepath, featureInfo.name)

		if(!featureInfo.postProcess) {
			logger(`    Skipping post processing of ${feature} as no post processing behavior is defined`)
			continue
		}
		else if(!fs.existsSync(targetPath)) {
			logger(`    Folder for ${feature} does not exist at ${targetPath} skipping post processing of this feature`)
			continue
		}

		// TODO:
		// featureOutputMap.set(feature, featureInfo.postProcess(targetPath, featureOutputMap.get(feature), intermediateOutputPath))
	}
	return featureOutputMap
}

function collectFeatureInfos(inputFilePath: string): void {
	// read line by line from the file, for each entry, collect the main feature infos, for maps etc., join the entries
	const reader = new LineByLine(inputFilePath)


	let line: false | Buffer

	let counter = 0
	// eslint-disable-next-line no-cond-assign
	while(line = reader.next()) {
		console.log(counter++, line.toString())
	}
}
