import { AINodeStore, mergeDomainStores } from '../../ainode'
import { aiLogger } from '../../processor'
import { Handler } from '../handler'

export class ExprList implements Handler {
	private exprList: AINodeStore = new AINodeStore()

	getName(): string {
		return 'ExprList'
	}

	enter(): void {
		aiLogger.trace(`Entered ${this.getName()}`)
	}

	exit(): AINodeStore {
		return this.exprList
	}

	next(aiNodes: AINodeStore): void {
		this.exprList = mergeDomainStores(aiNodes, this.exprList)
	}
}
