import { type DataflowInformation, ExitPointType } from '../../info';
import type { DataflowProcessorInformation } from '../../processor';
import { processValue } from './process-value';
import type { RSymbol } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { ParentInformation } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { RNa, RNull } from '../../../r-bridge/lang-4.x/convert-values';
import { DataflowGraph } from '../../graph/graph';
import { VertexType } from '../../graph/vertex';
import { ReferenceType } from '../../environments/identifier';


/**
 *
 */
export function processSymbol<OtherInfo>(symbol: RSymbol<OtherInfo & ParentInformation>, data: DataflowProcessorInformation<OtherInfo>): DataflowInformation {
	if(symbol.content === RNull || symbol.content === RNa) {
		return processValue(symbol, data);
	}

	return {
		unknownReferences: [ { nodeId: symbol.info.id, name: symbol.content, controlDependencies: data.controlDependencies, type: ReferenceType.Unknown } ],
		in:                [],
		out:               [],
		environment:       data.environment,
		graph:             new DataflowGraph(data.completeAst.idMap).addVertex({
			tag:                 VertexType.Use,
			id:                  symbol.info.id,
			controlDependencies: data.controlDependencies
		}, data.ctx.env.makeCleanEnv()),
		entryPoint: symbol.info.id,
		exitPoints: [{ nodeId: symbol.info.id, type: ExitPointType.Default, controlDependencies: data.controlDependencies }],
		hooks:      []
	};
}
