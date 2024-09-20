import type { CallContextQuery } from './call-context-query/call-context-query-format';
import type { DataflowGraph } from '../dataflow/graph/graph';
import type { BaseQueryFormat, BaseQueryResult } from './base-query-format';
import { executeCallContextQueries } from './call-context-query/call-context-query-executor';
import { guard } from '../util/assert';

export type Query = CallContextQuery;
export type Queries = Query[];

type QueryWithType<QueryType extends BaseQueryFormat['type']> = Query & { type: QueryType };

/* Each executor receives all queries of its type in case it wants to avoid repeated traversal */
export type QueryExecutor<Query extends BaseQueryFormat, Result extends BaseQueryResult<Query>> = (graph: DataflowGraph, query: Query[]) => Result;


type SupportedQueries = {
	[QueryType in Query['type']]: QueryExecutor<QueryWithType<QueryType>, BaseQueryResult<QueryWithType<QueryType>>>
}

export const SupportedQueries = {
	'call-context': executeCallContextQueries
} as const satisfies SupportedQueries;

export type SupportedQueryTypes = keyof typeof SupportedQueries;
export type QueryResult<Type extends Query['type']> = ReturnType<typeof SupportedQueries[Type]>;

export function executeQueriesOfSameType<SpecificQuery extends Query>(graph: DataflowGraph, ...queries: SpecificQuery[]): QueryResult<SpecificQuery['type']> {
	guard(queries.length > 0, 'At least one query must be provided');
	/* every query must have the same type */
	guard(queries.every(q => q.type === queries[0].type), 'All queries must have the same type');
	const executor = SupportedQueries[queries[0].type];
	guard(executor !== undefined, `Unsupported query type: ${queries[0].type}`);
	return executor(graph, queries) as QueryResult<SpecificQuery['type']>;
}

function groupQueriesByType(queries: Queries): Record<Query['type'], Query[]> {
	const grouped: Record<Query['type'], Query[]> = {} as Record<Query['type'], Query[]>;
	for(const query of queries) {
		if(grouped[query.type] === undefined) {
			grouped[query.type] = [];
		}
		grouped[query.type].push(query);
	}
	return grouped;
}

export function executeQueries<Base extends SupportedQueryTypes>(graph: DataflowGraph, queries: readonly [QueryWithType<Base>]): [QueryResult<Base>]
export function executeQueries<Base extends SupportedQueryTypes>(graph: DataflowGraph, queries: readonly QueryWithType<Base>[]): QueryResult<Base>[]
/* TODO: map query result to query type involved */
export function executeQueries<Base extends SupportedQueryTypes>(graph: DataflowGraph, queries: readonly QueryWithType<Base>[]): QueryResult<Base>[] {
	const grouped = groupQueriesByType(queries);
	return queries.map(query => executeQueriesOfSameType(graph, query));
	/** TODO: test instrumentation */
}
