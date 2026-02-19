import type { QueryArgumentsWithType, SupportedQueryTypes } from '../query';
import { type CompoundQueryFormat, type VirtualCompoundConstraint, executeCompoundQueries } from './compound-query';
import type { BaseQueryFormat } from '../base-query-format';

/** A query that does not perform a search but may perform (e.g., convenience) modifications of other queries */
export type VirtualQueryArgumentsWithType<
	Base extends SupportedQueryTypes,
	VirtualArguments extends VirtualCompoundConstraint<Base> = VirtualCompoundConstraint<Base>
> = CompoundQueryFormat<Base, VirtualArguments>;


/* Each executor receives all queries of its type in case it wants to avoid repeated traversal */
export type VirtualQueryExecutor<Query extends BaseQueryFormat, Result extends BaseQueryFormat[]> = (query: Query) => Result;

type SupportedVirtualQueries = {
	[QueryType in VirtualQueryArgumentsWithType<SupportedQueryTypes>['type']]: VirtualQueryExecutor<QueryArgumentsWithType<QueryType>, BaseQueryFormat[]>
};

export const SupportedVirtualQueries = {
	'compound': executeCompoundQueries
} as const satisfies SupportedVirtualQueries;

export type SupportedVirtualQueryTypes = keyof typeof SupportedVirtualQueries;
