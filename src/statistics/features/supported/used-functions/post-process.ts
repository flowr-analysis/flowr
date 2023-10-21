import {
	SummarizedMeasurement,
	summarizedMeasurement2Csv,
	summarizedMeasurement2CsvHeader
} from '../../../../util/summarizer/benchmark/data'
import { MergeableRecord } from '../../../../util/objects'
import { CommonSyntaxTypeCounts, emptyCommonSyntaxTypeCounts } from '../../common-syntax-probability'
import { summarizeMeasurement } from '../../../../util/summarizer/benchmark/first-phase/process'
import { FeatureStatisticsWithMeta } from '../../feature'
import { readLineByLineSync } from '../../../../util/files'
import path from 'path'
import { StatisticsOutputFormat } from '../../../output'
import fs from 'node:fs'
import { jsonReplacer } from '../../../../util/json'
import { date2string } from '../../../../util/time'
import { AllCallsFileBase, FunctionCallInformation, FunctionUsageInfo } from './used-functions'

type FunctionCallSummaryInformation<Measurement, Uniques=number> = [numOfUniqueFiles: Uniques, total: Measurement, arguments: Measurement, linePercentageInFile: Measurement]
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

function bigint2number(a: bigint): number {
	// we have to remove the trailing `n`
	return Number(String(a).slice(0, -1))
}

function appendRecord(a: Record<string, number[][] | undefined>, b: Record<string, bigint>): void {
	for(const [key, val] of Object.entries(b)) {
		const get = a[key]
		// we guard with array to guard against methods like `toString` which are given in js
		if(!get || !Array.isArray(get)) {
			a[key] = [[bigint2number(val)]]
			continue
		}
		get.push([bigint2number(val)])
	}
}

function appendCommonSyntaxTypeCounter(a: CommonSyntaxTypeCounts<number[][]>, b: CommonSyntaxTypeCounts) {
	a.total.push([bigint2number(b.total)])
	a.empty.push([bigint2number(b.empty)])
	a.multiple.push([bigint2number(b.multiple)])
	a.withArgument.push([bigint2number(b.withArgument)])
	a.noValue.push([bigint2number(b.noValue)])
	a.unnamedCall.push([bigint2number(b.unnamedCall)])
	appendRecord(a.singleVar, b.singleVar)
	appendRecord(a.number, b.number)
	appendRecord(a.integer, b.integer)
	appendRecord(a.complex, b.complex)
	appendRecord(a.string, b.string)
	appendRecord(a.logical, b.logical)
	appendRecord(a.call, b.call)
	appendRecord(a.binOp, b.binOp)
	appendRecord(a.unaryOp, b.unaryOp)
	appendRecord(a.other, b.other)
}


function summarizeRecord(a: Record<string, number[][]>): Record<string, SummarizedMeasurement> {
	return Object.fromEntries(Object.entries(a).map(([key, val]) => [key, summarizeMeasurement(val.flat(), val.length)]))
}

function summarizeCommonSyntaxTypeCounter(a: CommonSyntaxTypeCounts<number[][]>): CommonSyntaxTypeCounts<SummarizedMeasurement> {
	return {
		total:        summarizeMeasurement(a.total.flat(), a.total.length),
		empty:        summarizeMeasurement(a.empty.flat(), a.empty.length),
		multiple:     summarizeMeasurement(a.multiple.flat(), a.multiple.length),
		withArgument: summarizeMeasurement(a.withArgument.flat(), a.withArgument.length),
		noValue:      summarizeMeasurement(a.noValue.flat(), a.noValue.length),
		unnamedCall:  summarizeMeasurement(a.unnamedCall.flat(), a.unnamedCall.length),
		singleVar:    summarizeRecord(a.singleVar),
		number:       summarizeRecord(a.number),
		integer:      summarizeRecord(a.integer),
		complex:      summarizeRecord(a.complex),
		string:       summarizeRecord(a.string),
		logical:      summarizeRecord(a.logical),
		call:         summarizeRecord(a.call),
		binOp:        summarizeRecord(a.binOp),
		unaryOp:      summarizeRecord(a.unaryOp),
		other:        summarizeRecord(a.other)
	}
}

/**
 * Note: the summary does not contain a 0 for each function that is _not_ called by a file. Hence, the minimum can not be 0 (division for mean etc. will still be performed on total file count)
 */
export function postProcess(featureRoot: string, info: Map<string, FeatureStatisticsWithMeta>, outputPath: string): void {
	// each number[][] contains a 'number[]' per file
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

	// we collect only `all-calls`
	readLineByLineSync(path.join(featureRoot, `${AllCallsFileBase}.txt`), (line, lineNumber) => processNextLine(data, lineNumber, info, JSON.parse(String(line)) as StatisticsOutputFormat<FunctionCallInformation[]>))

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
					get = emptyCommonSyntaxTypeCounts([])
					data.meta.args[Number(i)] = get
				}
				appendCommonSyntaxTypeCounter(get, val as CommonSyntaxTypeCounts)
			}
		}
	}

	const fnOutStream = fs.createWriteStream(path.join(outputPath, 'function-calls.csv'))

	const prefixes = ['total', 'args', 'line-frac']
	const others = prefixes.flatMap(summarizedMeasurement2CsvHeader).join(',')
	fnOutStream.write(`function,unique-files,${others}\n`)
	for(const [key, [uniqueFiles, total, args, lineFrac]] of data.functionCallsPerFile.entries()) {
		const totalSum = summarizeMeasurement(total.flat(), info.size)
		const argsSum = summarizeMeasurement(args.flat(), info.size)
		const lineFracSum = summarizeMeasurement(lineFrac.flat())
		// we write in csv style :), we escape the key in case it contains commas (with filenames)etc.
		fnOutStream.write(`${JSON.stringify(key ?? 'unknown')},${uniqueFiles.size},${summarizedMeasurement2Csv(totalSum)},${summarizedMeasurement2Csv(argsSum)},${summarizedMeasurement2Csv(lineFracSum)}\n`)
	}
	fnOutStream.close()

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

function processNextLine(data: UsedFunctionPostProcessing<number[][]>, lineNumber: number, info: Map<string, FeatureStatisticsWithMeta>, line: StatisticsOutputFormat<FunctionCallInformation[]>): void {
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
			get = [new Set(), [], [], []]
			groupedByFunctionName.set(key, get)
		}
		get[0].add(context ?? '')
		get[1].push(1)
		get[2].push(args)
		if(loc && stats) {
			// we reduce by 1 to get flat 0% if it is the first line
			const calc = stats === 1 ? 1 : (loc[0]-1) / (stats-1)
			get[3].push(calc)
		}
	}

	for(const [key, info] of groupedByFunctionName.entries()) {
		let get = data.functionCallsPerFile.get(key)
		if(!get) {
			get = [new Set(), [], [], []]
			// an amazing empty structure :D
			data.functionCallsPerFile.set(key, get)
		}
		// for total, we only need the number of elements as it will always be one :D
		for(const context of info[0]) {
			get[0].add(context)
		}
		get[1].push([info[1].length])
		get[2].push(info[2])
		get[3].push(info[3])
	}
}
