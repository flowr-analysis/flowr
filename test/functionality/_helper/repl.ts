import type { FlowrConfigOptions } from '../../../src/config';
import { defaultConfigOptions } from '../../../src/config';
import type { CommandCompletions } from '../../../src/cli/repl/core';
import { assert, expect, test } from 'vitest';
import type { ReplOutput } from '../../../src/cli/repl/commands/repl-main';
import { standardReplOutput } from '../../../src/cli/repl/commands/repl-main';
import type { ParsedQueryLine } from '../../../src/queries/query';

export interface ReplParserTestCase {
	parser:        (output: ReplOutput, splitLine: readonly string[], config: FlowrConfigOptions) => ParsedQueryLine,
	label:         string,
	line:          readonly string[],
	config?:       object,
	expectedParse: ParsedQueryLine
}

export function assertReplParser({ label, parser, line, config = defaultConfigOptions, expectedParse }: ReplParserTestCase) {
	test(label, () => {
		const result = parser(standardReplOutput, line, config as FlowrConfigOptions);
		assert.deepEqual(result, expectedParse);
	});
}

export interface ReplCompletionTestCase {
	completer:           (splitLine: readonly string[], startingNewArg: boolean, config: FlowrConfigOptions) => CommandCompletions,
	label:               string,
	startingNewArg:      boolean,
	config?:             object,
	splitLine:           readonly string[],
	expectedCompletions: readonly string[]
}

export function assertReplCompletions({ completer, label, startingNewArg, splitLine, config = defaultConfigOptions, expectedCompletions }: ReplCompletionTestCase) {
	test(label, () => {
		const result = completer(splitLine, startingNewArg, config as FlowrConfigOptions);
		expect(result.completions).toEqual(expectedCompletions);
	});
}
