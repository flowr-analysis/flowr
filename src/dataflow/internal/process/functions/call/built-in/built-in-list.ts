import type { RFunctionArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { EmptyArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { ParentInformation } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { RType } from '../../../../../../r-bridge/lang-4.x/ast/model/type';
import type { InGraphIdentifierDefinition } from '../../../../../environments/identifier';
import { resolveByName } from '../../../../../environments/resolve-by-name';
import type { ContainerIndices, ContainerIndex } from '../../../../../graph/vertex';
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
		if(arg === EmptyArgument || arg.type !== RType.Argument || arg.name === undefined) {
			continue;
		}

		let newIndex: ContainerIndex = {
			lexeme: arg.name.content,
			nodeId: arg.info.id,
		};

		// Check whether argument value is non-primitve
		if(arg.value?.type === RType.Symbol) {
			const defs = resolveByName(arg.value.lexeme, data.environment);
			const indices = defs?.flatMap(index => (index as InGraphIdentifierDefinition).indicesCollection ?? []);
			if(indices) {
				newIndex = {
					...newIndex,
					subIndices: indices,
				};
			}
		}

		namedArguments.push(newIndex);
	}

	const indices: ContainerIndices = {
		indices:     namedArguments,
		isContainer: true,
	};
	return processKnownFunctionCall({ name, args, rootId, data }, [indices]).information;
}
