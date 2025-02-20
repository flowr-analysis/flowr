import type { DataflowLensQuery, DataflowLensQueryResult } from './dataflow-lens-query-format';
import { log } from '../../../util/log';
import type { BasicQueryData } from '../../base-query-format';
import { reduceDfg } from '../../../util/simple-df/dfg-view';
import { VertexType } from '../../../dataflow/graph/vertex';


export function executeDataflowLensQuery({ dataflow: { graph } }: BasicQueryData, queries: readonly DataflowLensQuery[]): DataflowLensQueryResult {
	if(queries.length !== 1) {
		log.warn('Dataflow query expects only up to one query, but got', queries.length);
	}

	const now = Date.now();
	const simplifiedGraph = reduceDfg(graph, {
		vertices: {
			keepEnv:           false,
			keepCd:            true,
			tags:              [VertexType.Use, VertexType.VariableDefinition, VertexType.FunctionDefinition, VertexType.FunctionCall],
			nameRegex:         '<-|<<-|->|->>|=|repeat|while|function|repeat|if|next|break',
			blacklistWithName: true
		}
	});

	const timing = Date.now() - now;
	return {
		'.meta': {
			timing
		},
		simplifiedGraph
	};
}
