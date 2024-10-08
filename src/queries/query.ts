import type { CallContextQuery } from './catalog/call-context-query/call-context-query-format';
import type { DataflowGraph } from '../dataflow/graph/graph';
import type { BaseQueryFormat, BaseQueryResult } from './base-query-format';
import { executeCallContextQueries } from './catalog/call-context-query/call-context-query-executor';
import { guard } from '../util/assert';
import type { VirtualQueryArgumentsWithType } from './virtual-query/virtual-queries';
import { SupportedVirtualQueries } from './virtual-query/virtual-queries';
import type { Writable } from 'ts-essentials';
import type { VirtualCompoundConstraint } from './virtual-query/compound-query';
import type { NormalizedAst } from '../r-bridge/lang-4.x/ast/model/processing/decorate';
import { executeDataflowQuery } from './catalog/dataflow-query/dataflow-query-executor';
import type { DataflowQuery } from './catalog/dataflow-query/dataflow-query-format';
import { executeIdMapQuery } from './catalog/id-map-query/id-map-query-executor';
import type { IdMapQuery } from './catalog/id-map-query/id-map-query-format';
import { executeNormalizedAstQuery } from './catalog/normalized-ast-query/normalized-ast-query-executor';
import type {	NormalizedAstQuery } from './catalog/normalized-ast-query/normalized-ast-query-format';

export type Query = CallContextQuery | DataflowQuery | NormalizedAstQuery | IdMapQuery;

export type QueryArgumentsWithType<QueryType extends BaseQueryFormat['type']> = Query & { type: QueryType };

export interface BasicQueryData {
	readonly ast:   NormalizedAst;
	readonly graph: DataflowGraph;
}

/* Each executor receives all queries of its type in case it wants to avoid repeated traversal */
export type QueryExecutor<Query extends BaseQueryFormat, Result extends BaseQueryResult> = (data: BasicQueryData, query: readonly Query[]) => Result;

type SupportedQueries = {
	[QueryType in Query['type']]: QueryExecutor<QueryArgumentsWithType<QueryType>, BaseQueryResult>
}

export const SupportedQueries = {
	'call-context':   executeCallContextQueries,
	'dataflow':       executeDataflowQuery,
	'id-map':         executeIdMapQuery,
	'normalized-ast': executeNormalizedAstQuery
} as const satisfies SupportedQueries;

export type SupportedQueryTypes = keyof typeof SupportedQueries;
export type QueryResult<Type extends Query['type']> = ReturnType<typeof SupportedQueries[Type]>;

export function executeQueriesOfSameType<SpecificQuery extends Query>(data: BasicQueryData, ...queries: readonly SpecificQuery[]): QueryResult<SpecificQuery['type']> {
	guard(queries.length > 0, 'At least one query must be provided');
	/* every query must have the same type */
	guard(queries.every(q => q.type === queries[0].type), 'All queries must have the same type');
	const executor = SupportedQueries[queries[0].type];
	guard(executor !== undefined, `Unsupported query type: ${queries[0].type}`);
	return executor(data, queries as never) as QueryResult<SpecificQuery['type']>;
}

function isVirtualQuery<
	Base extends SupportedQueryTypes,
	VirtualArguments extends VirtualCompoundConstraint<Base> = VirtualCompoundConstraint<Base>
>(query: QueryArgumentsWithType<Base> | VirtualQueryArgumentsWithType<Base, VirtualArguments>): query is VirtualQueryArgumentsWithType<Base, VirtualArguments> {
	return SupportedVirtualQueries[query.type as keyof typeof SupportedVirtualQueries] !== undefined;
}

function groupQueriesByType<
	Base extends SupportedQueryTypes,
	VirtualArguments extends VirtualCompoundConstraint<Base> = VirtualCompoundConstraint<Base>
>(queries: readonly (QueryArgumentsWithType<Base> | VirtualQueryArgumentsWithType<Base, VirtualArguments>)[]): Record<Query['type'], Query[]> {
	const grouped: Record<Query['type'], Query[]> = {} as Record<Query['type'], Query[]>;
	function addQuery(query: Query) {
		if(grouped[query.type] === undefined) {
			grouped[query.type] = [];
		}
		grouped[query.type].push(query);
	}
	for(const query of queries) {
		if(isVirtualQuery(query)) {
			const executor = SupportedVirtualQueries[query.type];
			const subQueries = executor(query);
			for(const subQuery of subQueries) {
				addQuery(subQuery);
			}
		} else {
			addQuery(query);
		}
	}
	return grouped;
}

/* a record mapping the query type present to its respective result */
export type QueryResults<Base extends SupportedQueryTypes> = {
	readonly [QueryType in Base]: QueryResult<QueryType>
} & BaseQueryResult


type OmitFromValues<T, K extends string | number | symbol> = {
	[P in keyof T]?: Omit<T[P], K>
}

export type QueryResultsWithoutMeta<Queries extends Query> = OmitFromValues<Omit<QueryResults<Queries['type']>, '.meta'>, '.meta'>;

export type Queries<
	Base extends SupportedQueryTypes,
	VirtualArguments extends VirtualCompoundConstraint<Base> = VirtualCompoundConstraint<Base>
> = readonly (QueryArgumentsWithType<Base> | VirtualQueryArgumentsWithType<Base, VirtualArguments>)[];

export function executeQueries<
	Base extends SupportedQueryTypes,
	VirtualArguments extends VirtualCompoundConstraint<Base> = VirtualCompoundConstraint<Base>
>(data: BasicQueryData, queries: Queries<Base, VirtualArguments>): QueryResults<Base> {
	const now = Date.now();
	const grouped = groupQueriesByType(queries);
	const results = {} as Writable<QueryResults<Base>>;
	for(const type of Object.keys(grouped) as Base[]) {
		results[type] = executeQueriesOfSameType(data, ...grouped[type]) as QueryResults<Base>[Base];
	}
	results['.meta'] = {
		timing: Date.now() - now
	};
	return results as QueryResults<Base>;
}
