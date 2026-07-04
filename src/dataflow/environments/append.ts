import { type REnvironmentInformation  } from './environment';
import type { IdentifierDefinition } from './identifier';
import { padToCommonScope } from './scoping';

/**
 * Merges two arrays of identifier definitions, ensuring uniqueness based on `nodeId` and `definedAt`.
 * Returns a copy, the input arrays are not modified (they may be shared with other environments).
 */
export function uniqueMergeValuesInDefinitions(old: readonly IdentifierDefinition[], value: readonly IdentifierDefinition[]): IdentifierDefinition[] {
	const result = old.slice();
	for(const v of value) {
		const find = result.findIndex(o => o.nodeId === v.nodeId && o.definedAt === v.definedAt);
		if(find < 0) {
			result.push(v);
		}
	}
	return result;
}

/**
 * Adds all writes of `next` to `base` (i.e., the operations of `next` *might* happen).
 */
export function appendEnvironment(base: REnvironmentInformation, next: REnvironmentInformation | undefined): REnvironmentInformation;
export function appendEnvironment(base: REnvironmentInformation | undefined, next: REnvironmentInformation): REnvironmentInformation;
export function appendEnvironment(base: undefined, next: undefined): undefined;
export function appendEnvironment(base: REnvironmentInformation | undefined, next: REnvironmentInformation | undefined): REnvironmentInformation | undefined;
export function appendEnvironment(base: REnvironmentInformation | undefined, next: REnvironmentInformation | undefined): REnvironmentInformation | undefined {
	if(base === undefined) {
		return next;
	} else if(next === undefined) {
		return base;
	}

	({ base, next } = padToCommonScope(base, next));
	// packages attached below the global env are unified branch-wise by Environment#append
	return {
		current: base.current.append(next.current),
		level:   base.level,
	};
}
