import type { QueryWithType, SupportedQueryTypes } from '../query';
import type { CompoundQueryFormat } from './compound-query';
import { executeCompoundQueries } from './compound-query';
import type { BaseQueryFormat } from '../base-query-format';

/** A query that does not perform a search but may perform (e.g., convenience) modifications of other queries */
export type VirtualQuery<Base extends SupportedQueryTypes> = CompoundQueryFormat<Base>;


/* Each executor receives all queries of its type in case it wants to avoid repeated traversal */
export type VirtualQueryExecutor<Query extends BaseQueryFormat, Result extends BaseQueryFormat[]> = (query: Query) => Result;

type SupportedVirtualQueries = {
	[QueryType in VirtualQuery<SupportedQueryTypes>['type']]: VirtualQueryExecutor<QueryWithType<QueryType>, BaseQueryFormat[]>
}

export const SupportedVirtualQueries = {
	'compound': executeCompoundQueries
} as const satisfies SupportedVirtualQueries;
