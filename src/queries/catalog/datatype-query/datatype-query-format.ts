import type { BaseQueryFormat, BaseQueryResult } from '../../base-query-format';
import type { SingleSlicingCriterion } from '../../../slicing/criterion/parse';
import type { QueryResults, SupportedQuery } from '../../query';
import { bold } from '../../../util/text/ansi';
import { printAsMs } from '../../../util/text/time';
import Joi from 'joi';
import { executeDatatypeQuery } from './datatype-query-executor';
import { asciiDataType } from '../../query-print';
import type { DataType } from '../../../typing/types';

/**
 * Calculates the inferred data type for the given criterion.
 */
export interface DatatypeQuery extends BaseQueryFormat {
	readonly type:          'datatype';
	readonly criterion?:    SingleSlicingCriterion;
	readonly useSubtyping?: boolean;
}

export interface DatatypeQueryResult extends BaseQueryResult {
	/** Maps each criterion to the inferred data type, duplicates are ignored. */
	readonly inferredTypes: Record<SingleSlicingCriterion, DataType>;
}

export const DatatypeQueryDefinition = {
	executor:        executeDatatypeQuery,
	asciiSummarizer: (formatter, _processed, queryResults, result) => {
		const out = queryResults as QueryResults<'datatype'>['datatype'];
		result.push(`Query: ${bold('datatype', formatter)} (${printAsMs(out['.meta'].timing, 0)})`);
		for(const [criterion, inferredType] of Object.entries(out.inferredTypes)) {
			result.push(`   ╰ ${criterion}: {${asciiDataType(inferredType)}}`);
		}
		return true;
	},
	flattenInvolvedNodes: () => {
		return [];
	},
	schema: Joi.object({
		type:         Joi.string().valid('datatype').required().description('The type of the query.'),
		criterion:    Joi.string().optional().description('The slicing criterion of the node to get the inferred data type for.'),
		useSubtyping: Joi.boolean().optional().default(false).description('Whether to use subtyping to infer the data type.'),
	}).description('Datatype query used to extract the inferred data type for a node in the normalized AST')
} as const satisfies SupportedQuery<'datatype'>;
