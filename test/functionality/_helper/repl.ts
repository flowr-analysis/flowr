import type { FlowrConfigOptions } from '../../../src/config';
import { defaultConfigOptions } from '../../../src/config';
import type { CommandCompletions } from '../../../src/cli/repl/core';
import { expect, test } from 'vitest';

export function assertReplCompletions(
	completer: (splitLine: readonly string[], startingNewArg: boolean, config: FlowrConfigOptions) => CommandCompletions,
	label: string,
	startingNewArg: boolean,
	splitLine: readonly string[],
	expectedCompletions: readonly string[]
) {
	test(label, () => {
		const result = completer(splitLine, startingNewArg, defaultConfigOptions);
		expect(result.completions).toEqual(expectedCompletions);
	});
}
