import { type DataflowInformation, ExitPointType } from '../../info';
import type { DataflowProcessorInformation } from '../../processor';
import type { RNodeWithParent } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { DataflowGraph } from '../../graph/graph';
import { VertexType } from '../../graph/vertex';
import { ReferenceType } from '../../environments/identifier';


/**
 *
 */
export function processValue<OtherInfo>({ info: { id } }: RNodeWithParent, data: DataflowProcessorInformation<OtherInfo>): DataflowInformation {
	return {
		unknownReferences: [],
		in:                [{ nodeId: id, name: undefined, controlDependencies: data.controlDependencies, type: ReferenceType.Constant }],
		out:               [],
		environment:       data.environment,
		graph:             new DataflowGraph(data.completeAst.idMap).addVertex({
			tag: VertexType.Value,
			id:  id,
			cds: data.controlDependencies
		}, data.ctx.env.getCleanEnv()),
		exitPoints: [{ nodeId: id, type: ExitPointType.Default, controlDependencies: data.controlDependencies }],
		entryPoint: id
	};
}
