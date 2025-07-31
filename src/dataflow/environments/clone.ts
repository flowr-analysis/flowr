import type { IEnvironment, REnvironmentInformation } from './environment';
import { Environment } from './environment';
import type { Identifier, IdentifierDefinition } from './identifier';

function cloneEnvironment(environment: IEnvironment, recurseParents: boolean, defaultEnvironment: IEnvironment): IEnvironment
function cloneEnvironment(environment: IEnvironment | undefined, recurseParents: boolean, defaultEnvironment: IEnvironment): IEnvironment | undefined {
	if(environment === undefined) {
		return undefined;
	} else if(environment.id === defaultEnvironment.id) {
		return defaultEnvironment;
	}
	/* make sure the clone has the same id */
	const clone = new Environment(recurseParents ? cloneEnvironment(environment.parent, recurseParents, defaultEnvironment) : environment.parent, environment.isBuiltInDefault);
	clone.memory = new Map(JSON.parse(JSON.stringify([...environment.memory])) as [Identifier, IdentifierDefinition[]][]);
	return clone;
}

/**
 * Produce a clone of the given environment information.
 * @param environment    - The environment information to clone.
 * @param
 * @param recurseParents - Whether to clone the parent environments as well.
 */
export function cloneEnvironmentInformation(environment: REnvironmentInformation, defaultEnvironment: IEnvironment, recurseParents = true): REnvironmentInformation {
	return {
		current: cloneEnvironment(environment.current, recurseParents, defaultEnvironment),
		level:   environment.level
	};
}
