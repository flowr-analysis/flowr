import {ParentInformation, RIfThenElse} from '../../../r-bridge'
import {guard} from '../../../util/assert'
import {AINodeStore} from '../../ainode'
import {aiLogger} from '../../processor'
import {Handler} from '../handler'
import {DataflowInformation} from '../../../dataflow/internal/info'

export class Conditional extends Handler {
	condition: AINodeStore | undefined
	then:      AINodeStore | undefined
	else:      AINodeStore | undefined

	constructor(readonly dfg: DataflowInformation, readonly node: RIfThenElse<ParentInformation>) {
		super(dfg, 'IfThenElse')
	}

	exit(): AINodeStore {
		aiLogger.trace(`Exited ${this.name}`)
		guard(this.condition !== undefined, `No condition found for conditional ${this.node.info.id}`)
		guard(this.then !== undefined, `No then-branch found for conditional ${this.node.info.id}`)
		// TODO: calculate new domain
		return this.condition
	}

	next(aiNodes: AINodeStore): void {
		aiLogger.trace(`${this.name} received`)
		if(this.condition === undefined) {
			this.condition = aiNodes
		} else if(this.then === undefined) {
			this.then = aiNodes
		} else if(this.else === undefined) {
			this.else = aiNodes
		} else {
			guard(false, `Conditional ${this.node.info.id} already has condition, then and else`)
		}
	}
}
