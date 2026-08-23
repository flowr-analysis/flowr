import type { InspectArgRolesQuery, InspectArgRolesQueryResult } from './inspect-arg-roles-query-format';
import type { BasicQueryData } from '../../base-query-format';
import { VertexType } from '../../../dataflow/graph/vertex';
import { ArgumentRoles } from '../../../dataflow/fn/argument-roles';
import { QueryFunctionFilter } from '../../query-function-filter';

/**
 * Execute argument-role inspection queries on the given analyzer.
 */
export async function executeArgRolesQuery({ analyzer }: BasicQueryData, queries: readonly InspectArgRolesQuery[]): Promise<InspectArgRolesQueryResult> {
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
		roles: ArgumentRoles.of(fns, graph, { ctx: analyzer.inspectContext(), maxDepth: queries[0]?.maxDepth })
	};
}
