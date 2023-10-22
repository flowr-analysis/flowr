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


type ValuesPostProcessing<Measurement=SummarizedMeasurement> = MergeableRecord & {
	[K in keyof ValueInfo]: Measurement
}

export function postProcess(featureRoot: string, info: Map<string, FeatureStatisticsWithMeta>, outputPath: string, config: StatisticsSummarizerConfiguration): void {
	const collected = {} as unknown as ValuesPostProcessing<number[]>
	for(const data of info.values()) {
		const value = data.values as ValueInfo
		for(const [key, val] of Object.entries(value)) {
			let get = collected[key] as number[] | undefined
			if(!get) {
				get = []
				collected[key] = get
			}
			get.push(val)
		}
	}


	const fnOutStream = fs.createWriteStream(path.join(outputPath, 'values.csv'))
	fnOutStream.write(`kind,${summarizedMeasurement2CsvHeader()}\n`)

	for(const [key, val] of Object.entries(collected)) {
		const sum = summarizeMeasurement(val as number[])
		fnOutStream.write(`${JSON.stringify(key)},${summarizedMeasurement2Csv(sum)}\n`)
	}
	fnOutStream.close()
}
