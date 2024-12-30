import { guard } from '../../util/assert';
import { BuiltInEnvironment } from './environment';
import type { IEnvironment, REnvironmentInformation } from './environment';

import { cloneEnvironmentInformation } from './clone';
import type { IdentifierDefinition, InGraphIdentifierDefinition } from './identifier';
import type { ContainerIndex, ContainerIndicesCollection } from '../graph/vertex';


function defInEnv(newEnvironments: IEnvironment, name: string, definition: IdentifierDefinition) {
	const existing = newEnvironments.memory.get(name);

	// When there are defined indices, merge the definitions
	const inGraphDefinition = definition as InGraphIdentifierDefinition;
	if(existing !== undefined && inGraphDefinition.indicesCollection !== undefined && inGraphDefinition.controlDependencies === undefined) {
		newEnvironments.memory.set(name, mergeIndices(existing, inGraphDefinition));
		return;
	}

	// check if it is maybe or not
	if(existing === undefined || definition.controlDependencies === undefined) {
		newEnvironments.memory.set(name, [definition]);
	} else {
		existing.push(definition);
	}
}

function mergeIndices(existing: IdentifierDefinition[], definition: InGraphIdentifierDefinition): InGraphIdentifierDefinition[] {
	// When new definition is not a single index, e.g. a list redefinition, then reset existing definition
	// TODO: what happens when indicesCollection has more than one element?
	if(definition.indicesCollection !== undefined && definition.indicesCollection?.some(indices => indices.isContainer)) {
		return [definition];
	}
	// console.log('merging');
	const existingDefs = existing.map((def) => def as InGraphIdentifierDefinition).filter((def) => def !== undefined);
	const indices = definition.indicesCollection?.flatMap(indices => indices.indices) ?? [];
	// Compare existing and new definitions, add new definitions and remove existing
	// definitons that are overwritten by new definition
	const newExistingDefs: InGraphIdentifierDefinition[] = [];
	for(const overwriteIndex of indices) {
		for(const existingDef of existingDefs) {
			if(existingDef.indicesCollection === undefined) {
				continue;
			}
			const newIndicesCollection: ContainerIndicesCollection = [];
			for(const indices of existingDef.indicesCollection) {
				let newIndices: ContainerIndex[];
				if(indices.isContainer) {
					// If indices are not a single, e.g. a list, take whole definition
					newIndices = indices.indices;
				} else {
					// Filter existing indices with same name
					newIndices = indices.indices.filter((def) => def.lexeme !== overwriteIndex.lexeme);
				}

				if(indices.isContainer || newIndices.length > 0) {
					newIndicesCollection.push({
						...indices,
						indices: newIndices,
					});
				}
			}

			// if indices are now empty list, don't keep empty definition
			if(newIndicesCollection.length > 0) {
				newExistingDefs.push({
					...existingDef,
					indicesCollection: newIndicesCollection,
				});
			}
		}
	}
	// store changed existing definitons and add new one
	return [...newExistingDefs, definition];
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
