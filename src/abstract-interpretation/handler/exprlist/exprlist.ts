import {AINodeStore, mergeDomainStores} from '../../ainode'
import {Handler} from '../handler'
import {DataflowInformation} from '../../../dataflow/internal/info'

export class ExprList extends Handler {
	private exprList: AINodeStore = new AINodeStore()

	constructor(readonly dfg: DataflowInformation) {
		super(dfg, 'ExprList')
	}

	exit(): AINodeStore {
		return this.exprList
	}

	next(aiNodes: AINodeStore): void {
		this.exprList = mergeDomainStores(aiNodes, this.exprList)
	}
}
