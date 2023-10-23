import {
	SummarizedMeasurement,
	summarizedMeasurement2Csv,
	summarizedMeasurement2CsvHeader
} from '../../../../util/summarizer/benchmark/data'
import { MergeableRecord } from '../../../../util/objects'
import {
	appendCommonSyntaxTypeCounter,
	CommonSyntaxTypeCounts,
	emptyCommonSyntaxTypeCounts,
	summarizeCommonSyntaxTypeCounter
} from '../../common-syntax-probability'
import { summarizeMeasurement } from '../../../../util/summarizer/benchmark/first-phase/process'
import { FeatureStatisticsWithMeta } from '../../feature'
import { readLineByLineSync } from '../../../../util/files'
import path from 'path'
import { StatisticsOutputFormat } from '../../../output'
import fs from 'node:fs'
import { jsonReplacer } from '../../../../util/json'
import { date2string } from '../../../../util/time'
import { AllCallsFileBase, FunctionCallInformation, FunctionUsageInfo } from './used-functions'
import { StatisticsSummarizerConfiguration } from '../../../../util/summarizer/statistics/summarizer'
import { bigint2number } from '../../../../util/numbers'

type FunctionCallSummaryInformation<Measurement, Uniques=number> = [numOfUniqueProjects: Uniques, numOfUniqueFiles: Uniques, total: Measurement, arguments: Measurement, linePercentageInFile: Measurement]
// during the collection phase this should be a map using an array to collect
interface UsedFunctionPostProcessing<Measurement=SummarizedMeasurement> extends MergeableRecord {
	/**
	 * maps fn-name (including namespace) to number of arguments and their location (the number of elements in the array give the number of total call)
	 * we use tuples to reduce the memory!
	 * A function that is defined within the file is _always_ decorated with the filename (as second array element)!
	 */
	functionCallsPerFile: Map<string|undefined, FunctionCallSummaryInformation<Measurement, Set<string>>>
	meta: {
		averageCall:    Measurement
		emptyArgs:      Measurement
		nestedCalls:    Measurement
		deepestNesting: Measurement
		unnamedCalls:   Measurement
		// the first entry is for 1 argument, the second for the two arguments (the second,....)
		args:	          CommonSyntaxTypeCounts<Measurement>[]
	}
}

/**
 * Note: the summary does not contain a 0 for each function that is _not_ called by a file. Hence, the minimum can not be 0 (division for mean etc. will still be performed on total file count)
 */
export function postProcess(featureRoot: string, info: Map<string, FeatureStatisticsWithMeta>, outputPath: string, config: StatisticsSummarizerConfiguration): void {
	// each number[][] contains a 'number[]' per file
	const functionsPerFile = new Map<string | undefined, FunctionCallSummaryInformation<number[][], Set<string>>>()


	// we collect only `all-calls`
	readLineByLineSync(path.join(featureRoot, `${AllCallsFileBase}.txt`), (line, lineNumber) => processNextLine(functionsPerFile, lineNumber, info, JSON.parse(String(line)) as StatisticsOutputFormat<FunctionCallInformation[]>, config))

	console.log(`    [${date2string(new Date())}] Used functions process completed, start to write out function info`)

	const fnOutStream = fs.createWriteStream(path.join(outputPath, 'function-calls.csv'))

	const prefixes = ['total', 'args', 'line-frac']
	const others = prefixes.flatMap(summarizedMeasurement2CsvHeader).join(',')
	fnOutStream.write(`function,unique-projects,unique-files,${others}\n`)
	for(const [key, [uniqueProjects, uniqueFiles, total, args, lineFrac]] of functionsPerFile.entries()) {
		const totalSum = summarizeMeasurement(total.flat(), info.size)
		const argsSum = summarizeMeasurement(args.flat(), info.size)
		const lineFracSum = summarizeMeasurement(lineFrac.flat())
		// we write in csv style :), we escape the key in case it contains commas (with filenames)etc.
		fnOutStream.write(`${JSON.stringify(key ?? 'unknown')},${uniqueProjects.size},${uniqueFiles.size},${summarizedMeasurement2Csv(totalSum)},${summarizedMeasurement2Csv(argsSum)},${summarizedMeasurement2Csv(lineFracSum)}\n`)
	}
	fnOutStream.close()
	// we do no longer need the given information!
	functionsPerFile.clear()


	console.log(`    [${date2string(new Date())}] Used functions reading completed, summarizing info...`)

	const data: UsedFunctionPostProcessing<number[][]> = {
		functionCallsPerFile: new Map(),
		meta:                 {
			averageCall:    [],
			nestedCalls:    [],
			deepestNesting: [],
			emptyArgs:      [],
			unnamedCalls:   [],
			args:           []
		}
	}
	for(const meta of info.values()) {
		const us = meta.usedFunctions as FunctionUsageInfo
		data.meta.averageCall.push([us.allFunctionCalls])
		data.meta.nestedCalls.push([us.nestedFunctionCalls])
		data.meta.deepestNesting.push([us.deepestNesting])
		data.meta.emptyArgs.push([bigint2number(us.args[0] as bigint)])
		data.meta.unnamedCalls.push([us.unnamedCalls])
		for(const [i, val] of Object.entries(us.args)) {
			if(Number(i) !== 0) {
				let get = data.meta.args[Number(i)] as CommonSyntaxTypeCounts<number[][]> | undefined
				if(!get) {
					get = emptyCommonSyntaxTypeCounts(() => [])
					data.meta.args[Number(i)] = get
				}
				appendCommonSyntaxTypeCounter(get, val as CommonSyntaxTypeCounts)
			}
		}
	}
	console.log(`    [${date2string(new Date())}] Used functions metadata reading completed, summarizing and writing to file`)

	const summarizedEntries = {
		meta: {
			averageCall:    summarizeMeasurement(data.meta.averageCall.flat(), info.size),
			nestedCalls:    summarizeMeasurement(data.meta.nestedCalls.flat(), info.size),
			deepestNesting: summarizeMeasurement(data.meta.deepestNesting.flat(), info.size),
			emptyArgs:      summarizeMeasurement(data.meta.emptyArgs.flat(), info.size),
			unnamedCalls:   summarizeMeasurement(data.meta.unnamedCalls.flat(), info.size),
			args:           data.meta.args.map(summarizeCommonSyntaxTypeCounter)
		}
	}
	fs.writeFileSync(path.join(outputPath, 'function-calls.json'), JSON.stringify(summarizedEntries, jsonReplacer))
}

function processNextLine(data: Map<string | undefined, FunctionCallSummaryInformation<number[][], Set<string>>>, lineNumber: number, info: Map<string, FeatureStatisticsWithMeta>, line: StatisticsOutputFormat<FunctionCallInformation[]>, config: StatisticsSummarizerConfiguration): void {
	if(lineNumber % 2_500 === 0) {
		console.log(`    [${date2string(new Date())}] Used functions processed ${lineNumber} lines`)
	}
	const [hits, context] = line

	// group hits by fullname
	const groupedByFunctionName = new Map<string, FunctionCallSummaryInformation<number[], Set<string>>>()
	for(const [name, loc, args, ns, known] of hits) {
		const fullname = ns && ns !== '' ? `${ns}::${name ?? ''}` : name
		const key = (fullname ?? '') + (known === 1 ? '-' + (context ?? '') : '')

		const stats = info.get(context ?? '')?.stats.lines[0].length

		let get = groupedByFunctionName.get(key)
		if(!get) {
			get = [new Set(), new Set(), [], [], []]
			groupedByFunctionName.set(key, get)
		}
		// we retrieve the first component fo the path
		const projectName = context?.split(path.sep)[config.projectSkip]
		get[0].add(projectName ?? '')
		get[1].add(context ?? '')
		get[2].push(1)
		get[3].push(args)
		if(loc && stats) {
			// we reduce by 1 to get flat 0% if it is the first line
			get[4].push(stats === 1 ? 1 : (loc[0]-1) / (stats-1))
		}
	}

	for(const [key, info] of groupedByFunctionName.entries()) {
		let get = data.get(key)
		if(!get) {
			get = [new Set(), new Set(), [], [], []]
			// an amazing empty structure :D
			data.set(key, get)
		}
		// for total, we only need the number of elements as it will always be one :D
		for(const context of info[0]) {
			get[0].add(context)
		}
		for(const context of info[1]) {
			get[1].add(context)
		}
		get[2].push([info[2].length])
		get[3].push(info[3])
		get[4].push(info[4])
	}
}
