import { type REnvironmentInformation, Environment } from './environment';
import { guard } from '../../util/assert';

/**
 * Add a new local environment scope to the stack, returns the modified variant (shares the original stack, no deep-clone).
 * @see {@link popLocalEnvironment} - to remove the local scope again
 */
export function pushLocalEnvironment({ level, current }: REnvironmentInformation): REnvironmentInformation {
	return {
		current: new Environment(current),
		level:   level + 1
	};
}

/**
 * Remove the top local environment scope from the stack, returns the modified variant (shares the original stack, no deep-clone).
 * @see {@link pushLocalEnvironment} - to add a local scope
 */
export function popLocalEnvironment({ current, level }: REnvironmentInformation): REnvironmentInformation {
	guard(level > 0, 'cannot remove the global/root environment');
	return {
		current: current.parent,
		level:   level - 1
	};
}

/**
 * Pads whichever of `base`/`next` is shallower with empty local scopes until both are at the same lexical {@link REnvironmentInformation#level|level}.
 */
export function padToCommonScope(base: REnvironmentInformation, next: REnvironmentInformation): { base: REnvironmentInformation, next: REnvironmentInformation } {
	while(next.level < base.level) {
		next = pushLocalEnvironment(next);
	}
	while(next.level > base.level) {
		base = pushLocalEnvironment(base);
	}
	return { base, next };
}
