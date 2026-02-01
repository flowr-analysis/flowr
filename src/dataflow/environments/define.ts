import type { REnvironmentInformation  } from './environment';
import type { Identifier, IdentifierDefinition, InGraphIdentifierDefinition } from './identifier';
import { isNotUndefined } from '../../util/assert';
import { type ContainerIndex, type ContainerIndices, isParentContainerIndex, isSameIndex } from '../graph/vertex';
import type { FlowrConfigOptions } from '../../config';

/**
 * assumes: existing is not undefined, the overwrite has indices
 */
export function mergeDefinitionsForPointer(existing: readonly IdentifierDefinition[], definition: InGraphIdentifierDefinition): InGraphIdentifierDefinition[] {
	// When new definition is not a single index, e.g., a list redefinition, then reset existing definition
	if(definition.indicesCollection?.some(indices => indices.isContainer)) {
		return [definition];
	}

	const existingDefs = existing.filter(isNotUndefined) as InGraphIdentifierDefinition[];
	const overwriteIndices = definition.indicesCollection?.flatMap(indices => indices.indices) ?? [];
	// Compare existing and new definitions,
	// add new definitions and remove existing definitions that are overwritten by new definition
	const newExistingDefs: InGraphIdentifierDefinition[] = [];
	const hasCache = new Set<string>();
	for(const overwriteIndex of overwriteIndices) {
		for(const existingDef of existingDefs) {
			// empty or missing
			if(existingDef.indicesCollection === undefined || existingDef.indicesCollection.length === 0) {
				const existingDefPrint = JSON.stringify(existingDef);
				if(!hasCache.has(existingDefPrint)) {
					newExistingDefs.push(existingDef);
					hasCache.add(existingDefPrint);
				}
				continue;
			}

			const newIndicesCollection = overwriteContainerIndices(existingDef.indicesCollection, overwriteIndex);

			// if indices are now empty list, don't keep empty definition
			if(newIndicesCollection.length > 0) {
				const obj = {
					...existingDef,
					indicesCollection: newIndicesCollection,
				};
				const objHash = JSON.stringify(obj);
				if(!hasCache.has(objHash)) {
					newExistingDefs.push(obj);
					hasCache.add(objHash);
				}
			}
		}
	}
	// store changed existing definitions and add new one
	return [...newExistingDefs, definition];
}

function overwriteContainerIndices(
	existingIndices: ContainerIndices[],
	overwriteIndex: ContainerIndex
): ContainerIndices[] {
	const newIndicesCollection: ContainerIndices[] = [];

	for(const indices of existingIndices) {
		let newIndices: ContainerIndex[];
		// When overwrite index is container itself, then only overwrite sub-index
		if(isParentContainerIndex(overwriteIndex)) {
			newIndices = [];
			for(const index of indices.indices) {
				if(isSameIndex(index, overwriteIndex) && isParentContainerIndex(index)) {
					const overwriteSubIndices = overwriteIndex.subIndices.flatMap(a => a.indices);

					let newSubIndices: ContainerIndices[] = index.subIndices;
					for(const overwriteSubIndex of overwriteSubIndices) {
						newSubIndices = overwriteContainerIndices(newSubIndices, overwriteSubIndex);
					}

					if(newSubIndices.length > 0) {
						newIndices.push({
							...index,
							subIndices: newSubIndices,
						});
					}
				}
				if(!isSameIndex(index, overwriteIndex) || !isParentContainerIndex(index)) {
					newIndices.push(index);
				}
			}
		} else if(indices.isContainer) {
			// If indices are not a single, e.g., a list, take the whole definition
			newIndices = indices.indices;
		} else {
			// Filter existing indices with the same name
			newIndices = indices.indices.filter(def => !isSameIndex(def, overwriteIndex));
		}

		if(indices.isContainer || newIndices.length > 0) {
			newIndicesCollection.push({
				...indices,
				indices: newIndices,
			});
		}
	}

	return newIndicesCollection;
}

/**
 * Insert the given `definition` --- defined within the given scope --- into the passed along `environments` will take care of propagation.
 * Does not modify the passed along `environments` in-place! It returns the new reference.
 * @see {@link Environment#define}      - for details on how (local) definitions are handled.
 * @see {@link Environment#defineSuper} - for details on how (super) definitions are handled.
 */
export function define(definition: IdentifierDefinition & { name: Identifier }, superAssign: boolean | undefined, { level, current }: REnvironmentInformation, config: FlowrConfigOptions): REnvironmentInformation {
	return {
		level,
		current: superAssign ? current.defineSuper(definition) : current.define(definition, config),
	};
}
