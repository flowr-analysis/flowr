import { type IEnvironment, type REnvironmentInformation ,  Environment } from './environment';
import type { Identifier, IdentifierDefinition } from './identifier';

function cloneEnvironment(environment: IEnvironment, recurseParents: boolean): IEnvironment
function cloneEnvironment(environment: IEnvironment | undefined, recurseParents: boolean): IEnvironment | undefined {
	if(environment === undefined) {
		return undefined;
	} else if(environment.builtInEnv) {
		return environment; // do not clone the built-in environment
	}
	/* make sure the clone has the same id */
	const clone = new Environment(recurseParents ? cloneEnvironment(environment.parent, recurseParents) : environment.parent, environment.builtInEnv);
	clone.memory = new Map(JSON.parse(JSON.stringify([...environment.memory])) as [Identifier, IdentifierDefinition[]][]);
	return clone;
}

/**
 * Produce a clone of the given environment information.
 * @param environment        - The environment information to clone.
 * @param builtInEnvironment - The built-in environment
 * @param recurseParents     - Whether to clone the parent environments as well.
 */
export function cloneEnvironmentInformation(environment: REnvironmentInformation, recurseParents = true): REnvironmentInformation {
	return {
		current: cloneEnvironment(environment.current, recurseParents),
		level:   environment.level
	};
}
