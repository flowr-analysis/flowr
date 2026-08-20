import type { BaseQueryFormat, BaseQueryResult } from '../../base-query-format';
import { executeLocationMapQuery } from './location-map-query-executor';
import { bold, type OutputFormatter } from '../../../util/text/ansi';
import { printAsMs } from '../../../util/text/time';
import Joi from 'joi';
import { summarizeIdsIfTooLong } from '../../query-print';
import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { SourceRange } from '../../../util/range';
import type { SlicingCriterion } from '../../../slicing/criterion/parse';
import type { ReplOutput } from '../../../cli/repl/commands/repl-main';
import type { FlowrConfig } from '../../../config';
import type { ParsedQueryLine, SupportedQuery } from '../../query';
import { criteriaQueryCompleter, queryLineCode, sliceCriteriaParser } from '../../../cli/repl/parser/slice-query-parser';

/**
 * How much of the source an entry of the {@link LocationMapQueryResult} covers: the `<-` of a multi-line
 * assignment is a single `token`, while its subtree (`full`) is the whole assignment.
 */
export enum LocationMapSpan {
	/** the location of the node itself, which for an operator or a call name is just that token */
	Token     = 'token',
	/** the range the whole subtree of the node covers, see {@link RNode.span} */
	Full      = 'full',
	/** the {@link Full} range of the top-level statement the node belongs to, see {@link RNode.topLevelStatement} */
	Statement = 'statement'
}

export interface LocationMapQuery extends BaseQueryFormat {
	readonly type:  'location-map';
	/** Optional list of ids to filter the results by. If not provided, all ids will be included. */
	readonly ids?:  readonly SlicingCriterion[];
	/** How much of the source the reported range covers, {@link LocationMapSpan.Token} by default. */
	readonly span?: LocationMapSpan;
}

export type FileId = number & { readonly __fileId?: unique symbol };
export type FilePath = string & { readonly __filePath?: unique symbol };

export interface LocationMapQueryResult extends BaseQueryResult {
	readonly map: {
		files: Record<FileId, FilePath>;
		ids:   Record<NodeId, [FileId, SourceRange]>
	}
}

function locationMapLineParser(_output: ReplOutput, line: readonly string[], _config: FlowrConfig): ParsedQueryLine<'location-map'> {
	const criteria = sliceCriteriaParser(line[0]);
	const rest = criteria ? line.slice(1) : line;
	const span = (Object.values(LocationMapSpan) as string[]).includes(rest[0]) ? rest[0] as LocationMapSpan : undefined;
	return {
		query: {
			type: 'location-map',
			ids:  criteria,
			...(span ? { span } : {})
		},
		rCode: queryLineCode(rest, span ? 1 : 0)
	};
}

export const LocationMapQueryDefinition = {
	title:           'Location Map Query',
	executor:        executeLocationMapQuery,
	asciiSummarizer: (formatter: OutputFormatter, _analyzer: unknown, queryResults: BaseQueryResult, result: string[]) => {
		const out = queryResults as LocationMapQueryResult;
		result.push(`Query: ${bold('location-map', formatter)} (${printAsMs(out['.meta'].timing, 0)})`);
		result.push('   ╰ File List:');
		for(const [id, file] of Object.entries(out.map.files)) {
			result.push(`      ╰ ${id}: \`${file}\``);
		}
		result.push(`   ╰ Id List: {${summarizeIdsIfTooLong(formatter, Object.keys(out.map.ids))}}`);
		return true;
	},
	fromLine:  locationMapLineParser,
	completer: criteriaQueryCompleter,
	syntax:    '@location-map [(<crit>;...)] [token|full|statement] <code | file://path>',
	schema:    Joi.object({
		type: Joi.string().valid('location-map').required().description('The type of the query.'),
		ids:  Joi.array().items(Joi.string()).optional().description('Optional list of ids to filter the results by.'),
		span: Joi.string().valid(...Object.values(LocationMapSpan)).optional().description('How much of the source the reported range covers: the token itself (default), the whole subtree of the node, or the top-level statement it belongs to.')
	}).description('The location map query retrieves the location of every id in the ast.'),
	flattenInvolvedNodes: () => []
} as const satisfies SupportedQuery<'location-map'>;
