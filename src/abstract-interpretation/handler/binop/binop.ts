import {Handler} from '../handler'
import {BinaryOperatorFlavor, NodeId, ParentInformation, RBinaryOp} from '../../../r-bridge'
import {guard} from '../../../util/assert'
import {operators} from './operators'
import {AINode, AINodeStore} from '../../ainode'
import {DataflowInformation} from '../../../dataflow/internal/info'

export type BinOpOperators = {
	[key in BinaryOperatorFlavor]: (lhs: AINode, rhs: AINode, node: RBinaryOp<ParentInformation>) => AINodeStore
}

export class BinOp extends Handler {
	lhs: NodeId | undefined
	rhs: NodeId | undefined

	constructor(
		dfg: DataflowInformation,
		domains: AINodeStore,
		private readonly node: RBinaryOp<ParentInformation>
	) {
		super(dfg, domains, `Bin Op (${node.flavor})`)
	}

	exit(): AINodeStore {
		const lhs = this.domains.get(this.lhs)
		const rhs = this.domains.get(this.rhs)
		guard(lhs !== undefined, `No LHS found for assignment ${this.node.info.id}`)
		guard(rhs !== undefined, `No RHS found for assignment ${this.node.info.id}`)
		this.domains.updateWith(operators[this.node.flavor](lhs, rhs, this.node))
		return super.exit()
	}

	next(aiNodes: AINodeStore): void {
		super.next(aiNodes)
		if(this.lhs === undefined) {
			this.lhs = this.node.lhs.info.id
		} else if(this.rhs === undefined) {
			this.rhs = this.node.rhs.info.id
		} else {
			guard(false, `BinOp ${this.node.info.id} already has both LHS and RHS`)
		}
	}
}