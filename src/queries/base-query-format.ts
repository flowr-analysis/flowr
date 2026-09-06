import type { ReadonlyFlowrAnalysisProvider } from '../project/flowr-analyzer';
import type { ReplOutput } from '../cli/repl/commands/repl-main';
import type { FlowrConfig } from '../config';
import { queryLineCode, sliceCriteriaParser } from '../cli/repl/parser/slice-query-parser';
import { ColorEffect, Colors, FontStyles } from '../util/text/ansi';
import type { ParsedQueryLine } from './query';

export interface BaseQueryFormat {
	/** used to select the query type :) */
	readonly type: string;
}

export interface BaseQueryMeta {
	/** Duration in milliseconds */
	readonly timing: number;
}
export interface BaseQueryResult {
	readonly '.meta': BaseQueryMeta;
}

export interface BasicQueryData {
	readonly analyzer: ReadonlyFlowrAnalysisProvider;
}

/** {@link SupportedQuery#fromLine} for a query whose only argument is an optional multi-criterion `filter` */
export function filterLineParser<T extends string>(type: T) {
	return function(_output: ReplOutput, line: readonly string[], _config: FlowrConfig): ParsedQueryLine<T> {
		const criteria = sliceCriteriaParser(line[0]);
		return {
			query: { type, filter: criteria } as ParsedQueryLine<T>['query'],
			rCode: queryLineCode(line, criteria ? 1 : 0)
		};
	};
}

/** {@link SupportedQuery#fromLine} for a query keyed by a single slicing criterion, erroring (naming the query as `label`) when it is missing */
export function singleCriterionLineParser<T extends string>(type: T, label: string, extra?: (line: readonly string[]) => Record<string, unknown>) {
	return function(output: ReplOutput, line: readonly string[], _config: FlowrConfig): ParsedQueryLine<T> {
		const criterion = sliceCriteriaParser(line[0]);
		const fields = extra?.(line);
		if(!criterion || criterion.length !== 1) {
			output.stderr(output.formatter.format(`Invalid ${label} query format, a single slicing criterion must be given in the form "(criterion1)"`,
				{ color: Colors.Red, effect: ColorEffect.Foreground, style: FontStyles.Bold }));
			return { query: [] };
		}
		return {
			query: [{ type, criterion: criterion[0], ...fields }] as ParsedQueryLine<T>['query'],
			rCode: queryLineCode(line)
		};
	};
}
