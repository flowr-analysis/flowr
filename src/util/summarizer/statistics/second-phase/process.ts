import fs from 'fs'
import path from 'path'
import {
	ALL_FEATURES,
	FeatureInfo,
	FeatureKey,
	FeatureSelection,
	FeatureStatistics, FeatureStatisticsWithMeta,
	MetaStatistics
} from '../../../../statistics'
import { CommonSummarizerConfiguration } from '../../summarizer'
import { readLineByLine, readLineByLineSync } from '../../../files'
import { guard } from '../../../assert'

/**
 * Post process the collections in a given folder, reducing them in a memory preserving way.
 *
 * @param logger                 - The logger to use for outputs
 * @param filepath               - Path to the root file of the data collection (contains all of the archives)
 * @param features               - Collection of features to post process, expects corresponding folders to exist
 * @param outputPath             - The final outputPath
 *
 * @returns non-aggregated reports for each sub-key of each feature
 */
export function postProcessFeatureFolder(logger: CommonSummarizerConfiguration['logger'], filepath: string, features: FeatureSelection, outputPath: string): Map<FeatureKey, unknown> {
	const featureOutputMap = new Map<FeatureKey, unknown>()

	if(!fs.existsSync(filepath)) {
		logger(`    Folder for ${filepath} does not exist, skipping post processing`)
		return featureOutputMap
	}

	const metaFeatureInformation = extractMetaInformationFrom(logger, path.join(filepath, 'meta', 'features.txt'), path.join(filepath, 'meta', 'stats.txt'))

	for(const feature of features) {
		const featureInfo = ALL_FEATURES[feature]
		const targetPath = path.join(filepath, featureInfo.name)
		const outputPath = path.join(targetPath, featureInfo.name)

		if(!featureInfo.postProcess) {
			logger(`    Skipping post processing of ${feature} as no post processing behavior is defined`)
			continue
		}
		else if(!fs.existsSync(targetPath)) {
			logger(`    Folder for ${feature} does not exist at ${targetPath} skipping post processing of this feature`)
			continue
		}

		featureOutputMap.set(feature, featureInfo.postProcess(targetPath, metaFeatureInformation, outputPath))
	}
	return featureOutputMap
}


function extractMetaInformationFrom(logger: CommonSummarizerConfiguration['logger'], metaFeaturesPath: string, metaStatsPath: string): Map<string, FeatureStatisticsWithMeta> {
	const storage = new Map<string, FeatureStatisticsWithMeta>()
	logger('    Collect feature statistics')
	readLineByLineSync(metaFeaturesPath, (line, lineNumber) => {
		if(line.length === 0) {
			return
		}
		if(lineNumber % 2_500 === 0) {
			logger(`    ${lineNumber} lines processed`)
		}
		const meta = JSON.parse(String(line)) as { file: string, content: FeatureStatistics }
		storage.set(meta.file, meta.content as FeatureStatisticsWithMeta)
	})
	logger('    Collect meta statistics')
	readLineByLineSync(metaStatsPath, (line, lineNumber) => {
		if(line.length === 0) {
			return
		}
		if(lineNumber % 2_500 === 0) {
			logger(`    ${lineNumber} lines processed`)
		}
		const meta = JSON.parse(String(line)) as { file: string, content: MetaStatistics }
		const existing = storage.get(meta.file)
		guard(existing !== undefined, () => `Expected to find meta information for ${meta.file} in ${metaFeaturesPath}`)
		existing.stats = meta.content
	})
	logger('    Done collecting meta information')
	return storage
}
