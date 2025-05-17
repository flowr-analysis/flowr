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
import { isOverPointerAnalysisThreshold } from '../../../../../../config';
import { resolveIndicesByName } from '../../../../../../util/containers';

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
	const fnCall = processKnownFunctionCall({ name, args, rootId, data, origin: 'builtin:list' });

	if(!data.config.solver.pointerTracking) {
		return fnCall.information;
	}

	const listArgs: ContainerIndex[] = [];
	for(const arg of args) {
		// Skip non named arguments
		if(arg === EmptyArgument || arg.type !== RType.Argument || arg.value === undefined) {
			continue;
		}

		let newIndex: ContainerIndex;
		if(arg.name) {
			// Named argument
			newIndex = {
				identifier: {
					index:  arg.info.index,
					lexeme: arg.name.content
				},
				nodeId: arg.info.id,
			};
		} else {
			// Unnamed argument
			newIndex = {
				identifier: {
					index: arg.info.index,
				},
				nodeId: arg.value.info.id,
			};
		}

		// Check whether argument value can be resolved
		if(arg.value.type === RType.Symbol) {
			const indicesCollection = resolveIndicesByName(arg.value.lexeme, data.environment);
			if(indicesCollection) {
				newIndex = {
					...newIndex,
					subIndices: indicesCollection,
				};
			}
		} else {
			// Check whether argument is nested container
			const indicesCollection = fnCall.information.graph.getVertex(arg.value.info.id)?.indicesCollection;
			if(indicesCollection) {
				newIndex = {
					...newIndex,
					subIndices: indicesCollection,
				};
			}
		}

		listArgs.push(newIndex);
	}


	if(isOverPointerAnalysisThreshold(data.config, listArgs.length)) {
		return fnCall.information;
	}

	const indices: ContainerIndices = {
		indices:     listArgs,
		isContainer: true,
	};

	// Add resolved indices to vertex
	const vertex = fnCall.information.graph.getVertex(rootId);
	if(vertex) {
		vertex.indicesCollection = [indices];
	}

	return fnCall.information;
}
