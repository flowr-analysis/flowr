import { type REnvironmentInformation  } from './environment';
import type { ControlDependency } from '../info';
import { padToCommonScope } from './scoping';

export function overwriteEnvironment(base: REnvironmentInformation, next: REnvironmentInformation | undefined, applyCds?: readonly ControlDependency[]): REnvironmentInformation;
export function overwriteEnvironment(base: REnvironmentInformation | undefined, next: REnvironmentInformation, applyCds?: readonly ControlDependency[]): REnvironmentInformation;
export function overwriteEnvironment(base: undefined, next: undefined,  applyCds?: readonly ControlDependency[]): undefined;
export function overwriteEnvironment(base: REnvironmentInformation | undefined, next: REnvironmentInformation | undefined, applyCds?: readonly ControlDependency[]): REnvironmentInformation | undefined;
/**
 * Definitions within `next` replace those in `base` by name; if all of `next`'s are maybe, they are appended instead (turning existing ones maybe too), like {@link appendEnvironment}.
 * @see {@link Environment.overwrite} - for details on how definitions are handled.
 */
export function overwriteEnvironment(base: REnvironmentInformation | undefined, next: REnvironmentInformation | undefined, applyCds?: readonly ControlDependency[]): REnvironmentInformation | undefined {
	if(base === undefined || next === undefined) {
		return next ?? base;
	}

	({ base, next } = padToCommonScope(base, next));
	return {
		current: base.current.overwrite(next.current, applyCds),
		level:   base.level
	};
}
