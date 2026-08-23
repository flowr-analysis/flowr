import type { InspectArgRolesQuery, InspectArgRolesQueryResult } from './inspect-arg-roles-query-format';
import type { BasicQueryData } from '../../base-query-format';
import { VertexType } from '../../../dataflow/graph/vertex';
import { ArgumentRoles } from '../../../dataflow/fn/argument-roles';
import { FunctionProps } from '../../../dataflow/fn/function-props';
import { QueryFunctionFilter } from '../../query-function-filter';

/**
 * Execute argument-role inspection queries on the given analyzer.
 */
export async function executeArgRolesQuery({ analyzer }: BasicQueryData, queries: readonly InspectArgRolesQuery[]): Promise<InspectArgRolesQueryResult> {
	const start = Date.now();
	const filterFor = await QueryFunctionFilter.criteria(queries, analyzer);

	const ctx = analyzer.inspectContext();
	const graph = (await analyzer.dataflow()).graph;
	/* the vertex walk is a generator, and both answers below need the same definitions */
	const fns = graph.verticesOfType(VertexType.FunctionDefinition)
		.filter(([id]) => QueryFunctionFilter.written(id))
		.filter(([id]) => filterFor.size === 0 || filterFor.has(id))
		.map(([id]) => id).toArray();

	return {
		'.meta': {
			timing: Date.now() - start
		},
		roles: ArgumentRoles.of(fns, graph, { ctx, maxDepth: queries[0]?.maxDepth }),
		props: FunctionProps.of(fns, graph, ctx)
	};
}
