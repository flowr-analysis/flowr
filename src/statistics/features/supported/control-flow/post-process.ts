import { FeatureStatisticsWithMeta } from '../../feature'
import { StatisticsSummarizerConfiguration } from '../../../../util/summarizer/statistics/summarizer'
import {
	appendCommonSyntaxTypeCounter,
	CommonSyntaxTypeCounts,
	emptyCommonSyntaxTypeCounts
} from '../../common-syntax-probability'
import { MergeableRecord } from '../../../../util/objects'
import { ControlflowInfo } from './control-flow'
import { emptySummarizedWithProject, recordFilePath, SummarizedWithProject } from '../../post-processing'
import { summarizedMeasurement2Csv, summarizedMeasurement2CsvHeader } from '../../../../util/summarizer/benchmark/data'
import { summarizeMeasurement } from '../../../../util/summarizer/benchmark/first-phase/process'
import fs from 'fs'
import path from 'path'

interface ControlFlowMetaPostProcessing<Measurement> extends MergeableRecord {
	ifThen:           CommonSyntaxTypeCounts<Measurement>
	thenBody:         CommonSyntaxTypeCounts<Measurement>
	ifThenElse:       CommonSyntaxTypeCounts<Measurement>
	elseBody:         CommonSyntaxTypeCounts<Measurement>
	nestedIfThen:     SummarizedWithProject
	nestedIfThenElse: SummarizedWithProject
	deepestNesting:   SummarizedWithProject
	switchCase:       CommonSyntaxTypeCounts<Measurement>
}

export function postProcess(featureRoot: string, info: Map<string, FeatureStatisticsWithMeta>, outputPath: string, config: StatisticsSummarizerConfiguration): void {
	const collected: ControlFlowMetaPostProcessing<number[][]> = {
		ifThen:           emptyCommonSyntaxTypeCounts(() => []),
		thenBody:         emptyCommonSyntaxTypeCounts(() => []),
		ifThenElse:       emptyCommonSyntaxTypeCounts(() => []),
		elseBody:         emptyCommonSyntaxTypeCounts(() => []),
		nestedIfThen:     emptySummarizedWithProject(),
		nestedIfThenElse: emptySummarizedWithProject(),
		deepestNesting:   emptySummarizedWithProject(),
		switchCase:       emptyCommonSyntaxTypeCounts(() => [])
	}

	for(const [filepath, data] of info.entries()) {
		const value = data.controlflow as ControlflowInfo
		for(const [key, val] of Object.entries(value)) {
			if(typeof val === 'object') {
				appendCommonSyntaxTypeCounter(collected[key] as CommonSyntaxTypeCounts<number[][]>, val)
			} else {
				const get = collected[key] as SummarizedWithProject
				get.count.push(val)
				if(val > 0) {
					recordFilePath(get, filepath, config)
				}
			}
		}
	}

	const metaOut = fs.createWriteStream(path.join(outputPath, 'control-flow-meta.csv'))
	metaOut.write(`kind,unique-projects,unique-files,${summarizedMeasurement2CsvHeader()}\n`)
	for(const [key, val] of Object.entries(collected)) {
		const data = val as SummarizedWithProject | CommonSyntaxTypeCounts<number[][]>
		if('uniqueProjects' in data) {
			metaOut.write(`${JSON.stringify(key)},${data.uniqueProjects.size},${data.uniqueFiles.size},${summarizedMeasurement2Csv(summarizeMeasurement(data.count))}\n`)
		} else {
			const out = fs.createWriteStream(path.join(outputPath, `control-flow-type-${key}.csv`))
			// name is for fields like number etc. to allow to group multiple entries
			out.write(`kind,name,${summarizedMeasurement2CsvHeader()}\n`)
			for(const [name, vals] of Object.entries(data) as [string, number[][] | Record<string, number[][]>][]) {
				if(Array.isArray(vals)) {
					out.write(`${JSON.stringify(name)},"",${summarizedMeasurement2Csv(summarizeMeasurement(vals.flat()))}\n`)
				} else {
					for(const [keyName, keyValue] of Object.entries(vals)) {
						out.write(`${JSON.stringify(name)},${JSON.stringify(keyName)},${summarizedMeasurement2Csv(summarizeMeasurement(keyValue.flat()))}\n`)
					}
				}
			}
			out.close()
		}
	}
}
