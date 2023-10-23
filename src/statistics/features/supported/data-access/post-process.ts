import { FeatureStatisticsWithMeta } from '../../feature'
import { StatisticsSummarizerConfiguration } from '../../../../util/summarizer/statistics/summarizer'
import {
	SummarizedMeasurement,
	summarizedMeasurement2Csv,
	summarizedMeasurement2CsvHeader
} from '../../../../util/summarizer/benchmark/data'
import { MergeableRecord } from '../../../../util/objects'
import {
	appendCommonSyntaxTypeCounter,
	CommonSyntaxTypeCounts,
	emptyCommonSyntaxTypeCounts
} from '../../common-syntax-probability'
import { emptySummarizedWithProject, recordFilePath, SummarizedWithProject } from '../../post-processing'
import { DataAccessInfo } from './data-access'
import { bigint2number } from '../../../../util/numbers'
import fs from 'node:fs'
import path from 'path'
import { summarizeMeasurement } from '../../../../util/summarizer/benchmark/first-phase/process'

interface DataAccessMetaPostProcessing<Measurement=SummarizedMeasurement> extends MergeableRecord {
	singleBracket:         Map<number, Measurement | CommonSyntaxTypeCounts<Measurement>>,
	doubleBracket:         Map<number, Measurement | CommonSyntaxTypeCounts<Measurement>>,
	chainedOrNestedAccess: Measurement,
	longestChain:          Measurement,
	deepestNesting:        Measurement,
	byName:                Measurement,
	bySlot:                Measurement,
}

function addToList(data: SummarizedWithProject, dataAccess: number, filepath: string, config: StatisticsSummarizerConfiguration) {
	data.count.push(dataAccess)
	if(dataAccess > 0) {
		recordFilePath(data, filepath, config)
	}
}

function summarizeForBracket(dataAccess: Record<number, bigint | CommonSyntaxTypeCounts>, data: DataAccessMetaPostProcessing<SummarizedWithProject>['singleBracket' | 'doubleBracket'], filepath: string, config: StatisticsSummarizerConfiguration) {
	for(const [key, val] of Object.entries(dataAccess) as [string, bigint | string | CommonSyntaxTypeCounts][]) {
		const numericKey = Number(key)
		const get = data.get(numericKey) ?? emptyCommonSyntaxTypeCounts(() => [])
		if(typeof val === 'bigint' || typeof val === 'string') {
			// it is for argument 0
			const sumGet = get as SummarizedWithProject
			const numericVal = bigint2number(val)
			sumGet.count.push()
			if(numericVal > 0) {
				recordFilePath(sumGet, filepath, config)
			}
		} else {
			appendCommonSyntaxTypeCounter(get as CommonSyntaxTypeCounts<number[][]>, val)
		}
		// TODO: update similar to other sets?
		data.set(numericKey, get as SummarizedWithProject)
	}
}

export function postProcess(featureRoot: string, info: Map<string, FeatureStatisticsWithMeta>, outputPath: string, config: StatisticsSummarizerConfiguration): void {
	const summarize: DataAccessMetaPostProcessing<SummarizedWithProject> = {
		singleBracket:         new Map(),
		doubleBracket:         new Map(),
		chainedOrNestedAccess: emptySummarizedWithProject(),
		longestChain:          emptySummarizedWithProject(),
		deepestNesting:        emptySummarizedWithProject(),
		byName:                emptySummarizedWithProject(),
		bySlot:                emptySummarizedWithProject()
	}
	// initialize the special 0
	summarize.singleBracket.set(0, emptySummarizedWithProject())
	summarize.doubleBracket.set(0, emptySummarizedWithProject())

	for(const [filepath, value] of info.entries()) {
		const dataAccess = value.dataAccess as DataAccessInfo
		addToList(summarize.chainedOrNestedAccess, dataAccess.chainedOrNestedAccess, filepath, config)
		addToList(summarize.longestChain, dataAccess.longestChain, filepath, config)
		addToList(summarize.deepestNesting, dataAccess.deepestNesting, filepath, config)
		addToList(summarize.byName, dataAccess.byName, filepath, config)
		// TODO: can we get used names etc?
		addToList(summarize.bySlot, dataAccess.bySlot, filepath, config)
		summarizeForBracket(dataAccess.singleBracket, summarize.singleBracket, filepath, config)
		summarizeForBracket(dataAccess.doubleBracket, summarize.doubleBracket, filepath, config)
	}

	const metaOut = fs.createWriteStream(path.join(outputPath, 'data-access-meta.csv'))
	metaOut.write(`kind,unique-projects,unique-files,${summarizedMeasurement2CsvHeader()}\n`)

	for(const [key, value] of Object.entries(summarize)) {
		const data = value as SummarizedWithProject | Map<string, SummarizedWithProject | CommonSyntaxTypeCounts<SummarizedWithProject>>
		if('uniqueProjects' in data) {
			metaOut.write(`${JSON.stringify(key)},${data.uniqueProjects.size},${data.uniqueFiles.size},${summarizedMeasurement2Csv(summarizeMeasurement(data.count))}\n`)
			continue
		}
		for(const [name, vals] of data.entries()) {
			// the 0 column
			if('uniqueProjects' in vals) {
				const out = fs.createWriteStream(path.join(outputPath, `data-access-type-${key}-${name}.csv`))
				// name is for fields like number etc. to allow to group multiple entries
				out.write(`kind,unique-projects,unique-files,${summarizedMeasurement2CsvHeader()}\n`)
				// TODO: use unique projects and unique files for all in all post processors?
				out.write(`"0",${vals.uniqueProjects.size},${vals.uniqueFiles.size},${summarizedMeasurement2Csv(summarizeMeasurement(vals.count))}\n`)
				out.close()
			} else {
				// non-0-column
				const out = fs.createWriteStream(path.join(outputPath, `data-access-type-${key}-${name}.csv`))
				// name is for fields like number etc. to allow to group multiple entries
				out.write(`kind,name,${summarizedMeasurement2CsvHeader()}\n`)
				for(const [entryName, vals] of Object.entries(data) as [string, number[][] | Record<string, number[][]>][]) {
					if(Array.isArray(vals)) {
						out.write(`${JSON.stringify(entryName)},"",${summarizedMeasurement2Csv(summarizeMeasurement(vals.flat()))}\n`)
					} else {
						for(const [keyName, keyValue] of Object.entries(vals)) {
							out.write(`${JSON.stringify(entryName)},${JSON.stringify(keyName)},${summarizedMeasurement2Csv(summarizeMeasurement(keyValue.flat()))}\n`)
						}
					}
				}
				out.close()
			}
		}
	}
	metaOut.close()
}
