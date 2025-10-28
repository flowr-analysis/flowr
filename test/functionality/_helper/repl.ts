import type { FlowrConfigOptions } from '../../../src/config';
import { defaultConfigOptions } from '../../../src/config';
import type { CommandCompletions } from '../../../src/cli/repl/core';
import { expect, test } from 'vitest';

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
