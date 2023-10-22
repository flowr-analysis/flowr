import { FeatureStatisticsWithMeta } from '../../feature'
import { StatisticsSummarizerConfiguration } from '../../../../util/summarizer/statistics/summarizer'
import {
	SummarizedMeasurement,
	summarizedMeasurement2Csv,
	summarizedMeasurement2CsvHeader
} from '../../../../util/summarizer/benchmark/data'
import { MergeableRecord } from '../../../../util/objects'
import { ValueInfo } from './values'
import fs from 'node:fs'
import path from 'path'
import { summarizeMeasurement } from '../../../../util/summarizer/benchmark/first-phase/process'

// TODO: group this together
interface SummarizedWithProject {
	uniqueProjects: Set<string>
	uniqueFiles:    Set<string>
	count:          number[]
}

type ValuesPostProcessing = MergeableRecord & {
	[K in keyof ValueInfo]: SummarizedWithProject
}

export function postProcess(featureRoot: string, info: Map<string, FeatureStatisticsWithMeta>, outputPath: string, config: StatisticsSummarizerConfiguration): void {
	const collected = {} as unknown as ValuesPostProcessing
	for(const [filepath, data] of info.entries()) {
		const value = data.values as ValueInfo
		for(const [key, val] of Object.entries(value)) {
			let get = collected[key] as SummarizedWithProject | undefined
			if(!get) {
				get = { count: [], uniqueFiles: new Set(), uniqueProjects: new Set() }
				collected[key] = get
			}
			get.count.push(val)
			if(val > 0) {
				// TODO: can we get magic numbers from files?
				get.uniqueFiles.add(filepath)
				get.uniqueProjects.add(filepath.split(path.sep)[config.projectSkip] ?? '')
			}
		}
	}


	const fnOutStream = fs.createWriteStream(path.join(outputPath, 'values.csv'))
	fnOutStream.write(`kind,unique-projects,unique-files,${summarizedMeasurement2CsvHeader()}\n`)

	for(const [key, val] of Object.entries(collected)) {
		const data = val as SummarizedWithProject
		const sum = summarizeMeasurement(data.count)
		fnOutStream.write(`${JSON.stringify(key)},${data.uniqueProjects.size},${data.uniqueFiles.size},${summarizedMeasurement2Csv(sum)}\n`)
	}
	fnOutStream.close()
}
