import type { IEnvironment, REnvironmentInformation } from './environment';
import { BuiltInEnvironment } from './environment';

import type { Identifier } from './identifier';
import { happensInEveryBranch } from '../info';

/**
 * Removes all definitions of a given name from the environment.
 */
export function remove(name: Identifier, environment: REnvironmentInformation): REnvironmentInformation {
	let current: IEnvironment = environment.current;
	do{
		const definition = current.memory.get(name);
		if(definition !== undefined) {
			current.memory.delete(name);
			if(definition.every(d => happensInEveryBranch(d.controlDependencies))) {
				break;
			}
		}
		current = current.parent;
	} while(current.id !== BuiltInEnvironment.id);

	// we never remove built ins
	return environment;
}
