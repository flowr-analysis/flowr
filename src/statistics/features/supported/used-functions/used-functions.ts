import type { Feature, FeatureProcessorInput } from '../../feature';
import type { Writable } from 'ts-essentials';
import type {
	CommonSyntaxTypeCounts } from '../../common-syntax-probability';
import {
	emptyCommonSyntaxTypeCounts,
	updateCommonSyntaxTypeCounts
} from '../../common-syntax-probability';
import { postProcess } from './post-process';
import { getRangeStart } from '../../../../util/range';
import { unpackArgument } from '../../../../dataflow/internal/process/functions/call/argument/unpack-argument';
import type { RNodeWithParent } from '../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { visitAst } from '../../../../r-bridge/lang-4.x/ast/model/processing/visitor';
import { RType } from '../../../../r-bridge/lang-4.x/ast/model/type';
import { appendStatisticsFile } from '../../../output/statistics-file';
import { edgeIncludesType, EdgeType } from '../../../../dataflow/graph/edge';

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
};

export type FunctionUsageInfo = Writable<typeof initialFunctionUsageInfo>

export const AllCallsFileBase = 'all-calls';


export const usedFunctions: Feature<FunctionUsageInfo> = {
	name:        'Used Functions',
	description: 'All functions called, split into various sub-categories',

	process(existing: FunctionUsageInfo, input: FeatureProcessorInput): FunctionUsageInfo {
		visitCalls(existing, input);
		return existing;
	},

	initialValue: initialFunctionUsageInfo,
	postProcess:  postProcess
};


function classifyArguments(args: (RNodeWithParent | undefined)[], existing: Record<number, bigint | CommonSyntaxTypeCounts>) {
	if(args.length === 0) {
		(existing[0] as unknown as number)++;
		return;
	}

	let i = 1;
	for(const arg of args) {
		if(arg === undefined) {
			(existing[0] as unknown as number)++;
			continue;
		}

		existing[i] = updateCommonSyntaxTypeCounts((existing[i] as CommonSyntaxTypeCounts | undefined) ?? emptyCommonSyntaxTypeCounts(), arg);
		i++;
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
	const calls: RNodeWithParent[] = [];
	const allCalls: FunctionCallInformation[] = [];

	visitAst(input.normalizedRAst.ast,
		node => {
			if(node.type !== RType.FunctionCall) {
				return;
			}

			if(calls.length > 0) {
				info.nestedFunctionCalls++;
				appendStatisticsFile(usedFunctions.name, 'nested-calls', [node.lexeme], input.filepath);
				info.deepestNesting = Math.max(info.deepestNesting, calls.length);
			}

			const dataflowNode = input.dataflow.graph.get(node.info.id);
			let hasCallsEdge = false;
			if(dataflowNode) {
				hasCallsEdge = [...dataflowNode[1].values()].some(e => edgeIncludesType(e.types, EdgeType.Calls));
			}

			if(!node.named) {
				info.unnamedCalls++;
				appendStatisticsFile(usedFunctions.name, 'unnamed-calls', [node.lexeme], input.filepath);
				allCalls.push([
					undefined,
					getRangeStart(node.location),
					node.arguments.length,
					'',
					hasCallsEdge ? 1 : 0
				]);
			} else {
				allCalls.push([
					node.functionName.lexeme,
					getRangeStart(node.location),
					node.arguments.length,
					node.functionName.namespace ?? '',
					hasCallsEdge ? 1 : 0
				]);
			}

			classifyArguments(node.arguments.map(e => unpackArgument(e)), info.args);

			calls.push(node);
		}, node => {
			// drop again :D
			if(node.type === RType.FunctionCall) {
				calls.pop();
			}
		}
	);

	info.allFunctionCalls += allCalls.length;
	appendStatisticsFile(usedFunctions.name, AllCallsFileBase, allCalls, input.filepath);
}
