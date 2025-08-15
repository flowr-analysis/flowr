import type { IEnvironment, REnvironmentInformation } from './environment';
import { isDefaultBuiltInEnvironment } from './environment';

import type { Identifier } from './identifier';
import { happensInEveryBranch } from '../info';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { cloneEnvironmentInformation } from './clone';

/**
 * Removes all definitions of a given name from the environment.
 */
export function remove(name: Identifier, environment: REnvironmentInformation, defaultEnvironment: IEnvironment): REnvironmentInformation {
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
	} while(current.id !== defaultEnvironment.id);

	// we never remove built ins
	return environment;
}


/** Creates a copy of the original environment but without the definitions of the given ids */
export function removeAll(definitions: readonly { nodeId: NodeId, name: Identifier | undefined }[], environment: REnvironmentInformation): REnvironmentInformation {
	environment = cloneEnvironmentInformation(environment, true);
	let current: IEnvironment = environment.current;
	do{
		for(const { nodeId, name } of definitions) {
			if(name) {
				current.memory.delete(name);
			} else {
				// remove all definitions for the node id
				for(const [key, values] of current.memory) {
					const res = values.filter(v => v.nodeId === nodeId);
					if(res.length > 0) {
						current.memory.set(key, values);
					} else {
						current.memory.delete(key);
					}
				}
			}
		}
		current = current.parent;
	} while(!isDefaultBuiltInEnvironment(current));

	// we never remove built ins so we can stop one early
	return environment;
}