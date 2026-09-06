import { FlowrConfig } from '../../../src/config';
import type { CommandCompletions } from '../../../src/cli/repl/core';
import { assert, expect, test } from 'vitest';
import { type ReplOutput, standardReplOutput } from '../../../src/cli/repl/commands/repl-main';
import type { ParsedQueryLine } from '../../../src/queries/query';
import type { BaseQueryFormat } from '../../../src/queries/base-query-format';

// A ReplOutput that discards all output
export const discardingReplOutput: ReplOutput = {
	formatter: standardReplOutput.formatter,
	stdout:    () => {},
	stderr:    () => {}
};

export interface ReplParserTestCase<QueryType extends BaseQueryFormat['type']> {
	parser:        (output: ReplOutput, splitLine: readonly string[], config: FlowrConfig) => ParsedQueryLine<QueryType>,
	label:         string,
	line:          readonly string[],
	config?:       object,
	expectedParse: ParsedQueryLine<QueryType>
}


/**
 * Asserts that the REPL parses `line` into the expected query.
 * @param testCase - what to parse, with what, and what to expect
 */
export function assertReplParser<QueryType extends BaseQueryFormat['type']>({ label, parser, line, config = FlowrConfig.default(), expectedParse }: ReplParserTestCase<QueryType>) {
	test(label, () => {
		const result = parser(discardingReplOutput, line, config as FlowrConfig);
		assert.deepEqual(result, expectedParse);
	});
}

export interface ReplCompletionTestCase {
	completer:           (splitLine: readonly string[], startingNewArg: boolean, config: FlowrConfig) => CommandCompletions,
	label:               string,
	startingNewArg:      boolean,
	config?:             object,
	splitLine:           readonly string[],
	expectedCompletions: readonly string[]
}


/**
 * Asserts that the REPL completes a partial line into the expected candidates.
 * @param testCase - what to complete, with what, and what to expect
 */
export function assertReplCompletions({ completer, label, startingNewArg, splitLine, config = FlowrConfig.default(), expectedCompletions }: ReplCompletionTestCase) {
	test(label, () => {
		const result = completer(splitLine, startingNewArg, config as FlowrConfig);
		expect(result.completions).toEqual(expectedCompletions);
	});
}
