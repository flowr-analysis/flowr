import { ParentInformation, RIfThenElse } from '../../../r-bridge'
import { guard } from '../../../util/assert'
import { AINode, aiLogger } from '../../processor'
import { Handler } from '../handler'

export class Conditional implements Handler<AINode> {
	condition: AINode | undefined
	then:      AINode | undefined
	else:      AINode | undefined

	constructor(readonly node: RIfThenElse<ParentInformation>) {}

	getName(): string {
		return 'IfThenElse'
	}

	enter(): void {
		aiLogger.trace(`Entered ${this.getName()}`)
	}

	exit(): AINode {
		aiLogger.trace(`Exited ${this.getName()}`)
		guard(this.condition !== undefined, `No condition found for conditional ${this.node.info.id}`)
		guard(this.then !== undefined, `No then-branch found for conditional ${this.node.info.id}`)
		guard(this.else !== undefined, `No else-branch found for conditional ${this.node.info.id}`)
		return {
			id:      this.node.info.id,
			domain:  this.condition.domain,
			astNode: this.node,
		}
		// guard(false, 'Not implemented yet')
	}

	next(node: AINode): void {
		aiLogger.trace(`${this.getName()} received`)
		if(this.condition === undefined) {
			this.condition = node
		} else if(this.then === undefined) {
			this.then = node
		} else if(this.else === undefined) {
			this.else = node
		} else {
			guard(false, `Conditional ${this.node.info.id} already has condition, then and else`)
		}
	}
}
