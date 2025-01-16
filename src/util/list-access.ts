import type { REnvironmentInformation } from '../dataflow/environments/environment';
import type { InGraphIdentifierDefinition } from '../dataflow/environments/identifier';
import { resolveByName } from '../dataflow/environments/resolve-by-name';
import type {
	ContainerIndex,
	ContainerIndices,
	ContainerIndicesCollection } from '../dataflow/graph/vertex';
import {
	isAccessed,
	isParentContainerIndex
} from '../dataflow/graph/vertex';
import type { RAccess } from '../r-bridge/lang-4.x/ast/model/nodes/r-access';
import type { RArgument } from '../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import { EmptyArgument } from '../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { ParentInformation } from '../r-bridge/lang-4.x/ast/model/processing/decorate';
import { RType } from '../r-bridge/lang-4.x/ast/model/type';

/**
 * Resolves {@link accessedArg} in the {@link environment} and filters its indices according to {@link accessArg}.
 *
 * @param accessedArg - The argument to resolve
 * @param accessArg - The argument which is used to filter the indices
 * @param environment - The environment in which {@link accessedArg} is resolved
 * @returns The filtered {@link ContainerIndicesCollection} of the resolved {@link accessedArg}
 */
export function resolveSingleIndex(
	accessedArg: { lexeme: string },
	accessArg: { lexeme: string },
	environment: REnvironmentInformation,
	accessIndexOfIndex: boolean,
): ContainerIndicesCollection {
	const definitions = resolveByName(accessedArg.lexeme, environment);
	const indicesCollection = definitions?.flatMap(def => (def as InGraphIdentifierDefinition)?.indicesCollection ?? []);
	const accessedIndicesCollection = filterIndices(indicesCollection, accessArg, accessIndexOfIndex);
	return accessedIndicesCollection;
}

/**
 * Filters the single indices of the {@link indicesCollection} according to the lexeme of the {@link accessArg}.
 *
 * @param indicesCollection - The {@link ContainerIndicesCollection} to filter
 * @param accessArg - The argument which is used to filter {@link indicesCollection}
 * @returns The filtered copy of {@link indicesCollection}
 */
export function filterIndices(
	indicesCollection: ContainerIndicesCollection,
	accessArg: { lexeme: string },
	accessIndexOfIndex: boolean,
): ContainerIndicesCollection {
	let accessedIndicesCollection: ContainerIndicesCollection = undefined;
	for(const indices of indicesCollection ?? []) {
		const filteredIndices = indices.indices.filter(index => isAccessed(index, accessArg.lexeme, accessIndexOfIndex));

		if(filteredIndices.length == 0) {
			continue;
		}

		accessedIndicesCollection ??= [];
		accessedIndicesCollection.push({
			indices:     filteredIndices,
			isContainer: indices.isContainer
		});
	}
	return accessedIndicesCollection;
}

/**
 * Constructs the definition of a nested access.
 *
 * Example:
 * ```r
 * person$credentials$username
 * ```
 * would result in a list with the index `credentials`, which has the subIndex `username`.
 *
 * @param accessedArg - The top level argument that is accessed
 * @param leafIndices - The index at the end of the nested access i.e. `c` in `a$b$c`.
 * @returns The constructed nested access
 */
export function constructNestedAccess<OtherInfo>(
	accessedArg: RAccess<OtherInfo & ParentInformation>,
	leafIndices: ContainerIndices,
): ContainerIndices[] {
	const accessed = accessedArg.accessed;
	const accesses = accessedArg.access.filter(arg => arg !== EmptyArgument).map(arg => arg as RArgument<OtherInfo & ParentInformation>);
	const indices: ContainerIndices[] = [];

	for(const access of accesses) {
		const newIndices: ContainerIndices = {
			indices: [
				{
					identifier: { lexeme: access.lexeme, },
					nodeId:     access.info.id,
					subIndices: [ leafIndices ],
				}
			],
			isContainer: false,
		};

		if(accessed.type === RType.Access) {
			const nestedIndices = constructNestedAccess(accessed, newIndices);
			indices.push(...nestedIndices);
		} else {
			indices.push(newIndices);
		}
	}
	return indices;
}

/**
 * Adds the passed list of {@link leafSubIndices} to the leaf (sub-)indices of {@link indicesCollection}.
 *
 * @param indicesCollection - Indices where to add the sub indices.
 * @param leafSubIndices - Indices that are added to the leaf indices.
 */
export function addSubIndicesToLeafIndices(
	indicesCollection: ContainerIndices[],
	leafSubIndices: ContainerIndices[],
) {
	const result: ContainerIndices[] = [];

	for(const indices of indicesCollection) {
		const newIndices: ContainerIndex[] = [];

		for(const index of indices.indices) {
			let newSubIndices: ContainerIndices[] = [];
			if(isParentContainerIndex(index)) {
				newSubIndices = addSubIndicesToLeafIndices(index.subIndices, leafSubIndices);
			} else {
				newSubIndices = leafSubIndices;
			}

			newIndices.push({
				...index,
				subIndices: newSubIndices,
			});
		}

		result.push({
			...indices,
			indices: newIndices,
		});
	}

	return result;
}
