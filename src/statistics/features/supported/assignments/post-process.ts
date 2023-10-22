import { FeatureStatisticsWithMeta } from '../../feature'
import { StatisticsSummarizerConfiguration } from '../../../../util/summarizer/statistics/summarizer'
import { MergeableRecord } from '../../../../util/objects'
import {
	appendCommonSyntaxTypeCounter,
	CommonSyntaxTypeCounts,
	emptyCommonSyntaxTypeCounts, summarizeCommonSyntaxTypeCounter
} from '../../common-syntax-probability'
import { AssignmentInfo } from './assignments'
import { bigint2number } from '../../../../util/numbers'
import fs from 'node:fs'
import path from 'path'
import { summarizedMeasurement2Csv, summarizedMeasurement2CsvHeader } from '../../../../util/summarizer/benchmark/data'
import { summarizeMeasurement } from '../../../../util/summarizer/benchmark/first-phase/process'

interface OperatorInformation<Measurement, Uniques> {
	uniqueProjects: Uniques
	uniqueFiles:    Uniques
	counts:         Measurement
}
interface SummarizedAssignmentInfo<Measurement, Uniques> extends MergeableRecord {
	assignmentOperator:       Record<string, OperatorInformation<Measurement, Uniques>>
	assigned:                 CommonSyntaxTypeCounts<Measurement>
	deepestNesting:           Measurement
	nestedOperatorAssignment: Measurement
}

// TODO: unify that
function appendOperators(base: SummarizedAssignmentInfo<number[][], Set<string>>, b: Record<string, bigint>, filepath: string, config: StatisticsSummarizerConfiguration): void {
	for(const [key, val] of Object.entries(b)) {
		let get = base.assignmentOperator[key] as OperatorInformation<number[][], Set<string>> | undefined
		if(!get) {
			get = { uniqueFiles: new Set(), uniqueProjects: new Set(), counts: [] }
			base.assignmentOperator[key] = get
		}
		// TODO: remove redundant array :D
		const num = bigint2number(val)
		get.counts.push([num])
		if(num > 0) {
			get.uniqueFiles.add(filepath)
			get.uniqueProjects.add(filepath.split(path.sep)[config.projectSkip] ?? '')
		}

	}
}

export function postProcess(featureRoot: string, info: Map<string, FeatureStatisticsWithMeta>, outputPath: string, config: StatisticsSummarizerConfiguration): void {
	const collected: SummarizedAssignmentInfo<number[][], Set<string>> = {
		assignmentOperator:       {} as Record<string, OperatorInformation<number[][], Set<string>>>,
		assigned:                 emptyCommonSyntaxTypeCounts([]),
		deepestNesting:           [],
		nestedOperatorAssignment: []
	}
	for(const [filepath, data] of info.entries()) {
		const assignmentInfo = data.assignments as AssignmentInfo
		collected.deepestNesting.push([assignmentInfo.deepestNesting])
		collected.nestedOperatorAssignment.push([assignmentInfo.nestedOperatorAssignment])
		appendCommonSyntaxTypeCounter(collected.assigned, assignmentInfo.assigned)
		appendOperators(collected, assignmentInfo.assignmentOperator, filepath, config)
	}

	const fnOutStream = fs.createWriteStream(path.join(outputPath, 'assignments-assigned.csv'))
	fnOutStream.write(`assignment,uniqueProjects,uniqueFiles,${summarizedMeasurement2CsvHeader()}\n`)
	for(const [key, val] of Object.entries(collected.assignmentOperator)) {
		const { uniqueProjects, uniqueFiles, counts } = val
		const summarized = summarizedMeasurement2Csv(summarizeMeasurement(counts.flat()))
		fnOutStream.write(`${JSON.stringify(key)},${uniqueProjects.size},${uniqueFiles.size},${summarized}\n`)
	}
	fnOutStream.close()

	fs.writeFileSync(path.join(outputPath, 'assignments.json'), JSON.stringify({
		assigned:                 summarizeCommonSyntaxTypeCounter(collected.assigned),
		deepestNesting:           summarizeMeasurement(collected.deepestNesting.flat()),
		nestedOperatorAssignment: summarizeMeasurement(collected.nestedOperatorAssignment.flat()),
	}))
}
