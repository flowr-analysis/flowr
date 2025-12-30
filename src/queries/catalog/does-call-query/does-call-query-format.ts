import type { BaseQueryFormat, BaseQueryResult } from '../../base-query-format';
import { bold } from '../../../util/text/ansi';
import Joi from 'joi';
import type { QueryResults, SupportedQuery } from '../../query';
import { executeDoesCallQuery } from './does-call-query-executor';
import { type NodeId  } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { SingleSlicingCriterion } from '../../../slicing/criterion/parse';
import { formatRange } from '../../../util/mermaid/dfg';

interface CallsIdConstraint {
	readonly type: 'calls-id';
	/** The id of the function being called. */
	readonly id:   SingleSlicingCriterion;
}
interface CallsWithNameConstraint {
	readonly type:      'name';
	/** The name of the function being called. */
	readonly name:      string;
	/** Should we match the name exactly, or as a regex? */
	readonly nameExact: boolean;
}

interface CallsConstraints {
	readonly type:  'and' | 'or' | 'one-of';
	/* The constraints to combine. */
	readonly calls: readonly CallsConstraint[];
}

export type CallsConstraint = CallsIdConstraint | CallsWithNameConstraint | CallsConstraints;

/**
 * Either checks whether a given function calls another function matching the given constraints,
 * or returns all functions that call any function matching the given constraints.
 */
export interface DoesCallQuery extends BaseQueryFormat {
	readonly type:     'does-call';
	// this should be a unique id if you give multiple queries of this type, to identify them in the output
	readonly queryId?: string;
	readonly call:     SingleSlicingCriterion;
	readonly calls:    CallsConstraint;
}

export interface FindAllCallsResult {
	readonly call: NodeId
}

export interface DoesCallQueryResult extends BaseQueryResult {
	/** Results are either false (does not call) or an object with details on the calls made */
	readonly results: Record<string, FindAllCallsResult | false>;
}

// TODO: from line parser
// TODO: fix queries type with new knowledge on inferring T extends unknown[] to get a type per element!

export const DoesCallQueryDefinition = {
	executor:        executeDoesCallQuery,
	asciiSummarizer: async(formatter, processed, queryResults, result) => {
		const out = queryResults as QueryResults<'does-call'>['does-call'];
		result.push(`Query: ${bold('does-call', formatter)} (${out['.meta'].timing.toFixed(0)}ms)`);
		for(const [r, v] of Object.entries(out.results)) {
			const idMap = (await processed.normalize()).idMap;
			result.push(`  - ${bold(r, formatter)} found:`);
			if(v === false) {
				result.push('    - Does not call any matching functions.');
			} else {
				const loc = idMap.get(v.call)?.location ?? undefined;
				result.push(`    - Call ${bold(String(v.call), formatter)} (${formatRange(loc)})`);
			}
		}
		return true;
	},
	schema: Joi.object({
		type:    Joi.string().valid('does-call').required().description('The type of the query.'),
		queryId: Joi.string().optional().description('An optional unique identifier for this query, to identify it in the output.'),
		call:    Joi.string().description('The function from which calls are being made. This is a slicing criterion that resolves to a function definition node.'),
		calls:   Joi.object().required().description('The constraints on which functions are being called. This can be a combination of name-based or id-based constraints, combined with logical operators (and, or, one-of).')
	}).description('Either returns all function definitions alongside whether they are recursive, or just those matching the filters.'),
	flattenInvolvedNodes: (queryResults: BaseQueryResult): NodeId[] => {
		const out = queryResults as QueryResults<'does-call'>['does-call'];
		return Object.entries(out.results).flatMap(([, v]) => {
			return v !== false ? v.call : [];
		});
	}
} as const satisfies SupportedQuery<'does-call'>;
