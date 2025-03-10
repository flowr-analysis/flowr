import { guard } from '../../util/assert';
import { BuiltInEnvironment } from './environment';
import type { IEnvironment, REnvironmentInformation  } from './environment';

import { cloneEnvironmentInformation } from './clone';
import type { IdentifierDefinition, InGraphIdentifierDefinition } from './identifier';
import type { ContainerIndex, ContainerIndices } from '../graph/vertex';
import { isParentContainerIndex, isSameIndex } from '../graph/vertex';
import { getConfig } from '../../config';

function defInEnv(newEnvironments: IEnvironment, name: string, definition: IdentifierDefinition) {
	const existing = newEnvironments.memory.get(name);

	// When there are defined indices, merge the definitions
	const inGraphDefinition = definition as InGraphIdentifierDefinition;
	if(
		getConfig().solver.pointerTracking &&
		existing !== undefined &&
		inGraphDefinition.controlDependencies === undefined
	) {
		if(inGraphDefinition.indicesCollection !== undefined) {
			newEnvironments.memory.set(name, mergeDefinitions(existing, inGraphDefinition));
			return;
		} else if((existing as InGraphIdentifierDefinition[])?.flatMap(i => i.indicesCollection ?? []).length > 0) {
			// When indices couldn't be resolved, but indices where defined before, just add the definition
			existing.push(definition);
			return;
		}
	}

	// check if it is maybe or not
	if(existing === undefined || definition.controlDependencies === undefined) {
		newEnvironments.memory.set(name, [definition]);
	} else {
		existing.push(definition);
	}
}

function mergeDefinitions(existing: IdentifierDefinition[], definition: InGraphIdentifierDefinition): InGraphIdentifierDefinition[] {
	// When new definition is not a single index, e.g., a list redefinition, then reset existing definition
	if(definition.indicesCollection?.some(indices => indices.isContainer)) {
		return [definition];
	}

	const existingDefs = existing.map((def) => def as InGraphIdentifierDefinition).filter((def) => def !== undefined);
	const overwriteIndices = definition.indicesCollection?.flatMap(indices => indices.indices) ?? [];
	// Compare existing and new definitions,
	// add new definitions and remove existing definitions that are overwritten by new definition
	const newExistingDefs: InGraphIdentifierDefinition[] = [];
	for(const overwriteIndex of overwriteIndices) {
		for(const existingDef of existingDefs) {
			if(existingDef.indicesCollection === undefined) {
				newExistingDefs.push(existingDef);
				continue;
			}

			const newIndicesCollection = overwriteContainerIndices(existingDef.indicesCollection, overwriteIndex);

			// if indices are now empty list, don't keep empty definition
			if(newIndicesCollection.length > 0) {
				newExistingDefs.push({
					...existingDef,
					indicesCollection: newIndicesCollection,
				});
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
 */
export function define(definition: IdentifierDefinition, superAssign: boolean | undefined, environment: REnvironmentInformation): REnvironmentInformation {
	const name = definition.name;
	guard(name !== undefined, () => `Name must be defined, but isn't for ${JSON.stringify(definition)}`);
	let newEnvironment;
	if(superAssign) {
		newEnvironment = cloneEnvironmentInformation(environment, true);
		let current: IEnvironment = newEnvironment.current;
		let last = undefined;
		let found = false;
		do{
			if(current.memory.has(name)) {
				current.memory.set(name, [definition]);
				found = true;
				break;
			}
			last = current;
			current = current.parent;
		} while(current.id !== BuiltInEnvironment.id);
		if(!found) {
			guard(last !== undefined, () => `Could not find global scope for ${name}`);
			last.memory.set(name, [definition]);
		}
	} else {
		newEnvironment = cloneEnvironmentInformation(environment, false);
		defInEnv(newEnvironment.current, name, definition);
	}
	return newEnvironment;
}
