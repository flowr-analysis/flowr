import { type DataflowInformation } from '../../info'
import type { DataflowProcessorInformation } from '../../processor'
import { CONSTANT_NAME, DataflowGraph } from '../../graph'
import type { RNodeWithParent } from '../../../r-bridge'

export function processValue<OtherInfo>(value: RNodeWithParent, data: DataflowProcessorInformation<OtherInfo>): DataflowInformation {
	return {
		unknownReferences: [],
		in:                [{ nodeId: value.info.id, used: 'always', name: CONSTANT_NAME }],
		out:               [],
		environment:       data.environment,
		graph:             new DataflowGraph().addVertex({ tag: 'value', id: value.info.id, name: CONSTANT_NAME, value: value.content })
	}
}
