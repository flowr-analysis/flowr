import type { QueryWithType, SupportedQueryTypes } from '../query';
import type { BaseQueryFormat } from '../base-query-format';

/**
 * Virtual Query Format.
 * Grouping query parameters of the same type (re-specified in the `query` field).
 */
export interface CompoundQueryFormat<SubQueryType extends Exclude<SupportedQueryTypes, 'compound'>> extends BaseQueryFormat {
	readonly type:      'compound';
	readonly query:     SubQueryType;
	/** you do not have to re-state the type, this is automatically filled with 'query' */
	readonly arguments: readonly Omit<QueryWithType<SubQueryType>, 'type'>[];
}

export function executeCompoundQueries<SubQueryType extends Exclude<SupportedQueryTypes, 'compound'>>(query: CompoundQueryFormat<SubQueryType>): QueryWithType<SubQueryType>[] {
	const results: QueryWithType<SubQueryType>[] = [];
	for(const arg of query.arguments) {
		results.push({
			type: query.query,
			...arg
		} as QueryWithType<SubQueryType>);
	}
	return results;
}
