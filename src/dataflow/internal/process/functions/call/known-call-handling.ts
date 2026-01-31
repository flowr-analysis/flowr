import { type DataflowProcessorInformation, processDataflowFor } from '../../../../processor';
import type { ExitPoint, DataflowInformation } from '../../../../info';
import { ExitPointType } from '../../../../info';
import { type ForceArguments, processAllArguments } from './common';
import type { RSymbol } from '../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { ParentInformation } from '../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { RFunctionArgument } from '../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { NodeId } from '../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { RNode } from '../../../../../r-bridge/lang-4.x/ast/model/model';
import { type IdentifierReference, ReferenceType } from '../../../../environments/identifier';
import type { FunctionArgument } from '../../../../graph/graph';
import { DataflowGraph } from '../../../../graph/graph';
import { EdgeType } from '../../../../graph/edge';
import { dataflowLogger } from '../../../../logger';
import { type ContainerIndicesCollection, type FunctionOriginInformation, VertexType } from '../../../../graph/vertex';
import { expensiveTrace } from '../../../../../util/log';
import { handleUnknownSideEffect } from '../../../../graph/unknown-side-effect';
import { BuiltInProcName } from '../../../../environments/built-in';

export interface ProcessKnownFunctionCallInput<OtherInfo> extends ForceArguments {
	/** The name of the function being called. */
	readonly name:                  RSymbol<OtherInfo & ParentInformation>
	/** The arguments to the function call. */
	readonly args:                  readonly (RNode<OtherInfo & ParentInformation> | RFunctionArgument<OtherInfo & ParentInformation>)[]
	/** The node ID to use for the function call vertex. */
	readonly rootId:                NodeId
	/** The dataflow processor information at the point of the function call. */
	readonly data:                  DataflowProcessorInformation<OtherInfo & ParentInformation>
	/** should arguments be processed from right to left? This does not affect the order recorded in the call but of the environments */
	readonly reverseOrder?:         boolean
	/** which arguments are to be marked as {@link EdgeType#NonStandardEvaluation|non-standard-evaluation}? */
	readonly markAsNSE?:            readonly number[]
	/** allows passing a data processor in-between each argument */
	readonly patchData?:            (data: DataflowProcessorInformation<OtherInfo & ParentInformation>, arg: number) => DataflowProcessorInformation<OtherInfo & ParentInformation>
	/** Does the call have a side effect that we do not know a lot about which may have further consequences? */
	readonly hasUnknownSideEffect?: boolean
	/** The origin to use for the function being called. */
	readonly origin:                FunctionOriginInformation | 'default'
}

/** The result of processing a known function call. */
export interface ProcessKnownFunctionCallResult {
	/** This is the overall information about the function call itself. */
	readonly information:        DataflowInformation
	/** The processed arguments in order, they are included in the information but sometimes useful separately. */
	readonly processedArguments: readonly (DataflowInformation | undefined)[]
	/** A reference to the function being called. */
	readonly fnRef:              IdentifierReference
	/**
	 * The arguments as recorded on the function call vertex.
	 * They are also part of the information via the function call vertex adde, but sometimes useful separately.
	 * For example, together with {@link pMatch} to do custom parameter matching.
	 */
	readonly callArgs:           readonly FunctionArgument[]
}

/**
 * Marks the given arguments as being involved in R's non-standard evaluation.
 */
export function markNonStandardEvaluationEdges(
	markAsNSE:  readonly number[],
	callArgs:   readonly (DataflowInformation | undefined)[],
	finalGraph: DataflowGraph,
	rootId:     NodeId
) {
	for(const nse of markAsNSE) {
		if(nse < callArgs.length) {
			const arg = callArgs[nse];
			if(arg !== undefined) {
				finalGraph.addEdge(rootId, arg.entryPoint, EdgeType.NonStandardEvaluation);
			}
		} else {
			dataflowLogger.warn(`Trying to mark argument ${nse} as non-standard-evaluation, but only ${callArgs.length} arguments are available`);
		}
	}
}

/**
 * The main processor for function calls for which we know the target but need not
 * add any specific handling.
 */
export function processKnownFunctionCall<OtherInfo>(
	{ name, args, rootId, data, reverseOrder = false, markAsNSE = undefined, forceArgs, patchData = d => d, hasUnknownSideEffect, origin }: ProcessKnownFunctionCallInput<OtherInfo>, indicesCollection: ContainerIndicesCollection = undefined,
): ProcessKnownFunctionCallResult {
	const functionName = processDataflowFor(name, data);

	const finalGraph = new DataflowGraph(data.completeAst.idMap);
	const functionCallName = name.content;
	expensiveTrace(dataflowLogger, () => `Processing known function call ${functionCallName} with ${args.length} arguments`);

	const processArgs = reverseOrder ? args.toReversed() : args;

	const {
		finalEnv,
		callArgs,
		remainingReadInArgs,
		processedArguments
	} = processAllArguments<OtherInfo>({ functionName, args: processArgs, data, finalGraph, functionRootId: rootId, patchData, forceArgs });
	if(markAsNSE) {
		markNonStandardEvaluationEdges(markAsNSE, processedArguments, finalGraph, rootId);
	}

	finalGraph.addVertex({
		tag:               VertexType.FunctionCall,
		id:                rootId,
		environment:       data.environment,
		name:              functionCallName,
		/* will be overwritten accordingly */
		onlyBuiltin:       false,
		cds:               data.cds,
		args:              reverseOrder ? callArgs.toReversed() : callArgs,
		indicesCollection: indicesCollection,
		origin:            origin === 'default' ? [BuiltInProcName.Function] : [origin]
	}, data.ctx.env.makeCleanEnv());

	if(hasUnknownSideEffect) {
		handleUnknownSideEffect(finalGraph, data.environment, rootId);
	}

	const inIds = remainingReadInArgs;
	const fnRef: IdentifierReference = { nodeId: rootId, name: functionCallName, cds: data.cds, type: ReferenceType.Function };
	inIds.push(fnRef);

	// if force args is not none, we need to collect all non-default exit points from our arguments!
	let exitPoints: ExitPoint[] | undefined = undefined;
	if(forceArgs === 'all') {
		const nonDefaults = processedArguments.flatMap(p => p ? p.exitPoints.filter(ep => ep.type !== ExitPointType.Default) : []);
		if(nonDefaults.length > 0) {
			exitPoints = nonDefaults;
		}
	} else if(forceArgs) {
		for(let i = 0; i < forceArgs.length; i++) {
			if(forceArgs[i]) {
				const p = processedArguments[i];
				if(p) {
					const nonDefaults = p.exitPoints.filter(ep => ep.type !== ExitPointType.Default);
					if(nonDefaults.length > 0) {
						exitPoints ??= [];
						exitPoints.push(...nonDefaults);
					}
				}
			}
		}
	}

	return {
		information: {
			unknownReferences: [],
			in:                inIds,
			/* we do not keep the argument out as it has been linked by the function */
			out:               functionName.out,
			graph:             finalGraph,
			environment:       finalEnv,
			entryPoint:        rootId,
			exitPoints:        exitPoints ?? [{ nodeId: rootId, type: ExitPointType.Default, cds: data.cds }],
			hooks:             functionName.hooks
		},
		callArgs,
		processedArguments: reverseOrder ? processedArguments.toReversed() : processedArguments,
		fnRef
	};
}
