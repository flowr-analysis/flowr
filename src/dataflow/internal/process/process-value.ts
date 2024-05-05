import { type DataflowInformation, ExitPointType } from '../../info'
import type { DataflowProcessorInformation } from '../../processor'
import { CONSTANT_NAME, DataflowGraph, VertexType } from '../../graph'
import type { RNodeWithParent } from '../../../r-bridge'

export function processValue<OtherInfo>(value: RNodeWithParent, data: DataflowProcessorInformation<OtherInfo>): DataflowInformation {
	return {
		unknownReferences: [],
		in:                [{ nodeId: value.info.id, name: undefined, controlDependencies: data.controlDependencies }],
		out:               [],
		environment:       data.environment,
		graph:             new DataflowGraph().addVertex({
			tag:                 VertexType.Value,
			id:                  value.info.id,
			name:                CONSTANT_NAME,
			value:               value.lexeme,
			controlDependencies: data.controlDependencies
		}),
		exitPoints: [{ nodeId: value.info.id, type: ExitPointType.Default, controlDependencies: data.controlDependencies }],
		entryPoint: value.info.id
	}
}
