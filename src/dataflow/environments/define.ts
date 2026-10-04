import type { Environment, REnvironmentInformation } from './environment';
import { Identifier, type IdentifierDefinition } from './identifier';

/**
 * Define an identifier in the environment, possibly as a super assignment.
 * This recalculates the level.
 * With `append`, a super assignment keeps the definitions the name already has instead of replacing them.
 */
export function define(definition: IdentifierDefinition & { name: Identifier }, superAssign: boolean | undefined, { level, current }: REnvironmentInformation, append = false): REnvironmentInformation {
	const newEnv = superAssign ? current.defineSuper(definition, append) : current.define(definition);
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