import type { REnvironmentInformation } from '../dataflow/environments/environment';
import type { Identifier, InGraphIdentifierDefinition } from '../dataflow/environments/identifier';
import { resolveByName } from '../dataflow/environments/resolve-by-name';
import type {
	ContainerIndex,
	ContainerIndices,
	ContainerIndicesCollection,
	IndexIdentifier,
} from '../dataflow/graph/vertex';
import { isAccessed, isParentContainerIndex } from '../dataflow/graph/vertex';
import type { RAccess } from '../r-bridge/lang-4.x/ast/model/nodes/r-access';
import type { RArgument } from '../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import type { RFunctionArgument } from '../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { EmptyArgument } from '../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { ParentInformation } from '../r-bridge/lang-4.x/ast/model/processing/decorate';
import { RoleInParent } from '../r-bridge/lang-4.x/ast/model/processing/role';
import { RType } from '../r-bridge/lang-4.x/ast/model/type';

/**
 * Returns the accessed and access argument of an access operation by filtering the operation arguments.
 */
export function getAccessOperands<OtherInfo>(
	args: readonly RFunctionArgument<OtherInfo & ParentInformation>[]
): {
	accessedArg: RArgument<OtherInfo & ParentInformation> | undefined,
	accessArg:   RArgument<OtherInfo & ParentInformation> | undefined,
} {
	const nonEmptyArgs = args.filter(arg => arg !== EmptyArgument);
	const accessedArg = nonEmptyArgs.find(arg => arg.info.role === RoleInParent.Accessed);
	const accessArg = nonEmptyArgs.find(arg => arg.info.role === RoleInParent.IndexAccess);
	return { accessedArg, accessArg };
}

/**
 * Resolves the passed name within the passed environment and returns the indicesCollection of the resolved definitions.
 *
 * @param name - Name to resolve
 * @param environment - Environment in which name is resolved
 * @returns The indicesCollection of the resolved definitions
 */
export function resolveIndicesByName(name: Identifier, environment: REnvironmentInformation) {
	const definitions = resolveByName(name, environment);
	return definitions?.flatMap(def => (def as InGraphIdentifierDefinition)?.indicesCollection ?? []);
}

/**
 * Resolves {@link accessedArg} in the {@link environment} and filters its indices according to {@link accessArg}.
 *
 * If no indices could be found that match the `accessArg`, the original indices are returned as overapproximation.
 *
 * @param accessedArg        - The argument to resolve
 * @param accessArg          - The argument which is used to filter the indices
 * @param environment        - The environment in which {@link accessedArg} is resolved
 * @param isIndexBasedAccess - Whether the access is index-based (e.g. `x[1]`) or name-based (e.g. `x$name`)
 * @returns The filtered {@link ContainerIndicesCollection} of the resolved {@link accessedArg}
 */
export function resolveSingleIndex(
	accessedArg: { lexeme: string },
	accessArg: { lexeme: string },
	environment: REnvironmentInformation,
	isIndexBasedAccess: boolean,
): ContainerIndicesCollection {
	const indicesCollection = resolveIndicesByName(accessedArg.lexeme, environment);
	const accessedIndicesCollection = filterIndices(indicesCollection, accessArg, isIndexBasedAccess);
	// If the accessed indices couldn't be resolved, overapproximate by returning the original indices.
	// This could also be the case, when nothing is acccessed, but we better be safe.
	if(accessedIndicesCollection === undefined) {
		return indicesCollection;
	} else {
		return accessedIndicesCollection;
	}
}

/**
 * Filters the single indices of the {@link indicesCollection} according to the lexeme of the {@link accessArg}.
 *
 * @param indicesCollection  - The {@link ContainerIndicesCollection} to filter
 * @param accessArg          - The argument which is used to filter {@link indicesCollection}
 * @param isIndexBasedAccess - Whether the access is index-based (e.g. `x[1]`) or name-based (e.g. `x$name`)
 * @returns The filtered copy of {@link indicesCollection}
 */
export function filterIndices(
	indicesCollection: ContainerIndicesCollection,
	accessArg: { lexeme: string },
	isIndexBasedAccess: boolean,
): ContainerIndicesCollection {
	let accessedIndicesCollection: ContainerIndicesCollection = undefined;
	for(const indices of indicesCollection ?? []) {
		const filteredIndices = indices.indices.filter(index => isAccessed(index, accessArg.lexeme, isIndexBasedAccess));

		if(filteredIndices.length === 0) {
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
 * @param accessedArg         - The top level argument that is accessed
 * @param leafIndices         - The index at the end of the nested access i.e. `c` in `a$b$c`.
 * @param constructIdentifier - A function that constructs the identifier for the index from the argument
 * @returns The constructed nested access
 */
export function constructNestedAccess<OtherInfo>(
	accessedArg: RAccess<OtherInfo & ParentInformation>,
	leafIndices: ContainerIndices,
	constructIdentifier: (arg: RArgument<OtherInfo & ParentInformation>) => IndexIdentifier,
): ContainerIndices[] {
	const accessed = accessedArg.accessed;
	const accesses = accessedArg.access.filter(arg => arg !== EmptyArgument).map(arg => arg as RArgument<OtherInfo & ParentInformation>);
	const indices: ContainerIndices[] = [];

	for(const access of accesses) {
		const newIndices: ContainerIndices = {
			indices: [
				{
					identifier: constructIdentifier(access),
					nodeId:     access.info.id,
					subIndices: [ leafIndices ],
				}
			],
			isContainer: false,
		};

		if(accessed.type === RType.Access) {
			const nestedIndices = constructNestedAccess(accessed, newIndices, constructIdentifier);
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
 * @param leafSubIndices    - Indices that are added to the leaf indices.
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
