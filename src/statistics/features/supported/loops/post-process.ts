import { FeatureStatisticsWithMeta } from '../../feature'
import { StatisticsSummarizerConfiguration } from '../../../../util/summarizer/statistics/summarizer'
import { emptySummarizedWithProject, recordFilePath, SummarizedWithProject } from '../../post-processing'
import { LoopInfo } from './loops'
import { MergeableRecord } from '../../../../util/objects'
import {
	appendCommonSyntaxTypeCounter,
	CommonSyntaxTypeCounts,
	emptyCommonSyntaxTypeCounts
} from '../../common-syntax-probability'
import { bigint2number } from '../../../../util/numbers'
import path from 'path'
import fs from 'node:fs'
import { jsonReplacer } from '../../../../util/json'

type LoopInfoPostProcess = MergeableRecord & {
	[k in keyof LoopInfo]: LoopInfo[k] extends number | bigint ? SummarizedWithProject : CommonSyntaxTypeCounts<number[][]>
}

export function postProcess(featureRoot: string, info: Map<string, FeatureStatisticsWithMeta>, outputPath: string, config: StatisticsSummarizerConfiguration): void {
	const collected: LoopInfoPostProcess = {
		forLoops:               emptyCommonSyntaxTypeCounts([]),
		forLoopVar:             emptyCommonSyntaxTypeCounts([]),
		forBody:                emptyCommonSyntaxTypeCounts([]),
		whileLoops:             emptyCommonSyntaxTypeCounts([]),
		whileBody:              emptyCommonSyntaxTypeCounts([]),
		repeatLoops:            emptySummarizedWithProject(),
		repeatBody:             emptyCommonSyntaxTypeCounts([]),
		breakStatements:        emptySummarizedWithProject(),
		nextStatements:         emptySummarizedWithProject(),
		implicitLoops:          emptySummarizedWithProject(),
		nestedExplicitLoops:    emptySummarizedWithProject(),
		deepestExplicitNesting: emptySummarizedWithProject()
	}

	for(const [filepath, data] of info.entries()) {
		const value = data.loops as LoopInfo
		for(const [key, val] of Object.entries(value)) {
			if(typeof val !== 'object') {
				const get = collected[key] as SummarizedWithProject
				get.count.push(typeof val === 'number' ? Number(val) : bigint2number(val))
				if(val > 0) {
					recordFilePath(get, filepath, config)
				}
			} else {
				appendCommonSyntaxTypeCounter(collected[key] as CommonSyntaxTypeCounts<number[][]>, val)
			}
		}
	}

	// TODO: summarize!

	// TODO: write this line by line to avoid to write too much data!
	fs.writeFileSync(path.join(outputPath, 'loop.json'), JSON.stringify(collected, jsonReplacer))

}
