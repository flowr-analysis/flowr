import { NodeId, ParentInformation, RNodeWithParent } from '../r-bridge'
import { assertUnreachable, guard } from '../util/assert'
import { Domain, unifyDomains } from './domain'

export interface AINode {
	// The ID of the node that logically holds the domain
	readonly nodeId:       NodeId
	// The ID of the whole expression that the domain was calculated from
	readonly expressionId: NodeId
	readonly domain:       Domain
	readonly astNode:      RNodeWithParent<ParentInformation>
}


export class AINodeStore extends Map<NodeId, AINode> {
	constructor(content: AINode[] | AINode | undefined = undefined) {
		if(Array.isArray(content)) {
			super(content.map(node => [node.nodeId, node]))
		} else if(content !== undefined) {
			super([[content.nodeId, content]])
		} else if(content === undefined) {
			super()
		} else {
			assertUnreachable(content)
		}
	}

	push(node: AINode): void {
		this.set(node.nodeId, node)
	}
}

export function mergeDomainStores(...stores: AINodeStore[]): AINodeStore {
	const result = new AINodeStore()
	for(const store of stores) {
		for(const [id, node] of store) {
			if(result.has(id)) {
				const existing = result.get(id)
				guard(existing !== undefined, `Domain for ID ${id} is missing`)
				const unified = unifyDomains([existing.domain, node.domain])
				result.set(id, {...node, domain: unified})
			} else {
				result.set(id, node)
			}
		}
	}
	return result
}