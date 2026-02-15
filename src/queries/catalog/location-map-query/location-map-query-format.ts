import type { BaseQueryFormat, BaseQueryResult } from '../../base-query-format';
import { executeLocationMapQuery } from './location-map-query-executor';
import { bold, type OutputFormatter } from '../../../util/text/ansi';
import { printAsMs } from '../../../util/text/time';
import Joi from 'joi';
import { summarizeIdsIfTooLong } from '../../query-print';
import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { SourceRange } from '../../../util/range';
import type { SingleSlicingCriterion } from '../../../slicing/criterion/parse';
import type { ReplOutput } from '../../../cli/repl/commands/repl-main';
import type { FlowrConfigOptions } from '../../../config';
import type { ParsedQueryLine, SupportedQuery } from '../../query';
import { sliceCriteriaParser } from '../../../cli/repl/parser/slice-query-parser';

export interface LocationMapQuery extends BaseQueryFormat {
	readonly type: 'location-map';
	/** Optional list of ids to filter the results by. If not provided, all ids will be included. */
	readonly ids?: readonly SingleSlicingCriterion[];
}

export type FileId = number & { readonly __fileId?: unique symbol };
export type FilePath = string & { readonly __filePath?: unique symbol };

export interface LocationMapQueryResult extends BaseQueryResult {
	readonly map: {
		files: Record<FileId, FilePath>;
		ids:   Record<NodeId, [FileId, SourceRange]>
	}
}

function locationMapLineParser(_output: ReplOutput, line: readonly string[], _config: FlowrConfigOptions): ParsedQueryLine<'location-map'> {
	const criteria = sliceCriteriaParser(line[0]);
	return {
		query: {
			type: 'location-map',
			ids:  criteria
		},
		rCode: criteria ? line[1] : line[0]
	};
}

export const LocationMapQueryDefinition = {
	executor:        executeLocationMapQuery,
	asciiSummarizer: (formatter: OutputFormatter, _analyzer: unknown, queryResults: BaseQueryResult, result: string[]) => {
		const out = queryResults as LocationMapQueryResult;
		result.push(`Query: ${bold('location-map', formatter)} (${printAsMs(out['.meta'].timing, 0)})`);
		result.push('   ╰ File List:');
		for(const [id, file] of Object.entries(out.map.files)) {
			result.push(`      ╰ ${id}: \`${file}\``);
		}
		result.push(`   ╰ Id List: {${summarizeIdsIfTooLong(formatter, [...Object.keys(out.map.ids)])}}`);
		return true;
	},
	fromLine: locationMapLineParser,
	schema:   Joi.object({
		type: Joi.string().valid('location-map').required().description('The type of the query.'),
		ids:  Joi.array().items(Joi.string()).optional().description('Optional list of ids to filter the results by.')
	}).description('The location map query retrieves the location of every id in the ast.'),
	flattenInvolvedNodes: () => []
} as const satisfies SupportedQuery<'location-map'>;
