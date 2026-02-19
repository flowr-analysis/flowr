import { type DataflowInformation, ExitPointType } from '../../info';
import type { DataflowProcessorInformation } from '../../processor';
import type { RNodeWithParent } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { DataflowGraph } from '../../graph/graph';
import { VertexType } from '../../graph/vertex';
import { ReferenceType } from '../../environments/identifier';
import type { REnvironmentInformation } from '../../environments/environment';


/**
 * Processes a value node in the AST for dataflow analysis.
 * For example, literals like numbers.
 */
export function processValue<OtherInfo>({ info: { id } }: RNodeWithParent, { cds, completeAst: { idMap }, environment }: DataflowProcessorInformation<OtherInfo>): DataflowInformation {
	return {
		unknownReferences: [],
		in:                [{ nodeId: id, name: undefined, cds, type: ReferenceType.Constant }],
		out:               [],
		environment,
		graph:             new DataflowGraph(idMap).addVertex({
			tag: VertexType.Value,
			id,
			cds
		}, undefined as unknown as REnvironmentInformation),
		exitPoints: [{ nodeId: id, type: ExitPointType.Default, cds }],
		entryPoint: id,
		hooks:      []
	};
}
