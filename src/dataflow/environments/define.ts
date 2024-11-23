import { guard } from '../../util/assert';
import { BuiltInEnvironment } from './environment';
import type { IEnvironment, REnvironmentInformation } from './environment';

import { cloneEnvironmentInformation } from './clone';
import type { IdentifierDefinition, InGraphIdentifierDefinition } from './identifier';

const hasNoControlDependencies = (definition: IdentifierDefinition) => definition.controlDependencies === undefined || definition.controlDependencies.length === 0;

function defInEnv(newEnvironments: IEnvironment, name: string, definition: IdentifierDefinition) {
	const existing = newEnvironments.memory.get(name);
	// check if it is maybe or not
	const inGraphDefinition = definition as InGraphIdentifierDefinition;
	if(existing === undefined || definition.controlDependencies === undefined) {
		newEnvironments.memory.set(name, [definition]);
	} else {
		if(inGraphDefinition.indices !== undefined && hasNoControlDependencies(definition)) {
			const existingDefs = existing.map((def) => def as InGraphIdentifierDefinition)
				.filter((def) => def !== undefined);
			for(let i = 0; i < inGraphDefinition.indices.length; i++) {
				const overwriteIndex = inGraphDefinition.indices[i];
				for(let j = 0; j < existingDefs.length; j++) {
					const existingDef = existingDefs[j];
					if(existingDef.indices === undefined) {
						continue;
					}
					existingDef.indices = existingDef.indices.filter((def) => def.lexeme !== overwriteIndex.lexeme);
				}
			}
		}
		existing.push(definition);
	}
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
