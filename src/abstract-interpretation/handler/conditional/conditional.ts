import { ParentInformation, RIfThenElse } from '../../../r-bridge'
import { guard } from '../../../util/assert'
import { AINode, AINodeStore, aiLogger } from '../../processor'
import { Handler } from '../handler'

export class Conditional implements Handler {
	condition: AINode   | undefined
	then:      AINodeStore | undefined
	else:      AINodeStore | undefined

	constructor(readonly node: RIfThenElse<ParentInformation>) {}

	getName(): string {
		return 'IfThenElse'
	}

	enter(): void {
		aiLogger.trace(`Entered ${this.getName()}`)
	}

	exit(): AINodeStore {
		aiLogger.trace(`Exited ${this.getName()}`)
		guard(this.condition !== undefined, `No condition found for conditional ${this.node.info.id}`)
		guard(this.then !== undefined, `No then-branch found for conditional ${this.node.info.id}`)
		// TODO: calculate new domain
		return new AINodeStore({
			nodeId:       this.node.info.id,
			expressionId: this.node.info.id,
			domain:       this.condition.domain,
			astNode:      this.node,
		})
	}

	next(aiNodes: AINodeStore): void {
		aiLogger.trace(`${this.getName()} received`)
		if(this.condition === undefined) {
			guard(aiNodes.size === 1, 'Welp, next received more than one AINodes')
			const node = aiNodes.values().next().value as AINode
			this.condition = node
		} else if(this.then === undefined) {
			this.then = aiNodes
		} else if(this.else === undefined) {
			this.else = aiNodes
		} else {
			guard(false, `Conditional ${this.node.info.id} already has condition, then and else`)
		}
	}
}
