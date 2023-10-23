import { FeatureStatisticsWithMeta } from '../../feature'
import { StatisticsSummarizerConfiguration } from '../../../../util/summarizer/statistics/summarizer'
import { SummarizedMeasurement } from '../../../../util/summarizer/benchmark/data'
import { MergeableRecord } from '../../../../util/objects'
import {
	appendCommonSyntaxTypeCounter,
	CommonSyntaxTypeCounts,
	emptyCommonSyntaxTypeCounts
} from '../../common-syntax-probability'
import { emptySummarizedWithProject, recordFilePath, SummarizedWithProject } from '../../post-processing'
import { DataAccessInfo } from './data-access'
import { bigint2number } from '../../../../util/numbers'

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
	const data: DataAccessMetaPostProcessing<SummarizedWithProject> = {
		singleBracket:         new Map(),
		doubleBracket:         new Map(),
		chainedOrNestedAccess: emptySummarizedWithProject(),
		longestChain:          emptySummarizedWithProject(),
		deepestNesting:        emptySummarizedWithProject(),
		byName:                emptySummarizedWithProject(),
		bySlot:                emptySummarizedWithProject()
	}
	// initialize the special 0
	data.singleBracket.set(0, emptySummarizedWithProject())
	data.doubleBracket.set(0, emptySummarizedWithProject())

	for(const [filepath, value] of info.entries()) {
		const dataAccess = value.dataAccess as DataAccessInfo
		addToList(data.chainedOrNestedAccess, dataAccess.chainedOrNestedAccess, filepath, config)
		addToList(data.longestChain, dataAccess.longestChain, filepath, config)
		addToList(data.deepestNesting, dataAccess.deepestNesting, filepath, config)
		addToList(data.byName, dataAccess.byName, filepath, config)
		// TODO: can we get used names etc?
		addToList(data.bySlot, dataAccess.bySlot, filepath, config)
		summarizeForBracket(dataAccess.singleBracket, data.singleBracket, filepath, config)
		summarizeForBracket(dataAccess.doubleBracket, data.doubleBracket, filepath, config)
	}
}
