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
 * Process a symbol node in the AST for dataflow analysis.
 * If the symbol is `NULL` or `NA`, it is processed as a value.
 * Otherwise, it is treated as an unknown reference.
 * TODO: also check againts currnt namespace anme in context to still resolve ggplot2::... in the ggplot2 namespace etc.
 */
export function processSymbol<OtherInfo>(symbol: RSymbol<OtherInfo & ParentInformation>, data: DataflowProcessorInformation<OtherInfo>): DataflowInformation {
	if(symbol.content === RNull || symbol.content === RNa) {
		return processValue(symbol, data);
	}

	return {
		unknownReferences: [ { nodeId: symbol.info.id, name: symbol.ns ? symbol.ns + '::' + symbol.content : symbol.content, cds: data.cds, type: ReferenceType.Unknown } ],
		in:                [],
		out:               [],
		environment:       data.environment,
		graph:             new DataflowGraph(data.completeAst.idMap).addVertex({
			tag: VertexType.Use,
			id:  symbol.info.id,
			cds: data.cds
		}, data.ctx.env.makeCleanEnv()),
		entryPoint: symbol.info.id,
		exitPoints: [{ nodeId: symbol.info.id, type: ExitPointType.Default, cds: data.cds }],
		hooks:      []
	};
}
