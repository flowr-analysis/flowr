import { FeatureStatisticsWithMeta } from '../../feature'
import { StatisticsSummarizerConfiguration } from '../../../../util/summarizer/statistics/summarizer'
import { AssignmentInfo } from './assignments'
import { MergeableRecord } from '../../../../util/objects'
import { CommonSyntaxTypeCounts } from '../../common-syntax-probability'

interface SummarizedAssignmentInfo<Measurement> extends MergeableRecord {
	assignmentOperator: Record<string, Measurement>
	assigned:           CommonSyntaxTypeCounts<Measurement>
}

export function postProcess(featureRoot: string, info: Map<string, FeatureStatisticsWithMeta>, outputPath: string, config: StatisticsSummarizerConfiguration): void {

}
