import {AINodeStore} from '../../ainode'
import {Handler} from '../handler'
import {DataflowInformation} from '../../../dataflow/internal/info'

export class Nop extends Handler {
	constructor(readonly dfg: DataflowInformation, readonly domains: AINodeStore) {
		super(dfg, domains, 'Base')
	}

	exit(): AINodeStore {
		return new AINodeStore()
	}

	next(aiNodes: AINodeStore): AINodeStore {
		return aiNodes
	}
}
