import { Feature, FeatureProcessorInput, FeatureStatisticsWithMeta } from '../feature'
import { appendStatisticsFile, StatisticsOutputFormat } from '../../output'
import { Writable } from 'ts-essentials'
import { RNodeWithParent, RType, visitAst } from '../../../r-bridge'
import { MergeableRecord } from '../../../util/objects'
import { EdgeType } from '../../../dataflow'
import {
	CommonSyntaxTypeCounts,
	emptyCommonSyntaxTypeCounts,
	updateCommonSyntaxTypeCounts
} from '../common-syntax-probability'
import { SummarizedMeasurement } from '../../../util/summarizer/benchmark/data'
import { readLineByLineSync } from '../../../util/files'
import path from 'path'
import { date2string } from '../../../util/time'
import { summarizeMeasurement } from '../../../util/summarizer/benchmark/first-phase/process'
import fs from 'node:fs'
import { jsonReplacer } from '../../../util/json'

const initialFunctionUsageInfo = {
	allFunctionCalls: 0,
	args:             {
		// only if called without arguments
		0: 0n,
		1: emptyCommonSyntaxTypeCounts()
	} as Record<number, bigint | CommonSyntaxTypeCounts>,
	/** `a(b(), c(3, d()))` has 3 (`b`, `c`, `d`) */
	nestedFunctionCalls: 0,
	deepestNesting:      0,
	unnamedCalls:        0
}

const AllCallsFileBase = 'all-calls'

export type FunctionUsageInfo = Writable<typeof initialFunctionUsageInfo>

function classifyArguments(args: (RNodeWithParent | undefined)[], existing: Record<number, bigint | CommonSyntaxTypeCounts>) {
	if(args.length === 0) {
		(existing[0] as unknown as number)++
		return
	}

	let i = 1
	for(const arg of args) {
		if(arg === undefined) {
			(existing[0] as unknown as number)++
			continue
		}

		existing[i] = updateCommonSyntaxTypeCounts((existing[i] as CommonSyntaxTypeCounts | undefined) ?? emptyCommonSyntaxTypeCounts(), arg)
		i++
	}
}

export type FunctionCallInformation = [
	/** the name of the called function, or undefined if this was an unnamed function call */
	name:                  string | undefined,
	location:              [line: number, character: number] | undefined,
	numberOfArguments:     number,
	/** whether this was called from a namespace, like `a::b()` */
	namespace:             string | undefined,
	knownDefinitionInFile: 0 | 1
]

function visitCalls(info: FunctionUsageInfo, input: FeatureProcessorInput): void {
	const calls: RNodeWithParent[] = []
	const allCalls: FunctionCallInformation[] = []

	visitAst(input.normalizedRAst.ast,
		node => {
			if(node.type !== RType.FunctionCall) {
				return
			}

			if(calls.length > 0) {
				info.nestedFunctionCalls++
				appendStatisticsFile(usedFunctions.name, 'nested-calls', [node.lexeme], input.filepath)
				info.deepestNesting = Math.max(info.deepestNesting, calls.length)
			}

			const dataflowNode = input.dataflow.graph.get(node.info.id)
			let hasCallsEdge = false
			if(dataflowNode) {
				hasCallsEdge = [...dataflowNode[1].values()].some(e => e.types.has(EdgeType.Calls))
			}

			if(node.flavor === 'unnamed') {
				info.unnamedCalls++
				appendStatisticsFile(usedFunctions.name, 'unnamed-calls', [node.lexeme], input.filepath)
				allCalls.push([
					undefined,
					[node.location.start.line, node.location.start.column],
					node.arguments.length,
					'',
					hasCallsEdge ? 1 : 0
				])
			} else {
				allCalls.push([
					node.functionName.lexeme,
					[node.location.start.line, node.location.start.column],
					node.arguments.length,
					node.functionName.namespace ?? '',
					hasCallsEdge ? 1 : 0
				])
			}

			classifyArguments(node.arguments, info.args)

			calls.push(node)
		}, node => {
			// drop again :D
			if(node.type === RType.FunctionCall) {
				calls.pop()
			}
		}
	)

	info.allFunctionCalls += allCalls.length
	appendStatisticsFile(usedFunctions.name, AllCallsFileBase, allCalls, input.filepath)
}

export const usedFunctions: Feature<FunctionUsageInfo> = {
	name:        'Used Functions',
	description: 'All functions called, split into various sub-categories',

	process(existing: FunctionUsageInfo, input: FeatureProcessorInput): FunctionUsageInfo {
		visitCalls(existing, input)
		return existing
	},

	initialValue: initialFunctionUsageInfo,
	postProcess:  postProcess
}


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

function summarizedMeasurement2Csv(a: SummarizedMeasurement): string {
	return `${a.min},${a.max},${a.median},${a.mean},${a.std},${a.total}`
}

function postProcess(featureRoot: string, info: Map<string, FeatureStatisticsWithMeta>, outputPath: string): void {
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
				appendCommonSyntaxTypeCounter(data.meta.args[Number(i)] ?? emptyCommonSyntaxTypeCounts([]), val as CommonSyntaxTypeCounts)
			}
		}
	}

	if(!fs.existsSync(outputPath)) {
		fs.mkdirSync(outputPath, { recursive: true })
	}
	const fnOutStream = fs.createWriteStream(path.join(outputPath, 'function-calls.csv'))

	const suffixes = ['min', 'max', 'median', 'mean', 'std', 'total']
	const prefixes = ['total', 'args', 'line-frac']
	const others = prefixes.flatMap(p => suffixes.map(s => `${p}-${s}`)).join(',')
	fnOutStream.write(`function,unique-files,${others}\n`)
	for(const [key, [uniqueFiles, total, args, lineFrac]] of data.functionCallsPerFile.entries()) {
		const totalSum = summarizeMeasurement(total.flat(), info.size)
		const argsSum = summarizeMeasurement(args.flat(), info.size)
		const lineFracSum = summarizeMeasurement(lineFrac.flat(), info.size)
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
		console.log(`    [${date2string(new Date())}] Processed ${lineNumber} lines`)
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
			get[3].push(stats === 1 ? 1 : (loc[0]-1) / (stats-1))
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
