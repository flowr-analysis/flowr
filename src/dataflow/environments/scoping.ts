import { type REnvironmentInformation, Environment, libraryLayerHeight } from './environment';
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
	return {
		current: current.parent,
		level:   level - 1
	};
}

/**
 * Pads the lexical scopes of `base` and `next` to a common depth so they can be merged
 * (see {@link appendEnvironment}/{@link overwriteEnvironment}). Loaded libraries (see {@link EnvType})
 * extend the search path rather than nesting a scope, so they are discounted from the level.
 * @returns the padded environments and their shared lexical `scope` depth.
 */
export function padToCommonScope(base: REnvironmentInformation, next: REnvironmentInformation): { base: REnvironmentInformation, next: REnvironmentInformation, scope: number } {
	let baseScope = base.level - libraryLayerHeight(base.current);
	let nextScope = next.level - libraryLayerHeight(next.current);
	while(nextScope < baseScope) {
		next = pushLocalEnvironment(next);
		nextScope++;
	}
	while(nextScope > baseScope) {
		base = pushLocalEnvironment(base);
		baseScope++;
	}
	return { base, next, scope: baseScope };
}
