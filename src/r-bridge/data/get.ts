import { guard } from '../../util/assert'
import type { FlowrCapability } from './types'
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

type PathToCapability = readonly number[]

export interface FlowrCapabilityWithPath extends FlowrCapability{
	path: PathToCapability
}

function search(id: FlowrCapabilityId, capabilities: readonly FlowrCapability[], path: number[] = []): FlowrCapabilityWithPath | undefined {
	let idx = 0
	for(const capability of capabilities) {
		idx++ // index by one :)
		if(capability.id === id) {
			return { ...capability, path: [...path, idx] }
		}
		if(capability.capabilities) {
			const found = search(id, capability.capabilities, [...path, idx])
			if(found) {
				return found
			}
		}
	}
	return undefined
}

const capabilityCache = new Map<FlowrCapabilityId, FlowrCapabilityWithPath>

export function getCapabilityById(id: FlowrCapabilityId): FlowrCapabilityWithPath {
	const cached = capabilityCache.get(id)
	if(cached) {
		return cached
	}
	const value = search(id, flowrCapabilities.capabilities)
	guard(value !== undefined, () => `Could not find capability with id ${id}`)
	capabilityCache.set(id, value)
	return value
}

export function getAllCapabilities(): readonly FlowrCapabilityWithPath[] {
	const result: FlowrCapabilityWithPath[] = []
	function traverse(capabilities: readonly FlowrCapability[], currentPath: PathToCapability = []) {
		let idx = 0
		for(const capability of capabilities) {
			idx++
			const nextPath = [...currentPath, idx]
			result.push({ ...capability, path: nextPath })
			if(capability.capabilities) {
				traverse(capability.capabilities, nextPath)
			}
		}
	}
	traverse(flowrCapabilities.capabilities, [])
	return result
}

