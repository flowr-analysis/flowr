import { FeatureStatisticsWithMeta } from '../../feature'
import { StatisticsSummarizerConfiguration } from '../../../../util/summarizer/statistics/summarizer'
import {
	emptySummarizedWithProject,
	recordFilePath,
	ReplaceKeysForSummary,
	SummarizedWithProject
} from '../../post-processing'
import { ExpressionListInfo } from './expression-list'
import fs from 'node:fs'
import path from 'path'
import { summarizedMeasurement2Csv, summarizedMeasurement2CsvHeader } from '../../../../util/summarizer/benchmark/data'
import { summarizeMeasurement } from '../../../../util/summarizer/benchmark/first-phase/process'

type UsedExpressionListPostProcessing = ReplaceKeysForSummary<ExpressionListInfo, SummarizedWithProject>

export function postProcess(featureRoot: string, info: Map<string, FeatureStatisticsWithMeta>, outputPath: string, config: StatisticsSummarizerConfiguration): void {
	const collected = {} as unknown as UsedExpressionListPostProcessing

	for(const [filepath, data] of info.entries()) {
		const value = data.expressionList as ExpressionListInfo
		for(const [key, val] of Object.entries(value)) {
			let get = collected[key] as SummarizedWithProject | undefined
			if(!get) {
				get = emptySummarizedWithProject()
				collected[key] = get
			}
			get.count.push(val)
			if(val > 0) {
				recordFilePath(get, filepath, config)
			}
		}
	}

	// TODO: abstract away these duplicates?
	const variablesOutStream = fs.createWriteStream(path.join(outputPath, 'used-expression-lists.csv'))
	variablesOutStream.write(`kind,unique-projects,unique-files,${summarizedMeasurement2CsvHeader()}\n`)

	for(const [key, val] of Object.entries(collected)) {
		const data = val as SummarizedWithProject
		const sum = summarizeMeasurement(data.count)
		variablesOutStream.write(`${JSON.stringify(key)},${data.uniqueProjects.size},${data.uniqueFiles.size},${summarizedMeasurement2Csv(sum)}\n`)
	}
	variablesOutStream.close()
}
