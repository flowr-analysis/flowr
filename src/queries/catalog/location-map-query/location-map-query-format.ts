import type { BaseQueryFormat, BaseQueryResult } from '../../base-query-format';
import { executeLocationMapQuery } from './location-map-query-executor';
import { bold, type OutputFormatter } from '../../../util/ansi';
import { printAsMs } from '../../../util/time';
import Joi from 'joi';
import { summarizeIdsIfTooLong } from '../../query-print';
import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { SourceRange } from '../../../util/range';

export interface LocationMapQuery extends BaseQueryFormat {
	readonly type: 'location-map';
}

export type FileId = number & { readonly __fileId?: unique symbol };
export type FilePath = string & { readonly __filePath?: unique symbol };

export interface LocationMapQueryResult extends BaseQueryResult {
	readonly map: {
		files: Record<FileId, FilePath>;
		ids:   Record<NodeId, [FileId,SourceRange]>
	}
}

export const LocationMapQueryDefinition = {
	executor:        executeLocationMapQuery,
	asciiSummarizer: (formatter: OutputFormatter, _processed: unknown, queryResults: BaseQueryResult, result: string[]) => {
		const out = queryResults as LocationMapQueryResult;
		result.push(`Query: ${bold('location-map', formatter)} (${printAsMs(out['.meta'].timing, 0)})`);
		result.push('   ╰ File List:');
		for(const [id, file] of Object.entries(out.map.files)) {
			result.push(`      ╰ ${id}: \`${file}\``);
		}
		result.push(`   ╰ Id List: {${summarizeIdsIfTooLong(formatter, [...Object.keys(out.map.ids)])}}`);
		return true;
	},
	schema: Joi.object({
		type: Joi.string().valid('location-map').required().description('The type of the query.'),
	}).description('The location map query retrieves the location of every id in the ast.')
} as const;
