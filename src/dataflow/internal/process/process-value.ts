import { type DataflowInformation, ExitPointType } from '../../info';
import type { DataflowProcessorInformation } from '../../processor';
import type { RNodeWithParent } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { DataflowGraph } from '../../graph/graph';
import { VertexType } from '../../graph/vertex';
import { ReferenceType } from '../../environments/identifier';


/**
 *
 */
export function processValue<OtherInfo>({ info: { id } }: RNodeWithParent, { controlDependencies, completeAst: { idMap }, ctx: { env }, environment }: DataflowProcessorInformation<OtherInfo>): DataflowInformation {
	return {
		unknownReferences: [],
		in:                [{ nodeId: id, name: undefined, controlDependencies, type: ReferenceType.Constant }],
		out:               [],
		environment,
		graph:             new DataflowGraph(idMap).addVertex({
			tag: VertexType.Value,
			id:  id,
			cds: controlDependencies
		}, env.makeCleanEnv()),
		exitPoints: [{ nodeId: id, type: ExitPointType.Default, controlDependencies }],
		entryPoint: id
	};
}
