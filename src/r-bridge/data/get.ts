import { guard } from '../../util/assert'
import { FlowrCapability } from './types'
import { flowrCapabilities } from './data'


/** Recursively extract all valid identifiers */
type ExtractAllIds<T extends FlowrCapability> =
	T extends { readonly capabilities: infer U }
		? U extends readonly FlowrCapability[]
			? (T['id'] | ExtractAllIds<U[number]>)
			: T['id']
		: T['id']

type Capabilities = (typeof flowrCapabilities)['capabilities'][number]
export type FlowrCapabilityId = ExtractAllIds<Capabilities>

function search(id: FlowrCapabilityId, capabilities: readonly FlowrCapability[]): FlowrCapability | undefined {
	for(const capability of capabilities) {
		if(capability.id === id) {
			return capability
		}
		if(capability.capabilities) {
			const found = search(id, capability.capabilities)
			if(found) {
				return found
			}
		}
	}
	return undefined
}

export function getCapabilityById(id: FlowrCapabilityId): FlowrCapability {
	const value = search(id, flowrCapabilities.capabilities)
	guard(value !== undefined, () => `Could not find capability with id ${id}`)
	return value
}
