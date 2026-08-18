import type { InspectStrictnessQuery, InspectStrictnessQueryResult } from './inspect-strictness-query-format';
import type { BasicQueryData } from '../../base-query-format';
import { VertexType } from '../../../dataflow/graph/vertex';
import { strictnessOfFunctions } from '../../../dataflow/fn/strict-function';
import { QueryFunctionFilter } from '../../query-function-filter';

/**
 * Execute strictness inspection queries on the given analyzer.
 */
export async function executeStrictnessQuery({ analyzer }: BasicQueryData, queries: readonly InspectStrictnessQuery[]): Promise<InspectStrictnessQueryResult> {
	const start = Date.now();
	const filterFor = await QueryFunctionFilter.criteria(queries, analyzer);

	const graph = (await analyzer.dataflow()).graph;
	const fns = graph.verticesOfType(VertexType.FunctionDefinition)
		.filter(([id]) => QueryFunctionFilter.written(id))
		.filter(([id]) => filterFor.size === 0 || filterFor.has(id))
		.map(([id]) => id);

	return {
		'.meta': {
			timing: Date.now() - start
		},
		strictness: strictnessOfFunctions(fns, graph, analyzer.inspectContext())
	};
}
