import type { BaseQueryFormat, BaseQueryResult } from '../../base-query-format';
import { executeDataColumnsQuery } from './data-columns-query-executor';
import type { OutputFormatter } from '../../../util/text/ansi';
import { bold, italic } from '../../../util/text/ansi';
import Joi from 'joi';
import { queryHeader } from '../../query-print';
import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { ReplOutput } from '../../../cli/repl/commands/repl-main';
import type { FlowrConfig } from '../../../config';
import type { ParsedQueryLine, SupportedQuery } from '../../query';
import { criteriaQueryCompleter, queryLineCode, sliceCriteriaParser } from '../../../cli/repl/parser/slice-query-parser';

/**
 * Asks which columns of a data frame can be written at a position of the code, as an editor offers them to complete:
 * after `df$` or `df[["`, and in every argument a call evaluates within its data, as `filter(penguins, bi)`,
 * `penguins |> mutate(r = bi)`, `subset(mtcars, mpg > 20)`, `with(iris, ...)`, or `ggplot(penguins, aes(x = bi))`.
 */
export interface DataColumnsQuery extends BaseQueryFormat {
	readonly type:      'data-columns';
	/**
	 * The positions to ask about, as `line:column` (both starting at 1) of the cursor, which may stand just past the
	 * name typed so far. The position has to fall within a node: an editor completing nothing typed yet inserts a
	 * placeholder name there first, as `filter(penguins, )` is no different from `filter(penguins)`.
	 */
	readonly positions: readonly string[];
	/** The file the positions are in, as flowR names it, if the analysis holds more than one. */
	readonly file?:     string;
}

/** How the columns can be written at the position. */
export enum DataColumnsContext {
	/** as the name accessed of a data frame, `df$col` or `df[["col"]]` */
	Access = 'access',
	/** as a name a call evaluates within its data, `filter(df, col > 1)` */
	Masked = 'masked'
}

/** One data frame whose columns can be written at a position. */
export interface DataColumnsFrame {
	/** the node of the data frame, e.g. the `penguins` of `filter(penguins, ...)` */
	readonly id:      NodeId
	/** the code of the node, if it has any of its own */
	readonly lexeme?: string
	/** the columns it surely has */
	readonly must:    readonly string[]
	/** the columns it may have as well */
	readonly may:     readonly string[]
	/** whether it has no other columns than these */
	readonly exact:   boolean
}

/** The columns that can be written at one position. */
export interface DataColumnsAt {
	/** how the columns are written there, absent where no data frame is in reach */
	readonly context?: DataColumnsContext
	/** every column of the {@link frames}, those they surely have first */
	readonly columns:  readonly string[]
	readonly frames:   readonly DataColumnsFrame[]
}

export interface DataColumnsQueryResult extends BaseQueryResult {
	/** the columns at each position asked about, by the position as given */
	readonly results: Record<string, DataColumnsAt>;
}

function dataColumnsLineParser(_output: ReplOutput, line: readonly string[], _config: FlowrConfig): ParsedQueryLine<'data-columns'> {
	const positions = sliceCriteriaParser(line[0]);
	return {
		query: { type: 'data-columns', positions: positions ?? [] },
		rCode: queryLineCode(line, positions ? 1 : 0)
	};
}

export const DataColumnsQueryDefinition = {
	title:           'Data Columns Query',
	executor:        executeDataColumnsQuery,
	asciiSummarizer: (formatter: OutputFormatter, _analyzer: unknown, queryResults: BaseQueryResult, result: string[]) => {
		const out = queryResults as DataColumnsQueryResult;
		result.push(queryHeader('data-columns', formatter, out['.meta'].timing));
		for(const [position, at] of Object.entries(out.results)) {
			if(at.context === undefined) {
				result.push(`   ╰ ${bold(position, formatter)}: ${italic('no data frame in reach', formatter)}`);
				continue;
			}
			const frames = at.frames.map(f => f.lexeme ?? String(f.id)).join(', ');
			result.push(`   ╰ ${bold(position, formatter)} (${at.context} of ${frames}): ${at.columns.join(', ')}`);
		}
		return true;
	},
	fromLine:  dataColumnsLineParser,
	completer: criteriaQueryCompleter,
	syntax:    '@data-columns (<line:col>;...) <code | file://path>',
	schema:    Joi.object({
		type:      Joi.string().valid('data-columns').required().description('The type of the query.'),
		positions: Joi.array().items(Joi.string().pattern(/^\d+:\d+$/)).min(1).required().description('The positions to ask about, as `line:column` of the cursor.'),
		file:      Joi.string().optional().description('The file the positions are in, if the analysis holds more than one.')
	}).description('The data columns query returns the columns of a data frame that can be written at a position, after `df$` or within the arguments a call evaluates within its data.'),
	flattenInvolvedNodes: (queryResults: BaseQueryResult): NodeId[] => {
		return Object.values((queryResults as DataColumnsQueryResult).results).flatMap(at => at.frames.map(f => f.id));
	}
} as const satisfies SupportedQuery<'data-columns'>;
