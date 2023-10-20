import { Feature, FeatureProcessorInput } from '../feature'
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
import { jsonReplacer } from '../../../util/json'
import { date2string } from '../../../util/time'

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
	location:              [line: number, character: number],
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

export const usedFunctions: Feature<FunctionUsageInfo, UsedFunctionPostProcessing> = {
	name:        'Used Functions',
	description: 'All functions called, split into various sub-categories',

	process(existing: FunctionUsageInfo, input: FeatureProcessorInput): FunctionUsageInfo {
		visitCalls(existing, input)
		return existing
	},

	initialValue: initialFunctionUsageInfo,
	postProcess:  postProcess
}


type FunctionCallSummaryInformation<Measurement> = [total: Measurement, arguments: Measurement, location: [line: Measurement, character: Measurement]]
// during the collection phase this should be a map using an array to collect
interface UsedFunctionPostProcessing<Measurement=SummarizedMeasurement> extends MergeableRecord {
	/**
	 * maps fn-name (including namespace) to number of arguments and their location (the number of elements in the array give the number of total call)
	 * we use tuples to reduce the memory!
	 * A function that is defined within the file is _always_ decorated with the filename (as second array element)!
	 */
	functionCallsPerFile: Map<string|undefined, FunctionCallSummaryInformation<Measurement>>
	nestings:             Measurement
	deepestNesting:       Measurement
	meta: {
		averageCall:    Measurement
		emptyArgs:      Measurement
		nestedCalls:    Measurement
		deepestNesting: Measurement
		unnamedCalls:   Measurement
		// the first entry is for 1 argument, the second for the two arguments (the second,....)
		args:	          CommonSyntaxTypeCounts<Measurement>[]
		// TODO: evaluate location of functions
	}
}

function postProcess(featureRoot: string, meta: string, outputPath: string): UsedFunctionPostProcessing {
	// we have to additionally collect the numbers _by_file_, hence we map file name to whatever is plausible
	// in order to only store the
	const data: UsedFunctionPostProcessing<Map<string|undefined, number[]>> = {
		functionCallsPerFile: new Map(),
		nestings:             new Map(),
		deepestNesting:       new Map(),
		// TODO:
		meta:                 {
			averageCall:    new Map(),
			nestedCalls:    new Map(),
			deepestNesting: new Map(),
			emptyArgs:      new Map(),
			unnamedCalls:   new Map(),
			args:           []
		}
	}

	// we collect only `all-calls`
	readLineByLineSync(path.join(featureRoot, `${AllCallsFileBase}.txt`), (line, lineNumber) => processNextLine(data, lineNumber, JSON.parse(String(line)) as StatisticsOutputFormat<FunctionCallInformation>))

	// TODO: deal with nestings, deepestNEsting and meta
	// console.log(data.functionCallsPerFile.get('dplyr::filter'))

	// TODO: summarize :D
	return null as unknown as UsedFunctionPostProcessing
}

function processNextLine(data: UsedFunctionPostProcessing<Map<string|undefined, number[]>>, lineNumber: number, line: StatisticsOutputFormat<FunctionCallInformation>): void {
	if(lineNumber % 500_000 === 0) {
		console.log(`[${date2string(new Date())}] Processed ${lineNumber} lines`)
	}
	const [[name, loc, args, ns, known], context] = line

	const fullname = ns && ns !== '' ? `${ns}::${name ?? ''}` : name
	const key = (fullname ?? '') + (known === 1 ? '-' + (context ?? '') : '')

	let get = data.functionCallsPerFile.get(key)
	if(!get) {
		get = [new Map(), new Map(), [new Map(), new Map()]]
		// an amazing empty structure :D
		data.functionCallsPerFile.set(key, get)
	}

	pushToSummary(get, 'total', context, 1)
	pushToSummary(get, 'args', context, args)
	pushToSummary(get, 'line', context, loc[0])
	pushToSummary(get, 'char', context, loc[1])
}

function pushToSummary(info: FunctionCallSummaryInformation<Map<string|undefined, number[]>>, type: 'total' | 'args' | 'line' | 'char', context: string | undefined, value: number) {
	let map: Map<string|undefined, number[]>
	switch(type) {
		case 'total':
			map = info[0]
			break
		case 'args':
			map = info[1]
			break
		case 'line':
			map = info[2][0]
			break
		case 'char':
			map = info[2][1]
			break
	}
	let get = map.get(context)
	if(!get) {
		get = []
		map.set(context, get)
	}
	get.push(value)
}
