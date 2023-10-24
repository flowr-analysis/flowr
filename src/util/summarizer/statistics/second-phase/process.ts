import fs from 'fs'
import path from 'path'
import {
	ALL_FEATURES,
	FeatureStatistics, FeatureStatisticsWithMeta,
	MetaStatistics
} from '../../../../statistics'
import { CommonSummarizerConfiguration } from '../../summarizer'
import { readLineByLineSync } from '../../../files'
import { guard } from '../../../assert'
import { date2string } from '../../../time'
import { StatisticsSummarizerConfiguration } from '../summarizer'

function postProcessFeatures(config: StatisticsSummarizerConfiguration, filepath: string, outputPath: string, logger: (message: string) => void, metaFeatureInformation: Map<string, FeatureStatisticsWithMeta>) {
	for(const featureName of config.featuresToUse) {
		const featureInfo = ALL_FEATURES[featureName]
		const targetPath = path.join(filepath, featureInfo.name)
		const targetFeature = path.join(outputPath, featureInfo.name)

		if(!featureInfo.postProcess) {
			logger(`    Skipping post processing of ${featureName} as no post processing behavior is defined`)
			continue
		}
		logger(`    Post processing of ${featureName}...`)

		if(!fs.existsSync(targetFeature)) {
			fs.mkdirSync(targetFeature, { recursive: true })
		}

		if(global.gc) {
			logger(`    [${date2string(new Date())}] Running garbage collection (--expose-gc)`)
			global.gc()
		}
		featureInfo.postProcess(targetPath, metaFeatureInformation, targetFeature, config)
	}
}

/**
 * Post process the collections in a given folder, retrieving the final summaries.
 *
 * @param logger       - The logger to use for outputs
 * @param filepath     - Path to the root file of the data collection (contains all the archives)
 * @param config       - Configuration of the summarizer
 * @param outputPath   - The final outputPath to write the result to (may differ from the configured root folder)
 */
export function postProcessFeatureFolder(logger: CommonSummarizerConfiguration['logger'], filepath: string, config: StatisticsSummarizerConfiguration, outputPath: string): void {
	if(!fs.existsSync(filepath)) {
		logger(`    Folder for ${filepath} does not exist, skipping post processing`)
		return
	}
	if(!fs.existsSync(outputPath)) {
		fs.mkdirSync(outputPath, { recursive: true })
	}

	const metaFeatureInformation = extractMetaInformationFrom(logger, path.join(filepath, 'meta', 'features.txt'), path.join(filepath, 'meta', 'stats.txt'))
	postProcessFeatures(config, filepath, outputPath, logger, metaFeatureInformation)
}


function extractMetaInformationFrom(logger: CommonSummarizerConfiguration['logger'], metaFeaturesPath: string, metaStatsPath: string): Map<string, FeatureStatisticsWithMeta> {
	const storage = new Map<string, FeatureStatisticsWithMeta>()
	logger(`    [${date2string(new Date())}] Collect feature statistics`)
	readLineByLineSync(metaFeaturesPath, (line, lineNumber) => {
		if(line.length === 0) {
			return
		}
		if(lineNumber % 2_500 === 0) {
			logger(`    [${date2string(new Date())}] ${lineNumber} meta feature lines processed`)
		}
		const meta = JSON.parse(line.toString()) as { file: string, content: FeatureStatistics }
		storage.set(meta.file, meta.content as FeatureStatisticsWithMeta)
	})
	logger(`    [${date2string(new Date())}] Collect meta statistics`)
	readLineByLineSync(metaStatsPath, (line, lineNumber) => {
		if(line.length === 0) {
			return
		}
		if(lineNumber % 2_500 === 0) {
			logger(`    [${date2string(new Date())}] ${lineNumber} meta statistics lines processed`)
		}
		const meta = JSON.parse(line.toString()) as { file: string, content: MetaStatistics }
		const existing = storage.get(meta.file)
		guard(existing !== undefined, () => `Expected to find meta information for ${meta.file} in line ${lineNumber+1} of ${metaFeaturesPath}`)
		existing.stats = meta.content
	})
	logger(`    [${date2string(new Date())}] Done collecting meta information`)
	return storage
}
