import type { BaseQueryFormat, BaseQueryResult } from '../../base-query-format';
import { executeLocationMapQuery } from './location-map-query-executor';
import { bold, type OutputFormatter } from '../../../util/ansi';
import { printAsMs } from '../../../util/time';
import Joi from 'joi';
import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { SourceRange } from '../../../util/range';
import { summarizeIdsIfTooLong } from '../../query-print';

export interface LocationMapQuery extends BaseQueryFormat {
	readonly type: 'location-map';
}

export interface LocationMapQueryResult extends BaseQueryResult {
	readonly map: Record<NodeId, SourceRange | undefined>;
}

export const LocationMapQueryDefinition = {
	executor:        executeLocationMapQuery,
	asciiSummarizer: (formatter: OutputFormatter, _processed: unknown, queryResults: BaseQueryResult, result: string[]) => {
		const out = queryResults as LocationMapQueryResult;
		result.push(`Query: ${bold('location-map', formatter)} (${printAsMs(out['.meta'].timing, 0)})`);
		result.push(`   ╰ Id List: {${summarizeIdsIfTooLong(formatter, [...Object.keys(out.map)])}}`);
		return true;
	},
	schema: Joi.object({
		type: Joi.string().valid('location-map').required().description('The type of the query.'),
	}).description('The id map query retrieves the location of every id in the ast.')
} as const;
