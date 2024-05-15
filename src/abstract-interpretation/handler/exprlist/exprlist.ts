import {AINodeStore} from '../../ainode'
import {Handler} from '../handler'
import {DataflowInformation} from '../../../dataflow/internal/info'

export class ExprList extends Handler {
	constructor(dfg: DataflowInformation, domains: AINodeStore) {
		super(dfg, domains, 'ExprList')
	}
}
