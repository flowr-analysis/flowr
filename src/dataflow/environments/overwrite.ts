import { type REnvironmentInformation  } from './environment';
import type { ControlDependency } from '../info';
import { pushLocalEnvironment } from './scoping';

export function overwriteEnvironment(base: REnvironmentInformation, next: REnvironmentInformation | undefined, applyCds?: readonly ControlDependency[]): REnvironmentInformation;
export function overwriteEnvironment(base: REnvironmentInformation | undefined, next: REnvironmentInformation, applyCds?: readonly ControlDependency[]): REnvironmentInformation;
export function overwriteEnvironment(base: undefined, next: undefined,  applyCds?: readonly ControlDependency[]): undefined;
export function overwriteEnvironment(base: REnvironmentInformation | undefined, next: REnvironmentInformation | undefined, applyCds?: readonly ControlDependency[]): REnvironmentInformation | undefined;
/**
 * Assumes, that all definitions within next replace those within base (given the same name).
 * <b>But</b> if all definitions within next are maybe, then they are appended to the base definitions (updating them to be `maybe` from now on as well), similar to {@link appendEnvironment}.
 * @see {@link Environment.overwrite} - for details on how definitions are handled.
 */
export function overwriteEnvironment(base: REnvironmentInformation | undefined, next: REnvironmentInformation | undefined, applyCds?: readonly ControlDependency[]): REnvironmentInformation | undefined {
	if(base === undefined) {
		return next;
	} else if(next === undefined) {
		return base;
	}

	if(base.level !== next.level) {
		while(next.level < base.level) {
			next = pushLocalEnvironment(next);
		}
		while(next.level > base.level) {
			base = pushLocalEnvironment(base);
		}
	}

	return {
		current: base.current.overwrite(next.current, applyCds),
		level:   base.level
	};
}
