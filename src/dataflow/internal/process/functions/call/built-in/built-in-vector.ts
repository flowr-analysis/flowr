import type { RFunctionArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { EmptyArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { ParentInformation } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { RType } from '../../../../../../r-bridge/lang-4.x/ast/model/type';
import type { ContainerIndices, ContainerIndex } from '../../../../../graph/vertex';
import type { DataflowInformation } from '../../../../../info';
import type { DataflowProcessorInformation } from '../../../../../processor';
import { processKnownFunctionCall } from '../known-call-handling';
import { getConfig } from '../../../../../../config';

/**
 * Process a vector call.
 *
 * Example:
 * ```r
 * c(1, 2, 3, 4)
 * ```
 */
export function processVector<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation>,
	args: readonly RFunctionArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
): DataflowInformation {
	if(!getConfig().solver.pointerTracking) {
		return processKnownFunctionCall({ name, args, rootId, data }).information;
	}

	const vectorArguments: ContainerIndex[] = [];
	for(let i = 0; i < args.length; i++) {
		const arg = args[i];
		
		// Skip invalid arguments
		if(arg === EmptyArgument || arg.type !== RType.Argument
			|| arg.name !== undefined || arg.value?.type !== RType.Number) {
			continue;
		}

		const newIndex: ContainerIndex = {
			lexeme: arg.info.index,
			nodeId: arg.info.id,
		};

		vectorArguments.push(newIndex);
	}

	const indices: ContainerIndices = {
		indices:     vectorArguments,
		isContainer: true,
	};
	return processKnownFunctionCall({ name, args, rootId, data }, [indices]).information;
}
