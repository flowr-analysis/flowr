import { guard } from '../../util/assert';
import type { REnvironmentInformation, IEnvironment } from './environment';
import { BuiltInEnvironment , Environment } from './environment';
import type { IdentifierDefinition } from './identifier';
import type { ControlDependency } from '../info';

function anyIsMaybeOrEmpty(values: readonly IdentifierDefinition[]): boolean {
	if(values.length === 0) {
		return true;
	}
	for(const val of values) {
		if(val.controlDependencies !== undefined) {
			return true;
		}
	}
	return false;
}

export function overwriteIEnvironmentWith(base: IEnvironment | undefined, next: IEnvironment | undefined, includeParent = true, applyCds?: readonly ControlDependency[]): IEnvironment {
	guard(base !== undefined && next !== undefined, 'can not overwrite environments with undefined');
	const map = new Map(base.memory);
	for(const [key, values] of next.memory) {
		const hasMaybe = applyCds?.length === 0 || applyCds !== undefined ? true : anyIsMaybeOrEmpty(values);
		if(hasMaybe) {
			const old = map.get(key);
			// we need to make a copy to avoid side effects for old reference in other environments
			const updatedOld: IdentifierDefinition[] = old ?? [];
			for(const v of values) {
				const index = updatedOld.findIndex(o => o.nodeId === v.nodeId && o.definedAt === v.definedAt);
				if(index < 0) {
					if(applyCds !== undefined) {
						updatedOld.push({
							...v,
							controlDependencies: [...applyCds, ...v.controlDependencies ?? []]
						});
					} else {
						updatedOld.push(v);
					}
				}
			}
			map.set(key, [...updatedOld]);
		} else {
			map.set(key, values);
		}
	}

	let parent: IEnvironment;
	if(includeParent) {
		parent = base.parent.id === BuiltInEnvironment.id ? BuiltInEnvironment : overwriteIEnvironmentWith(base.parent, next.parent, includeParent, applyCds);
	} else {
		parent = base.parent;
	}

	const out = new Environment(parent);
	out.memory = map;
	return out;
}


export function overwriteEnvironment(base: REnvironmentInformation, next: REnvironmentInformation | undefined, applyCds?: readonly ControlDependency[]): REnvironmentInformation
export function overwriteEnvironment(base: REnvironmentInformation | undefined, next: REnvironmentInformation, applyCds?: readonly ControlDependency[]): REnvironmentInformation
export function overwriteEnvironment(base: undefined, next: undefined, applyCds?: readonly ControlDependency[]): undefined
export function overwriteEnvironment(base: REnvironmentInformation | undefined, next: REnvironmentInformation | undefined, applyCds?: readonly ControlDependency[]): REnvironmentInformation | undefined
/**
 * Assumes, that all definitions within next replace those within base (given the same name).
 * <b>But</b> if all definitions within next are maybe, then they are appended to the base definitions (updating them to be `maybe` from now on as well), similar to {@link appendEnvironment}.
 */
export function overwriteEnvironment(base: REnvironmentInformation | undefined, next: REnvironmentInformation | undefined, applyCds?: readonly ControlDependency[]): REnvironmentInformation | undefined {
	if(base === undefined) {
		return next;
	} else if(next === undefined) {
		return base;
	}
	guard(next.level === base.level, `cannot overwrite environments with differently nested local scopes, base ${base.level} vs. next ${next.level}. This should not happen.`);

	return {
		current: overwriteIEnvironmentWith(base.current, next.current, true, applyCds),
		level:   base.level
	};
}
