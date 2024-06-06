import type { IEnvironment, REnvironmentInformation } from './environment'
import { BuiltInEnvironment, Environment } from './environment'
import type { Identifier, IdentifierDefinition } from './identifier'
import { Domain } from '../../abstract-interpretation/domain'

function cloneEnvironment(environment: IEnvironment, recurseParents: boolean): IEnvironment
function cloneEnvironment(environment: IEnvironment | undefined, recurseParents: boolean): IEnvironment | undefined {
	if(environment === undefined) {
		return undefined
	} else if(environment.id === BuiltInEnvironment.id) {
		return BuiltInEnvironment
	}
	const clone = new Environment(environment.name, recurseParents ? cloneEnvironment(environment.parent, recurseParents) : environment.parent)
	clone.memory = new Map(JSON.parse(JSON.stringify([...environment.memory]), (k, v) => {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
		if(k === '' && v?.__type === 'Domain') {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
			return Domain.revive(v)
		}
		// eslint-disable-next-line @typescript-eslint/no-unsafe-return
		return v
	}) as  [Identifier, IdentifierDefinition[]][])
	return clone
}

export function cloneEnvironmentInformation(environment: REnvironmentInformation, recurseParents = true): REnvironmentInformation {
	return {
		current: cloneEnvironment(environment.current, recurseParents),
		level:   environment.level
	}
}
