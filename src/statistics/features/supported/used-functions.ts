import { Feature, FeatureProcessorInput } from '../feature'
import { appendStatisticsFile } from '../../output'
import { Writable } from 'ts-essentials'
import { RNodeWithParent, RType, visitAst } from '../../../r-bridge'
import { MergeableRecord } from '../../../util/objects'
import { EdgeType } from '../../../dataflow'
import {
	CommonSyntaxTypeCounts,
	emptyCommonSyntaxTypeCounts,
	updateCommonSyntaxTypeCounts
} from '../common-syntax-probability'

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
	appendStatisticsFile(usedFunctions.name, 'all-calls', allCalls, input.filepath)
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


// eslint-disable-next-line no-warning-comments
// TODO: split in test, main&example and scripts
interface UsedFunctionPostProcessing extends MergeableRecord {
	// maps fn-name (including namespace) to number of arguments and their location (the number of elements in the array give the number of total call)
	// we use arrays to reduce the memory!
	// unnamed calls are all grouped into an empty name
	functionCallsPerFile:  Map<string, [arguments: number, location: [line: number, character: number]][]>
	deepestNestingPerFile: number[]
	nestingPerFile:        number[]
}

function postProcess(featureRoot: string, existing: UsedFunctionPostProcessing | undefined, _intermediateOutputPath: string): UsedFunctionPostProcessing {
	existing ??= {
		functionCallsPerFile:  new Map(),
		deepestNestingPerFile: [],
		nestingPerFile:        []
	}


	return existing
}
