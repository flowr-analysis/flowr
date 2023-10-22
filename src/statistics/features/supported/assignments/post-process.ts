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
import { getUniqueCombinationsOfSize } from '../../../../util/arrays'
import { guard } from '../../../../util/assert'
import { jsonReplacer } from '../../../../util/json'

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

// TODO: unify that with other code segments
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

// returns a map that for each combination of operators found (like `<-,=`) returns the number of projects and files
// that use both of them
function retrieveUsageCombinationCounts(collected: SummarizedAssignmentInfo<number[][], Set<string>>): Map<string, {uniqueProjects: number, uniqueFiles: number}> {
	const ops = Object.keys(collected.assignmentOperator)
	if(ops.length < 1) {
		return new Map()
	}
	const allCombinations = [...getUniqueCombinationsOfSize(ops, 1)]
	const store = new Map<string, { uniqueProjects: Set<string>, uniqueFiles: Set<string> }>
	for(const combs of allCombinations) {
		if(combs.length === 1) {
			// we can just copy the information
			const { uniqueProjects, uniqueFiles } = collected.assignmentOperator[combs[0]]
			store.set(combs[0], { uniqueProjects, uniqueFiles })
			continue
		}
		const existingKey = combs.slice(0, -1).join(',')
		const existing = store.get(existingKey)
		guard(existing !== undefined, `Unable to retrieve cache for ${existingKey}`)

		const newKey = combs.join(',')

		const { uniqueProjects, uniqueFiles } = collected.assignmentOperator[combs[combs.length - 1]]
		const newUniqueProjects = new Set([...existing.uniqueProjects].filter(x => uniqueProjects.has(x)))
		const newUniqueFiles = new Set([...existing.uniqueFiles].filter(x => uniqueFiles.has(x)))
		store.set(newKey, { uniqueProjects: newUniqueProjects, uniqueFiles: newUniqueFiles })
	}

	const result = new Map<string, {uniqueProjects: number, uniqueFiles: number}>()
	for(const [key, val] of store.entries()) {
		result.set(key, { uniqueProjects: val.uniqueProjects.size, uniqueFiles: val.uniqueFiles.size })
	}
	return result
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

	// now to get all projects exhausted with _only_ a given subset (e.g., all projects only using '=')
	const operators = retrieveUsageCombinationCounts(collected)
	fs.writeFileSync(path.join(outputPath, 'assignments.json'), JSON.stringify({
		assigned:                 summarizeCommonSyntaxTypeCounter(collected.assigned),
		deepestNesting:           summarizeMeasurement(collected.deepestNesting.flat()),
		nestedOperatorAssignment: summarizeMeasurement(collected.nestedOperatorAssignment.flat()),
		operators
	}, jsonReplacer))
}
