import type { REnvironmentInformation } from './environment';

/**
 * Produce a clone of the given environment information.
 * @param environment    - The environment information to clone.
 * @param recurseParents - Whether to clone the parent environments as well.
 */
export function cloneEnvironmentInformation(environment: REnvironmentInformation, recurseParents = true): REnvironmentInformation {
	return {
		current: environment.current.clone(recurseParents),
		level:   environment.level
	};
}
