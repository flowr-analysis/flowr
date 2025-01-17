import type { RFunctionArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { EmptyArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { ParentInformation } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { RType } from '../../../../../../r-bridge/lang-4.x/ast/model/type';
import type { ContainerIndices, ContainerIndex } from '../../../../../graph/vertex';
import type { DataflowInformation } from '../../../../../info';
import type { DataflowProcessorInformation } from '../../../../../processor';
import type { ProcessKnownFunctionCallResult } from '../known-call-handling';
import { processKnownFunctionCall } from '../known-call-handling';
import { getConfig } from '../../../../../../config';

interface UnresolvedArg {
	id:    NodeId,
	index: number,
}

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

	const vectorArgs: ContainerIndex[] = [];
	const unresolvedArgs: UnresolvedArg[] = [];
	for(const arg of args) {
		// Skip invalid argument types
		if(arg === EmptyArgument || arg.type !== RType.Argument) {
			continue;
		}
		
		// Skip but store non number arguments
		if(arg.value?.type !== RType.Number) {
			if(arg.value) {
				unresolvedArgs.push({
					index: arg.info.index,
					id:    arg.value.info.id
				});
			}
			continue;
		}

		const newIndex: ContainerIndex = {
			identifier: { index: arg.info.index },
			nodeId:     arg.value.info.id,
		};

		vectorArgs.push(newIndex);
	}

	const indices: ContainerIndices = {
		indices:     vectorArgs,
		isContainer: true,
	};

	const fnCall = processKnownFunctionCall({ name, args, rootId, data }, [indices]);

	flattenArgs(vectorArgs, unresolvedArgs, fnCall, rootId);

	return fnCall.information;
}

/**
 * Flattenes and merges resolved and unresolved arguments from the vector definition.
 * Example:
 * ```r
 * c(1, 2, c(1, 2))
 * // Index 1 and 2 are resolved right away, index 3 cannot
 * // Results in flattened indices [1, 2, 1, 2]
 * ```
 * 
 * @param vectorArgs - Arguments that could be resolved right away i.e. primitive args
 * @param unresolvedArgs - Arguments that couldn't be resolved e.g. nested vectors/lists
 * @returns 
 */
function flattenArgs(
	vectorArgs: ContainerIndex[],
	unresolvedArgs: UnresolvedArg[],
	fnCall: ProcessKnownFunctionCallResult,
	rootId: NodeId,
) {
	const vertex = fnCall.information.graph.getVertex(rootId);

	// When there are no unresolved arguments, the indices don't have to be constructed again
	if(!vertex || unresolvedArgs.length == 0) {
		return;
	}

	let vectorArgsIndex = 0;
	let unresolvedArgsIndex = 0;
	const newIndices: ContainerIndex[] = [];
	let newIndex = 1;
	// Stores a copy of the passed index with a new index as identifier
	function addToIndices(index: ContainerIndex) {
		newIndices.push({
			...index,
			identifier: {
				index: newIndex++,
			}
		});
	}

	// Merge indices of both lists
	// Always add the next index with the smaller index in the vector
	while(vectorArgsIndex < vectorArgs.length && unresolvedArgsIndex < unresolvedArgs.length) {
		const vectorArg = vectorArgs[vectorArgsIndex];
		const unresolvedArg = unresolvedArgs[unresolvedArgsIndex];

		if(unresolvedArg.index < (vectorArg.identifier.index ?? Number.MAX_VALUE)) {
			getVertexIndices(fnCall, unresolvedArg).map(addToIndices);
			unresolvedArgsIndex++;
		} else {
			addToIndices(vectorArg);
			vectorArgsIndex++;
		}
	}

	// Add rests lists (one of both is empty)
	for(let i = vectorArgsIndex; i < vectorArgs.length; i++) {
		addToIndices(vectorArgs[i]);
	}
	for(let i = unresolvedArgsIndex; i < unresolvedArgs.length; i++) {
		getVertexIndices(fnCall, unresolvedArgs[i]).map(addToIndices);
	}

	const resolvedIndices: ContainerIndices = {
		indices:     newIndices,
		isContainer: true,
	};
	vertex.indicesCollection = [resolvedIndices];
}

function getVertexIndices(fnCall: ProcessKnownFunctionCallResult, arg: UnresolvedArg): ContainerIndex[] {
	const argVertex = fnCall.information.graph.getVertex(arg.id);
	return argVertex?.indicesCollection?.flatMap(collection => collection.indices) ?? [];
}
