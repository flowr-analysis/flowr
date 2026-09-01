import type { FlowrCapability } from './types';
import { flowrCapabilities } from './data';


type CapabilityIdFilter<T extends FlowrCapability, Filter> = T extends Filter ? T['id'] : never;

/** Recursively extract all valid identifiers (which have the given support predicate) */
type ExtractAllIds<T extends FlowrCapability, Filter = FlowrCapability> =
	T extends { readonly capabilities: infer U }
		? U extends readonly FlowrCapability[]
			? (CapabilityIdFilter<T, Filter> | ExtractAllIds<U[number]>)
			: CapabilityIdFilter<T, Filter>
		: CapabilityIdFilter<T, Filter>;

type Capabilities = (typeof flowrCapabilities)['capabilities'][number];
export type FlowrCapabilityId = ExtractAllIds<Capabilities>;
export type SupportedFlowrCapabilityId = ExtractAllIds<Capabilities, { readonly supported: 'partially' | 'fully' }>;

type PathToCapability = readonly number[];

export interface FlowrCapabilityWithPath extends FlowrCapability {
	path: PathToCapability
}

/**
 * Get all capabilities with their paths.
 */
export function getAllCapabilities(): readonly FlowrCapabilityWithPath[] {
	const result: FlowrCapabilityWithPath[] = [];
	function traverse(capabilities: readonly FlowrCapability[], currentPath: PathToCapability = []) {
		let idx = 0;
		for(const capability of capabilities) {
			idx++;
			const nextPath = [...currentPath, idx];
			result.push({ ...capability, path: nextPath });
			if(capability.capabilities) {
				traverse(capability.capabilities, nextPath);
			}
		}
	}
	traverse(flowrCapabilities.capabilities, []);
	return result;
}

