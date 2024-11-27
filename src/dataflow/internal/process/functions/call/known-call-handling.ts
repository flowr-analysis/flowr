import type { DataflowProcessorInformation } from '../../../../processor';
import { processDataflowFor } from '../../../../processor';
import type { DataflowInformation } from '../../../../info';
import { ExitPointType } from '../../../../info';
import type { ForceArguments } from './common';
import { processAllArguments } from './common';
import type { RSymbol } from '../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { ParentInformation } from '../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { RFunctionArgument } from '../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { NodeId } from '../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { RNode } from '../../../../../r-bridge/lang-4.x/ast/model/model';
import type { IdentifierReference } from '../../../../environments/identifier';
import { ReferenceType } from '../../../../environments/identifier';
import { DataflowGraph } from '../../../../graph/graph';
import { EdgeType } from '../../../../graph/edge';
import { dataflowLogger } from '../../../../logger';
import { VertexType } from '../../../../graph/vertex';
import type { ContainerIndicesCollection } from '../../../../graph/vertex';
import { expensiveTrace } from '../../../../../util/log';

export interface ProcessKnownFunctionCallInput<OtherInfo> extends ForceArguments {
	readonly name:                  RSymbol<OtherInfo & ParentInformation>
	readonly args:                  readonly (RNode<OtherInfo & ParentInformation> | RFunctionArgument<OtherInfo & ParentInformation>)[]
	readonly rootId:                NodeId
	readonly data:                  DataflowProcessorInformation<OtherInfo & ParentInformation>
	/** should arguments be processed from right to left? This does not affect the order recorded in the call but of the environments */
	readonly reverseOrder?:         boolean
	/** which arguments are to be marked as {@link EdgeType#NonStandardEvaluation|non-standard-evaluation}? */
	readonly markAsNSE?:            readonly number[]
	/** allows passing a data processor in-between each argument */
	readonly patchData?:            (data: DataflowProcessorInformation<OtherInfo & ParentInformation>, arg: number) => DataflowProcessorInformation<OtherInfo & ParentInformation>
	/** Does the call have a side effect that we do not know a lot about which may have further consequences? */
	readonly hasUnknownSideEffect?: boolean
}

export interface ProcessKnownFunctionCallResult {
	readonly information:        DataflowInformation
	readonly processedArguments: readonly (DataflowInformation | undefined)[]
	readonly fnRef:              IdentifierReference
}

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

export function processKnownFunctionCall<OtherInfo>(
	{ name,args, rootId,data, reverseOrder = false, markAsNSE = undefined, forceArgs, patchData = d => d, hasUnknownSideEffect }: ProcessKnownFunctionCallInput<OtherInfo>, indicesCollection: ContainerIndicesCollection = undefined,
): ProcessKnownFunctionCallResult {
	const functionName = processDataflowFor(name, data);

	const finalGraph = new DataflowGraph(data.completeAst.idMap);
	const functionCallName = name.content;
	expensiveTrace(dataflowLogger, () => `Processing known function call ${functionCallName} with ${args.length} arguments`);

	const processArgs = reverseOrder ? [...args].reverse() : args;

	const isSingleIndex = indicesCollection?.every(indices => indices.isSingleIndex);
	const {
		finalEnv,
		callArgs,
		remainingReadInArgs,
		processedArguments
	} = processAllArguments<OtherInfo>({ functionName, args: processArgs, data, finalGraph, functionRootId: rootId, patchData, forceArgs }, isSingleIndex);
	if(markAsNSE) {
		markNonStandardEvaluationEdges(markAsNSE, processedArguments, finalGraph, rootId);
	}

	finalGraph.addVertex({
		tag:                 VertexType.FunctionCall,
		id:                  rootId,
		environment:         data.environment,
		name:                functionCallName,
		/* will be overwritten accordingly */
		onlyBuiltin:         false,
		controlDependencies: data.controlDependencies,
		args:                reverseOrder ? [...callArgs].reverse() : callArgs,
		indicesCollection:   indicesCollection,
	});

	if(hasUnknownSideEffect) {
		finalGraph.markIdForUnknownSideEffects(rootId);
	}

	const inIds = remainingReadInArgs;
	const fnRef: IdentifierReference = { nodeId: rootId, name: functionCallName, controlDependencies: data.controlDependencies, type: ReferenceType.Function };
	inIds.push(fnRef);

	return {
		information: {
			unknownReferences: [],
			in:                inIds,
			/* we do not keep the argument out as it has been linked by the function */
			out:               functionName.out,
			graph:             finalGraph,
			environment:       finalEnv,
			entryPoint:        rootId,
			exitPoints:        [{ nodeId: rootId, type: ExitPointType.Default, controlDependencies: data.controlDependencies }]
		},
		processedArguments: reverseOrder ? [...processedArguments].reverse() : processedArguments,
		fnRef
	};
}
