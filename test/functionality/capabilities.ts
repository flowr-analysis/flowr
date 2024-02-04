import { guard } from '../../src/util/assert'

const enum RequiredFeature {
	/** https://github.com/Code-Inspect/flowr/labels/typing */
	Typing,
	/** https://github.com/Code-Inspect/flowr/labels/abstract%20interpretation */
	AbstractInterpretation,
}

interface FlowrCapability {
	/** The human-readable name of the capability */
	readonly name:         string
	/**
	 * The unique identifier of the capability, used to refer to it independent of the location.
	 * We could use a key-value mapping. However, this way, an id is self-contained and can be moved around as one object.
	 */
	readonly id:           string
	/** A list of features that are required for the capability, extend at need. */
	readonly needs?:       RequiredFeature[]
	readonly description?: string
	readonly note?:        string
	/** The level of support for the capability, undefined if it is a meta-capability that does not need such an attribute */
	readonly supported?:   'not' | 'partially' | 'fully'
	readonly capabilities: readonly FlowrCapability[]
}

export interface FlowrCapabilities {
	/** The human-readable name of the capabilities */
	readonly name:         string
	/** A description of the capabilities */
	readonly description:  string
	/** The version of the capabilities */
	readonly version:      string
	/** A list of the capabilities */
	readonly capabilities: FlowrCapability[]
}

// TODO automatically produce wiki page from this!

export const flowrCapabilities = {
	name:         'Capabilities of flowR',
	description:  'This is an evolving representation of what started with #636 to formulate capabilities in a structured format.',
	version:      '0.0.1',
	capabilities: [
		{
			name:         'Names and Identifiers',
			id:           'names-and-identifiers',
			capabilities: [
				{
					name:         'Form',
					id:           'name-form',
					capabilities: [
						{
							name:         'Normal',
							id:           'name-form-normal',
							description:  'Recognize constructs like `a`, `plot`, ...',
							supported:    'fully',
							needs:        [RequiredFeature.Typing],
							capabilities: []
						}
					]
				}
			]
		}
	]
} as const satisfies FlowrCapabilities

/** Recursively extract all valid identifiers */
type ExtractAllIds<T extends FlowrCapability> =
	T extends { readonly capabilities: infer U }
		? U extends readonly FlowrCapability[]
			? (T['id'] | ExtractAllIds<U[number]>)
			: T['id']
		: T['id']

type Capabilities = (typeof flowrCapabilities)['capabilities'][number]
export type FlowrCapabilitiesId = ExtractAllIds<Capabilities>

function search(id: FlowrCapabilitiesId, capabilities: readonly FlowrCapability[]): FlowrCapability | undefined {
	for(const capability of capabilities) {
		if(capability.id === id) {
			return capability
		}
		const found = search(id, capability.capabilities)
		if(found) {
			return found
		}
	}
	return undefined
}

export function getCapabilityById(id: FlowrCapabilitiesId): FlowrCapability {
	const value = search(id, flowrCapabilities.capabilities)
	guard(value !== undefined, () => `Could not find capability with id ${id}`)
	return value
}
