import type { REnvironmentInformation  } from './environment';
import type { Identifier, IdentifierDefinition } from './identifier';

/**
 *
 */
export function define(definition: IdentifierDefinition & { name: Identifier }, superAssign: boolean | undefined, { level, current }: REnvironmentInformation): REnvironmentInformation {
	return {
		level,
		current: superAssign ? current.defineSuper(definition) : current.define(definition),
	};
}
