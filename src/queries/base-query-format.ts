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
export function filterLineParser<T extends string>(type: T, key = 'filter') {
	return function(_output: ReplOutput, line: readonly string[], _config: FlowrConfig): ParsedQueryLine<T> {
		const criteria = sliceCriteriaParser(line[0]);
		return {
			query: { type, [key]: criteria } as ParsedQueryLine<T>['query'],
			rCode: queryLineCode(line, criteria ? 1 : 0)
		};
	};
}

/** Reports a malformed query line (with optional unformatted `details`), yielding no query. */
export function invalidQueryLine<T extends string>(output: ReplOutput, message: string, details?: string): ParsedQueryLine<T> {
	output.stderr(output.formatter.format(message, { color: Colors.Red, effect: ColorEffect.Foreground, style: FontStyles.Bold }));
	if(details !== undefined) {
		output.stderr(details);
	}
	return { query: [] };
}

/** {@link SupportedQuery#fromLine} for a query keyed by a single slicing criterion, erroring (naming the query as `label`) when it is missing */
export function singleCriterionLineParser<T extends string>(type: T, label: string, extra?: (line: readonly string[]) => Record<string, unknown>) {
	return function(output: ReplOutput, line: readonly string[], _config: FlowrConfig): ParsedQueryLine<T> {
		const criterion = sliceCriteriaParser(line[0]);
		if(!criterion || criterion.length !== 1) {
			return invalidQueryLine(output, `Invalid ${label} query format, a single slicing criterion must be given in the form "(criterion1)"`);
		}
		return {
			query: [{ type, criterion: criterion[0], ...extra?.(line) }] as ParsedQueryLine<T>['query'],
			rCode: queryLineCode(line)
		};
	};
}
