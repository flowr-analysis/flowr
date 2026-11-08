import { type REnvironmentInformation, Environment, REnvironment } from './environment';
import { guard } from '../../util/assert';

/**
 * Add a new local environment scope to the stack, returns the modified variant (shares the original stack, no deep-clone).
 * @useInstead {@link REnvironment.pushLocal}
 */
export function pushLocalEnvironment({ level, current }: REnvironmentInformation): REnvironmentInformation {
	return {
		current: new Environment(current),
		level:   level + 1
	};
}

/**
 * Remove the top local environment scope from the stack, returns the modified variant (shares the original stack, no deep-clone).
 * @useInstead {@link REnvironment.popLocal}
 */
export function popLocalEnvironment({ current, level }: REnvironmentInformation): REnvironmentInformation {
	guard(level > 0, 'cannot remove the global/root environment');
	return {
		current: current.parent,
		level:   level - 1
	};
}

/**
 * The frames of `environment` a function whose body runs at `bodyLevel` can see: the frame it was defined in and those around it, never the frames of the functions calling it.
 * @useInstead {@link REnvironment.visibleTo}
 */
export function framesVisibleTo(bodyLevel: number, environment: REnvironmentInformation): REnvironmentInformation {
	const level = Math.max(0, Math.min(bodyLevel - 1, environment.level));
	let current = environment.current;
	for(let skip = environment.level - level; skip > 0 && current.parent !== undefined; skip--) {
		current = current.parent;
	}
	return { current, level };
}

/** Pads whichever of `base`/`next` is shallower with empty local scopes until both are at the same lexical {@link REnvironmentInformation#level|level}. */
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
 * The environment's search path with an empty global frame: attached packages stay visible, the global frame's binds do not.
 * @useInstead {@link REnvironment.cleanOf}
 */
export function cleanEnvOf({ current }: REnvironmentInformation): REnvironmentInformation {
	const inner = REnvironment.findGlobal(current);
	const global = new Environment(inner.parent).asGlobal();
	global.n = inner.n;
	return { level: 0, current: global };
}
