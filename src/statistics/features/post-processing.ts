import { MergeableRecord } from '../../util/objects'
import { StatisticsSummarizerConfiguration } from '../../util/summarizer/statistics/summarizer'
import path from 'path'

export interface SummarizedWithProject<Uniques=Set<string>, Count=number[]> {
	uniqueProjects: Uniques
	uniqueFiles:    Uniques
	count:          Count
}

export function emptySummarizedWithProject(): SummarizedWithProject {
	return {
		uniqueProjects: new Set(),
		uniqueFiles:    new Set(),
		count:          []
	}
}

export type ReplaceKeysForSummary<Source, Target> = MergeableRecord & {
	[K in keyof Source]: Target
}

export function recordFilePath(
	summarize: SummarizedWithProject,
	filepath: string,
	config: StatisticsSummarizerConfiguration
): void {
	summarize.uniqueFiles.add(filepath)
	summarize.uniqueProjects.add(filepath.split(path.sep)[config.projectSkip] ?? '')
}
