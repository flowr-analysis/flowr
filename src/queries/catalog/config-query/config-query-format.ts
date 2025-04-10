import type { BaseQueryFormat, BaseQueryResult } from '../../base-query-format';
import { executeConfigQuery } from './config-query-executor';
import { bold, type OutputFormatter } from '../../../util/ansi';
import { printAsMs } from '../../../util/time';
import Joi from 'joi';
import type { FlowrConfigOptions } from '../../../config';
import { jsonReplacer } from '../../../util/json';

export interface ConfigQuery extends BaseQueryFormat {
	readonly type: 'config';
}

export interface ConfigQueryResult extends BaseQueryResult {
	readonly config: FlowrConfigOptions;
}


export const ConfigQueryDefinition = {
	executor:        executeConfigQuery,
	asciiSummarizer: (formatter: OutputFormatter, _processed: unknown, queryResults: BaseQueryResult, result: string[]) => {
		const out = queryResults as ConfigQueryResult;
		result.push(`Query: ${bold('config', formatter)} (${printAsMs(out['.meta'].timing, 0)})`);
		result.push(`   ╰ Config:\n${JSON.stringify(out.config, jsonReplacer, 4)}`);
		return true;
	},
	schema: Joi.object({
		type: Joi.string().valid('config').required().description('The type of the query.'),
	}).description('The config query retrieves the current configuration of the flowR instance.'),
	toSearchElements: () => []
} as const;
