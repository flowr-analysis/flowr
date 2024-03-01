import type { ParentInformation, RSymbol } from '../../../r-bridge'
import { RNa, RNull } from '../../../r-bridge'
import type { DataflowProcessorInformation } from './processor'
import { DataflowGraph } from '../../common/graph'
import type { DataflowInformation } from '../../common/info'
import { initializeCleanDataflowInformation } from '../../common/info'

export function processSymbol<OtherInfo>(symbol: RSymbol<OtherInfo & ParentInformation>, data: DataflowProcessorInformation<OtherInfo>): DataflowInformation {
	if(symbol.content === RNull || symbol.content === RNa) {
		return initializeCleanDataflowInformation(data)
	}

	return {
		unknownReferences: [ { nodeId: symbol.info.id, name: symbol.content, used: 'always' } ],
		in:                [],
		out:               [],
		environments:      data.environments,
		graph:             new DataflowGraph().addVertex({ tag: 'use', id: symbol.info.id, name: symbol.content, environment: data.environments })
	}
}
