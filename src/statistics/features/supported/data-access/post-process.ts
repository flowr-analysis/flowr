import { FeatureStatisticsWithMeta } from '../../feature'
import { StatisticsSummarizerConfiguration } from '../../../../util/summarizer/statistics/summarizer'
import { SummarizedMeasurement } from '../../../../util/summarizer/benchmark/data'
import { MergeableRecord } from '../../../../util/objects'
import { CommonSyntaxTypeCounts } from '../../common-syntax-probability'
import { emptySummarizedWithProject, recordFilePath, SummarizedWithProject } from '../../post-processing'
import { DataAccessInfo } from './data-access'

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

	for(const [filepath, value] of info.entries()) {
		const dataAccess = value.dataAccess as DataAccessInfo
		addToList(data.chainedOrNestedAccess, dataAccess.chainedOrNestedAccess, filepath, config)
		addToList(data.longestChain, dataAccess.longestChain, filepath, config)
		addToList(data.deepestNesting, dataAccess.deepestNesting, filepath, config)
		addToList(data.byName, dataAccess.byName, filepath, config)
		// TODO: can we get used names etc?
		addToList(data.bySlot, dataAccess.bySlot, filepath, config)

	}
}
