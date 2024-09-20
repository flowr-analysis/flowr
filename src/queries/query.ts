import type { CallContextQueryFormat } from './call-context-query/call-context-query-format';
import type { DataflowGraph } from '../dataflow/graph/graph';
import type { BaseQueryFormat, BaseQueryResult } from './base-query-format';
import { executeCallContextQuery } from './call-context-query/call-context-query-executor';
import { guard } from '../util/assert';

export type Query = CallContextQueryFormat;
export type Queries = Query[];

type QueryWithType<QueryType extends BaseQueryFormat['type']> = Query & { type: QueryType };

export type QueryExecutor<Query extends BaseQueryFormat, Result extends BaseQueryResult<Query>> = (graph: DataflowGraph, query: Query) => Result;


type SupportedQueries = {
	[QueryType in Query['type']]: QueryExecutor<QueryWithType<QueryType>, BaseQueryResult<QueryWithType<QueryType>>>
}

export const SupportedQueries = {
	'call-context': executeCallContextQuery
} as const satisfies SupportedQueries;

export type QueryResult<Type extends Query['type']> = ReturnType<SupportedQueries[Type]>;


export function executeQuery<SpecificQuery extends Query>(graph: DataflowGraph, query: SpecificQuery): QueryResult<SpecificQuery['type']> {
	const executor = SupportedQueries[query.type];
	guard(executor !== undefined, `Unsupported query type: ${query.type}`);
	return executor(graph, query);
}

export function executeQueries(graph: DataflowGraph, queries: Queries): BaseQueryResult<Query>[] {
	return queries.map(query => executeQuery(graph, query));
	/** TODO: test instrumentation */
}
