import type { CallContextQuery } from './call-context-query/call-context-query-format';
import type { DataflowGraph } from '../dataflow/graph/graph';
import type { BaseQueryFormat, BaseQueryResult } from './base-query-format';
import { executeCallContextQueries } from './call-context-query/call-context-query-executor';
import { guard } from '../util/assert';

export type Query = CallContextQuery;

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

function groupQueriesByType<Base extends SupportedQueryTypes>(queries: readonly QueryWithType<Base>[]): Record<Query['type'], Query[]> {
	const grouped: Record<Query['type'], Query[]> = {} as Record<Query['type'], Query[]>;
	for(const query of queries) {
		if(grouped[query.type] === undefined) {
			grouped[query.type] = [];
		}
		grouped[query.type].push(query);
	}
	return grouped;
}

/* a record mapping the query type present to its respective result */
export type QueriesResult<Base extends SupportedQueryTypes> = {
	[QueryType in Base]: QueryResult<QueryType>
}

export function executeQueries<Base extends SupportedQueryTypes>(graph: DataflowGraph, queries: readonly QueryWithType<Base>[]): QueriesResult<Base> {
	const grouped = groupQueriesByType(queries);
	const results: QueriesResult<Base> = {} as QueriesResult<Base>;
	for(const type of Object.keys(grouped) as Base[]) {
		results[type] = executeQueriesOfSameType(graph, ...grouped[type]) as QueryResult<typeof type>;
	}
	return results;
}
