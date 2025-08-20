import type { BaseQueryFormat, BaseQueryResult } from '../../base-query-format';
import type { SingleSlicingCriterion } from '../../../slicing/criterion/parse';
import type { QueryResults, SupportedQuery } from '../../query';
import { bold } from '../../../util/text/ansi';
import { printAsMs } from '../../../util/text/time';
import Joi from 'joi';
import { executeDatatypeQuery } from './datatype-query-executor';
import type { DataType } from '../../../typing/types';
import { prettyPrintDataType } from '../../../typing/pretty-print';

/**
 * Calculates the inferred data type for the given criterion.
 */
export interface DatatypeQuery extends BaseQueryFormat {
	readonly type:              'datatype';
	readonly criteria?:         SingleSlicingCriterion[];
	readonly useSubtyping?:     boolean;
	readonly useTurcotteTypes?: boolean;
	readonly useTracedTypes?:   boolean;
	readonly outputFile?:       string;
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
			result.push(`   ╰ ${criterion}: {${prettyPrintDataType(inferredType)}}`);
		}
		return true;
	},
	flattenInvolvedNodes: () => {
		return [];
	},
	schema: Joi.object({
		type:             Joi.string().valid('datatype').required().description('The type of the query.'),
		criteria:         Joi.array().items(Joi.string()).optional().description('The slicing criteria of the node to get the inferred data type for.'),
		useSubtyping:     Joi.boolean().optional().default(true).description('Whether to use subtyping to infer the data type.'),
		useTurcotteTypes: Joi.boolean().optional().default(true).description('Whether to use Turcotte types for inference.'),
		useTracedTypes:   Joi.boolean().optional().default(true).description('Whether to use our manually traced types for inference.'),
		outputFile:       Joi.string().optional().description('The output file to write the inferred types to.')
	}).description('Datatype query used to extract the inferred data type for a node in the normalized AST')
} as const satisfies SupportedQuery<'datatype'>;
