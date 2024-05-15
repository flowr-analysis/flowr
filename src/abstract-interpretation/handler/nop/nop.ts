import {AINodeStore} from '../../ainode'
import {Handler} from '../handler'
import {DataflowInformation} from '../../../dataflow/internal/info'

export class Nop extends Handler {
	constructor(dfg: DataflowInformation, domains: AINodeStore) {
		super(dfg, domains, 'Base')
	}
}
