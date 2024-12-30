import type { REnvironmentInformation } from '../dataflow/environments/environment';
import type { InGraphIdentifierDefinition } from '../dataflow/environments/identifier';
import { resolveByName } from '../dataflow/environments/resolve-by-name';
import type { ContainerIndicesCollection } from '../dataflow/graph/vertex';

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
): ContainerIndicesCollection {
	const definitions = resolveByName(accessedArg.lexeme, environment);
	const indicesCollection = definitions?.flatMap(def => (def as InGraphIdentifierDefinition)?.indicesCollection ?? []);
	const accessedIndicesCollection = filterIndices(indicesCollection, accessArg);
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
): ContainerIndicesCollection {
	let accessedIndicesCollection: ContainerIndicesCollection = undefined;
	for(const indices of indicesCollection ?? []) {
		const filteredIndices = indices.indices.filter(index => accessArg.lexeme === index.lexeme);

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
