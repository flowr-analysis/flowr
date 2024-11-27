import type { RFunctionArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { EmptyArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { ParentInformation } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { ContainerIndex, ContainerIndices } from '../../../../../graph/vertex';
import type { DataflowInformation } from '../../../../../info';
import type { DataflowProcessorInformation } from '../../../../../processor';
import { processKnownFunctionCall } from '../known-call-handling';

/**
 * Process a list call.
 * 
 * Example:
 * ```r
 * list(a = 1, b = 2)
 * ```
 */
export function processList<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation>,
	args: readonly RFunctionArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
): DataflowInformation {
	const namedArguments: ContainerIndex[] = [];
	for(const arg of args) {
		// Skip non named arguments
		if(arg === EmptyArgument || arg.type !== 'RArgument' || arg.name === undefined) {
			continue;
		}

		const newIndex: ContainerIndex = {
			lexeme: arg.name.content,
			nodeId: arg.info.id,
		};
		namedArguments.push(newIndex);
	}

	const indices: ContainerIndices = {
		indices:       namedArguments,
		isSingleIndex: false,
	};
	return processKnownFunctionCall({ name, args, rootId, data }, [indices]).information;
}
