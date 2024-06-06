import { type DataflowInformation, ExitPointType } from '../../info'
import type { DataflowProcessorInformation } from '../../processor'
import type { RNodeWithParent } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate'
import { DataflowGraph } from '../../graph/graph'
import { VertexType } from '../../graph/vertex'
import { Domain } from '../../../abstract-interpretation/domain'
import { RType } from '../../../r-bridge/lang-4.x/ast/model/type'

export function processValue<OtherInfo>(value: RNodeWithParent, data: DataflowProcessorInformation<OtherInfo>): DataflowInformation {
	let domain: Domain | undefined
	switch(value.type) {
		case RType.Number: domain = Domain.fromScalar(value.content.num); break
		case RType.Logical: domain = value.content ? Domain.top() : Domain.bottom(); break
	}
	return {
		unknownReferences: [],
		in:                [{ nodeId: value.info.id, name: undefined, controlDependencies: data.controlDependencies }],
		out:               [],
		environment:       data.environment,
		graph:             new DataflowGraph(data.completeAst.idMap).addVertex({
			tag:                 VertexType.Value,
			id:                  value.info.id,
			value:               value.lexeme,
			controlDependencies: data.controlDependencies,
			domain:              domain
		}),
		exitPoints: [{ nodeId: value.info.id, type: ExitPointType.Default, controlDependencies: data.controlDependencies }],
		entryPoint: value.info.id,
		domain:     domain
	}
}
