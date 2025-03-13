import type { RFunctionArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { EmptyArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { ParentInformation } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { RType } from '../../../../../../r-bridge/lang-4.x/ast/model/type';
import type { ContainerIndices, ContainerIndex, ContainerIndicesCollection } from '../../../../../graph/vertex';
import type { DataflowInformation } from '../../../../../info';
import type { DataflowProcessorInformation } from '../../../../../processor';
import { processKnownFunctionCall } from '../known-call-handling';
import { getConfig, isOverPointerAnalysisThreshold } from '../../../../../../config';
import { resolveIndicesByName } from '../../../../../../util/containers';

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
	const fnCall = processKnownFunctionCall({ name, args, rootId, data });

	if(!getConfig().solver.pointerTracking) {
		return fnCall.information;
	}

	const vectorArgs: ContainerIndex[] = [];
	let argIndex = 1;
	for(const arg of args) {
		// Skip invalid argument types
		if(arg === EmptyArgument || arg.type !== RType.Argument || arg.value === undefined) {
			continue;
		}

		if(isPrimitive(arg.value.type)) {
			vectorArgs.push({
				identifier: { index: argIndex++ },
				nodeId:     arg.value.info.id,
			});
		} else {
			// Check whether argument value can be resolved
			let indicesCollection: ContainerIndicesCollection;
			if(arg.value.type === RType.Symbol) {
				indicesCollection = resolveIndicesByName(arg.value.lexeme, data.environment);
			} else {
				// Check whether argument is nested container
				indicesCollection = fnCall.information.graph.getVertex(arg.value.info.id)?.indicesCollection;
			}

			const flattenedIndices = indicesCollection?.flatMap(indices => indices.indices)
				.map(index => {
					return {
						identifier: { index: argIndex++ },
						nodeId:     index.nodeId,
					};
				}) ?? [];
			vectorArgs.push(...flattenedIndices);
		}
	}

	if(isOverPointerAnalysisThreshold(vectorArgs.length)) {
		return fnCall.information;
	}

	const indices: ContainerIndices = {
		indices:     vectorArgs,
		isContainer: true,
	};

	// Add resolved indices to vertex
	const vertex = fnCall.information.graph.getVertex(rootId);
	if(vertex) {
		vertex.indicesCollection = [indices];
	}

	return fnCall.information;
}

/**
 * Checks whether the passed type is primitive i.e. number, logical or string.
 */
function isPrimitive(type: RType) {
	return type === RType.Number || type === RType.Logical || type === RType.String;
}
