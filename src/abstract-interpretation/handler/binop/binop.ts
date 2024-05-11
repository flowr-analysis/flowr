import {Handler} from '../handler'
import {aiLogger} from '../../processor'
import {BinaryOperatorFlavor, ParentInformation, RBinaryOp} from '../../../r-bridge'
import {guard} from '../../../util/assert'
import {operators} from './operators'
import {AINode, AINodeStore} from '../../ainode'
import {DataflowInformation} from '../../../dataflow/internal/info'

export type BinOpOperators = {
	[key in BinaryOperatorFlavor]: (lhs: AINode, rhs: AINode, node: RBinaryOp<ParentInformation>) => AINodeStore
}

export class BinOp extends Handler {
	lhs: AINode | undefined
	rhs: AINode | undefined

	constructor(
		readonly dfg: DataflowInformation,
		readonly domains: AINodeStore,
		readonly node: RBinaryOp<ParentInformation>
	) {
		super(dfg, domains, `Bin Op (${node.flavor})`)
	}

	exit(): AINodeStore {
		aiLogger.trace(`Exited ${this.name}`)
		guard(this.lhs !== undefined, `No LHS found for assignment ${this.node.info.id}`)
		guard(this.rhs !== undefined, `No RHS found for assignment ${this.node.info.id}`)
		return operators[this.node.flavor](this.lhs, this.rhs, this.node)
	}

	next(aiNodes: AINodeStore): AINodeStore {
		aiLogger.trace(`${this.name} received`)
		guard(aiNodes.size === 1, 'Welp, next received more than one AINodes')
		const node = aiNodes.values().next().value as AINode
		if(this.lhs === undefined) {
			return new AINodeStore(this.lhs = node)
		}
		if(this.rhs === undefined) {
			return new AINodeStore(this.rhs = node)
		}
		guard(false, `BinOp ${this.node.info.id} already has both LHS and RHS`)
	}
}