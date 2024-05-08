import type { ParentInformation, RSymbol } from '../../../r-bridge'
import { RNa, RNull } from '../../../r-bridge'
import { DataflowGraph, VertexType } from '../../graph'
import { type DataflowInformation, ExitPointType } from '../../info'
import type { DataflowProcessorInformation } from '../../processor'
import { processValue } from './process-value'

export function processSymbol<OtherInfo>(symbol: RSymbol<OtherInfo & ParentInformation>, data: DataflowProcessorInformation<OtherInfo>): DataflowInformation {
	if(symbol.content === RNull || symbol.content === RNa) {
		return processValue(symbol, data)
	}

	return {
		unknownReferences: [ { nodeId: symbol.info.id, name: symbol.content, controlDependencies: data.controlDependencies } ],
		in:                [],
		out:               [],
		environment:       data.environment,
		graph:             new DataflowGraph().addVertex({
			tag:                 VertexType.Use,
			id:                  symbol.info.id,
			controlDependencies: data.controlDependencies
		}),
		entryPoint: symbol.info.id,
		exitPoints: [{ nodeId: symbol.info.id, type: ExitPointType.Default, controlDependencies: data.controlDependencies }]
	}
}
