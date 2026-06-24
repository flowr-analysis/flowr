import { type REnvironmentInformation  } from './environment';
import type { IdentifierDefinition } from './identifier';
import { pushLocalEnvironment } from './scoping';

/**
 * Merges two arrays of identifier definitions, ensuring uniqueness based on `nodeId` and `definedAt`.
 */
export function uniqueMergeValuesInDefinitions(old: IdentifierDefinition[], value: readonly IdentifierDefinition[]): IdentifierDefinition[] {
	const result = old;
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

	if(base.level !== next.level) {
		while(next.level < base.level) {
			next = pushLocalEnvironment(next);
		}
		while(next.level > base.level) {
			base = pushLocalEnvironment(base);
		}
	}

	return {
		current: base.current.append(next.current),
		level:   base.level,
	};
}
