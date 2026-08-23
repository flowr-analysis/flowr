import { type REnvironmentInformation, Environment, REnvironment } from './environment';
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

/**
 * The environment's search path with an empty global frame: everything `library()` (or the project) attached
 * stays visible, what the global frame holds does not. Use this instead of
 * {@link ReadOnlyFlowrAnalyzerEnvironmentContext#makeCleanEnv|makeCleanEnv} wherever an environment is at hand:
 * a clean environment knows the built-ins alone, so a name an attached package brought in would go unresolved.
 * The chain below the global is shared, not rebuilt, so this costs one frame.
 */
export function cleanEnvOf({ current }: REnvironmentInformation): REnvironmentInformation {
	const inner = REnvironment.findGlobal(current);
	const global = new Environment(inner.parent).asGlobal();
	global.n = inner.n;
	return { level: 0, current: global };
}
