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
	// each number[][] contains a 'number[]' per file
	const data: UsedFunctionPostProcessing<number[][]> = {
		functionCallsPerFile: new Map(),
		nestings:             [],
		deepestNesting:       [],
		// TODO:
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
	readLineByLineSync(path.join(featureRoot, `${AllCallsFileBase}.txt`), (line, lineNumber) => processNextLine(data, lineNumber, JSON.parse(String(line)) as StatisticsOutputFormat<FunctionCallInformation[]>))

	// TODO: deal with nestings, deepestNEsting and meta
	console.log(data.functionCallsPerFile.get('print'))

	// TODO: summarize :D
	return null as unknown as UsedFunctionPostProcessing
}

function processNextLine(data: UsedFunctionPostProcessing<number[][]>, lineNumber: number, line: StatisticsOutputFormat<FunctionCallInformation[]>): void {
	if(lineNumber % 2_500 === 0) {
		console.log(`[${date2string(new Date())}] Processed ${lineNumber} lines`)
	}
	const [hits, context] = line

	// group hits by fullname
	const groupedByFunctionName = new Map<string, FunctionCallSummaryInformation<number[]>>()
	for(const [name, loc, args, ns, known] of hits) {
		const fullname = ns && ns !== '' ? `${ns}::${name ?? ''}` : name
		const key = (fullname ?? '') + (known === 1 ? '-' + (context ?? '') : '')

		let get = groupedByFunctionName.get(key)
		if(!get) {
			get = [[], [], [[],[]]]
			groupedByFunctionName.set(key, get)
		}
		get[0].push(1)
		get[1].push(args)
		if(loc) {
			get[2][0].push(loc[0])
			get[2][1].push(loc[1])
		}
	}

	for(const [key, info] of groupedByFunctionName.entries()) {
		let get = data.functionCallsPerFile.get(key)
		if(!get) {
			get = [[], [], [[], []]]
			// an amazing empty structure :D
			data.functionCallsPerFile.set(key, get)
		}
		// for total, we only need the number of elements as it will always be one :D
		get[0].push([info[0].length])
		get[1].push(info[1])
		get[2][0].push(info[2][0])
		get[2][1].push(info[2][1])
	}
}
