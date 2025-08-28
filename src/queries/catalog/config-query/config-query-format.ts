import type { BaseQueryFormat, BaseQueryResult } from '../../base-query-format';
import { executeConfigQuery } from './config-query-executor';
import { bold, type OutputFormatter } from '../../../util/text/ansi';
import { printAsMs } from '../../../util/text/time';
import Joi from 'joi';
import type { FlowrConfigOptions } from '../../../config';
import { jsonReplacer } from '../../../util/json';
import type { DeepPartial } from 'ts-essentials';

export interface ConfigQuery extends BaseQueryFormat {
    readonly type:    'config';
    readonly update?: DeepPartial<FlowrConfigOptions>
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
	}).description('The config query retrieves the current configuration of the flowR instance and optionally also updates it.'),
	flattenInvolvedNodes: () => []
} as const;
