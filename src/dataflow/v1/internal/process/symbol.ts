import type { ParentInformation, RSymbol } from '../../../../r-bridge'
import { RNa, RNull } from '../../../../r-bridge'
import { DataflowGraph } from '../../graph'
import { initializeCleanDataflowInformation, type DataflowInformation } from '../info'
import type { DataflowProcessorInformation } from '../../processor'

export function processSymbol<OtherInfo>(symbol: RSymbol<OtherInfo & ParentInformation>, data: DataflowProcessorInformation<OtherInfo>): DataflowInformation {
	if(symbol.content === RNull || symbol.content === RNa) {
		return initializeCleanDataflowInformation(data)
	}

	return {
		unknownReferences: [ { nodeId: symbol.info.id, scope: data.activeScope, name: symbol.content, used: 'always' } ],
		in:                [],
		out:               [],
		environments:      data.environments,
		scope:             data.activeScope,
		graph:             new DataflowGraph().addVertex({ tag: 'use', id: symbol.info.id, name: symbol.content, environment: data.environments })
	}
}
