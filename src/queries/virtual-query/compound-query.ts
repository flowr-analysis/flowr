import type { QueryArgumentsWithType, SupportedQueryTypes } from '../query';
import type { BaseQueryFormat } from '../base-query-format';
import type { StrictOmit } from 'ts-essentials';

/** @see CompoundQueryFormat */
export type VirtualCompoundConstraint<SubQueryType extends SupportedQueryTypes> = keyof StrictOmit<QueryArgumentsWithType<SubQueryType>, 'type'>

/**
 * Virtual Query Format.
 * Grouping query parameters of the same type (re-specified in the `query` field).
 */
export interface CompoundQueryFormat<
	/* The queries we collect, locked by `query` demanding a single type */
	SubQueryType extends SupportedQueryTypes,
	/* arguments we give which are common for all queries */
	CommonArguments extends VirtualCompoundConstraint<SubQueryType>
> extends BaseQueryFormat {
	readonly type:            'compound';
	readonly query:           SubQueryType;
	/** defaults to use the same arguments for all queries */
	readonly commonArguments: Pick<QueryArgumentsWithType<SubQueryType>, CommonArguments>;
	/**
	 * You do not have to re-state the type, this is automatically filled with the type for 'query'
	 * Additionally all arguments given in `commonArguments` are now enforced optional.
	 */
	readonly arguments:       ReadonlyArray<StrictOmit<
		StrictOmit<QueryArgumentsWithType<SubQueryType>, 'type'>,
		CommonArguments /* we cannot use mark optional / some-partial constructions here as it trips up the type checker, hence we work around by union inclusion */
	> & Partial<QueryArgumentsWithType<SubQueryType>>>;
}

/**
 * Execute a single, virtual compound query in terms of unfolding the contained queries.
 */
export function executeCompoundQueries<
	SubQueryType extends SupportedQueryTypes,
	CommonArguments extends VirtualCompoundConstraint<SubQueryType> = VirtualCompoundConstraint<SubQueryType>
>(
	query: CompoundQueryFormat<SubQueryType, CommonArguments>
): QueryArgumentsWithType<SubQueryType>[] {
	const results: QueryArgumentsWithType<SubQueryType>[] = [];
	for(const arg of query.arguments) {
		results.push({
			type: query.query,
			...query.commonArguments,
			...arg
		} as unknown as QueryArgumentsWithType<SubQueryType>);
	}
	return results;
}

