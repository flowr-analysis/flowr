import type { Environment, REnvironmentInformation } from './environment';
import { Identifier, type IdentifierDefinition } from './identifier';

/**
 * Define an identifier in the environment, possibly as a super assignment.
 * This recalculates the level
 */
export function define(definition: IdentifierDefinition & { name: Identifier }, superAssign: boolean | undefined, { level, current }: REnvironmentInformation): REnvironmentInformation {
	const newEnv = superAssign ? current.defineSuper(definition) : current.define(definition);
	return {
		level:   Identifier.getNamespace(definition.name) === undefined ? level : recalculateLevel(newEnv),
		current: newEnv,
	};
}

function recalculateLevel(env: Environment): number {
	let level = 0;
	let current = env;
	while(current.parent && !current.parent.builtInEnv) {
		level++;
		current = current.parent;
	}
	return level;
}