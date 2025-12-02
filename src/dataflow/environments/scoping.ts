import { type REnvironmentInformation , Environment } from './environment';
import { guard } from '../../util/assert';

/**
 * Add a new local environment scope to the stack, returns the modified variant - sharing the original environments in the stack (no deep-clone)
 * @see {@link popLocalEnvironment} - to remove the local scope again
 */
export function pushLocalEnvironment({ level, current }: REnvironmentInformation): REnvironmentInformation {
	return {
		current: new Environment(current),
		level:   level + 1
	};
}

/**
 * Remove the top local environment scope from the stack, returns the modified variant - sharing the original environments in the stack (no deep-clone)
 * @see {@link pushLocalEnvironment} - to add a local scope
 */
export function popLocalEnvironment({ current, level }: REnvironmentInformation): REnvironmentInformation {
	guard(level > 0, 'cannot remove the global/root environment');
	const parent = current.parent;
	guard(parent !== undefined, 'level is wrong, parent is undefined even though level suggested depth > 0 (starts with 0)');
	return {
		current: parent,
		level:   level - 1
	};
}
