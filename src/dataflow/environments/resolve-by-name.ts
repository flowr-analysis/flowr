import type {
	Identifier,
	IdentifierDefinition,
	IEnvironment,
	REnvironmentInformation
} from './environment'
import { BuiltInEnvironment } from './environment'
import { dataflowLogger } from '../index'
import { expensiveTrace } from '../../util/log'

/**
 * Resolves a given identifier name to a list of its possible definition location using R scoping and resolving rules.
 *
 * @param name         - The name of the identifier to resolve
 * @param environments - The current environments used for name resolution
 *
 * @returns A list of possible definitions of the identifier (one if the definition location is exactly and always known), or `undefined` if the identifier is undefined in the current scope/with the current environment information.
 */
export function resolveByName(name: Identifier, environments: REnvironmentInformation): IdentifierDefinition[] | undefined {
	expensiveTrace(dataflowLogger, () => `Resolving local identifier ${name} (local stack size: ${environments.level})`)

	let current: IEnvironment = environments.current
	do{
		const definition = current.memory.get(name)
		if(definition !== undefined) {
			return definition
		}
		current = current.parent
	} while(current.id !== BuiltInEnvironment.id)

	dataflowLogger.trace(`Unable to find identifier ${name} in stack, can be built-in`)
	return current.memory.get(name)
}
