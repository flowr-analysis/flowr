import { assert, describe, test } from 'vitest';
import { masterScriptArgs } from '../../../../src/cli/repl/commands/repl-commands';
import { slicerOptions } from '../../../../src/cli/common/options';
import { FlowrConfig } from '../../../../src/config';

describe('Master scripts forward the repl config', () => {
	test(':slicer receives the repl\'s live config via --config-json', () => {
		const config = FlowrConfig.amend(FlowrConfig.default(), c => {
			c.ignoreSourceCalls = true;
		});
		const args = masterScriptArgs('-c "1@x" foo.R', config, slicerOptions);
		const idx = args.indexOf('--config-json');
		assert.isAbove(idx, -1, '--config-json must be appended');
		assert.deepStrictEqual(JSON.parse(args[idx + 1]), JSON.parse(JSON.stringify(config)));
	});

	test('an explicitly passed --config-file is not overridden', () => {
		const args = masterScriptArgs('-c "1@x" --config-file my.json foo.R', FlowrConfig.default(), slicerOptions);
		assert.notInclude(args, '--config-json');
	});

	test('a script without a config-json option is left untouched', () => {
		const args = masterScriptArgs('example.json', FlowrConfig.default(), [{ name: 'input', type: String }]);
		assert.notInclude(args, '--config-json');
	});
});
