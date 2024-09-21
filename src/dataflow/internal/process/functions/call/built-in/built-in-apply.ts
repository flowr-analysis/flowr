import type { DataflowProcessorInformation } from '../../../../../processor';
import type { DataflowInformation } from '../../../../../info';
import { processKnownFunctionCall } from '../known-call-handling';
import type { RFunctionArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { EmptyArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { ParentInformation } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { MergeableRecord } from '../../../../../../util/objects';
import { dataflowLogger } from '../../../../../logger';
import { RType } from '../../../../../../r-bridge/lang-4.x/ast/model/type';
import { VertexType } from '../../../../../graph/vertex';
import type { FunctionArgument } from '../../../../../graph/graph';
import { EdgeType } from '../../../../../graph/edge';

export interface BuiltInApplyConfiguration extends MergeableRecord {
	/** the 0-based index of the argument which is the actual function passed, defaults to 1 */
	readonly indexOfFunction?:        number
	/** does the argument have a name that it can be given by as well? */
	readonly nameOfFunctionArgument?: string
}

export function processApply<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation>,
	args: readonly RFunctionArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
	{ indexOfFunction = 1, nameOfFunctionArgument }: BuiltInApplyConfiguration
): DataflowInformation {
	/* as the length is one-based and the argument filter mapping is zero-based, we do not have to subtract 1 */
	const forceArgsMask = new Array(indexOfFunction).fill(false);
	forceArgsMask.push(true);
	const { information, processedArguments } = processKnownFunctionCall({
		name, args, rootId, data, forceArgs: forceArgsMask
	});

	let index = indexOfFunction;
	/* search, if one of the arguments actually contains the argument name if given in the config */
	if(nameOfFunctionArgument !== undefined) {
		const mayFn = args.findIndex(arg => arg !== EmptyArgument && arg.name && arg.name.content === nameOfFunctionArgument);
		if(mayFn >= 0) {
			index = mayFn;
		}
	}

	/* validate, that we indeed have so many arguments to fill this one :D */
	if(index >= args.length) {
		dataflowLogger.warn(`Function argument at index ${index} not found, skipping`);
		return information;
	}

	const arg = args[index];

	if(arg === EmptyArgument || arg?.value?.type !== RType.Symbol) {
		dataflowLogger.warn(`Expected symbol as argument at index ${index}, but got ${JSON.stringify(arg)} instead.`);
		return information;
	}

	const functionSymbol = arg.value;


	const allOtherArguments: FunctionArgument[] = processedArguments.filter((_, i) => i !== index).map((arg, i) => {
		const counterpart = args[i];
		if(arg && counterpart !== EmptyArgument && counterpart.name) {
			return {
				name:                counterpart.name.content,
				controlDependencies: data.controlDependencies,
				nodeId:              arg.entryPoint
			};
		} else {
			return EmptyArgument;
		}
	});

	const applyCallId = functionSymbol.info.id;

	/* identify it as a full-blown function call :) */
	information.graph.updateToFunctionCall({
		tag:                 VertexType.FunctionCall,
		id:                  applyCallId,
		name:                functionSymbol.content,
		args:                allOtherArguments,
		environment:         data.environment,
		onlyBuiltin:         false,
		controlDependencies: data.controlDependencies,
		/*
		 * the call happens after all arguments complete, however,
		 * as they are lazy the call is actually root-level for the FD edges, so we know nothing
		 */
		flowDependencies:    []
	});

	for(const arg of processedArguments) {
		if(arg) {
			information.graph.addEdge(applyCallId, arg.entryPoint, { type: EdgeType.Argument });
		}
	}

	return information;
}
