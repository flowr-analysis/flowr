import type { CallGraphQuery, CallGraphQueryResult } from './call-graph-query-format';
import { log } from '../../../util/log';
import type { BasicQueryData } from '../../base-query-format';
import { expandCallGraphLibraryInternals } from './expand-library-internals';
import { CallGraph } from '../../../dataflow/graph/call-graph';
import type { DataflowGraphVertexFunctionCall } from '../../../dataflow/graph/vertex';
import { VertexType } from '../../../dataflow/graph/vertex';
import { doesRelyOnCriteria } from '../call-context-query/call-context-query-executor';

/**
 * Executes the given call graph queries.
 */
export async function executeCallGraphQuery({ analyzer }: BasicQueryData, queries: readonly CallGraphQuery[]): Promise<CallGraphQueryResult> {
	if(queries.length !== 1) {
		log.warn('Call Graph query expects only up to one query, but got', queries.length);
	}
	const startTime = Date.now();
	const graph = await analyzer.callGraph();
	const expand = queries.some(q => q.expandLibraryInternals);
	const reliesOnCriteria = queries.filter(q => q.reliesOnCriteria).flatMap(q => q.reliesOnCriteria as (string | [string, string])[]);
	if(reliesOnCriteria){
		const dataflow = (await analyzer.dataflow());
		for(const c of graph.vertexIdsOfType(VertexType.FunctionCall)){
			const doesRely = doesRelyOnCriteria(reliesOnCriteria, graph.getVertex(c) as Required<DataflowGraphVertexFunctionCall>, dataflow)
			if(doesRely){
				//todo: write vertex into a new callGraph
				//todo: add outgoing edges / connected vertexes for this vertex from the old graph; overwrite old graph with new graph
			}
		}
	}
	return {
		'.meta': {
			timing: Date.now() - startTime
		},
		graph:       expand ? expandCallGraphLibraryInternals(graph, analyzer.inspectContext().deps) : graph,
		unreachable: queries.some(q => q.reportUnreachable) ? CallGraph.unreachableCalls(graph) : undefined
	};
}
