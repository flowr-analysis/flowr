import { assert, describe, test } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { handlePathLikeInput } from '../../../../src/cli/repl/path-input';
import { FlowrConfig } from '../../../../src/config';
import { voidFormatter } from '../../../../src/util/text/ansi';
import type { ReplOutput } from '../../../../src/cli/repl/commands/repl-main';

/** the resulting input and everything the repl printed for it */
function handle(input: string, autoUseFileProtocol: boolean): { input: string, out: string } {
	const lines: string[] = [];
	const output = { formatter: voidFormatter, stdout: (m: string) => lines.push(m), stderr: () => {} } as ReplOutput;
	const config = FlowrConfig.amend(FlowrConfig.default(), c => {
		c.repl.autoUseFileProtocol = autoUseFileProtocol;
	});
	return { input: handlePathLikeInput(output, input, config), out: lines.join('\n') };
}

describe('Repl autoUseFileProtocol', () => {
	test('it is on by default', () => {
		assert.isTrue(FlowrConfig.default().repl.autoUseFileProtocol);
	});

	test('disabled it only warns, naming the option', () => {
		const { input, out } = handle('./some/script.R', false);
		assert.strictEqual(input, './some/script.R', 'the input must not be rewritten');
		assert.include(out, 'file://./some/script.R');
		assert.include(out, 'repl.autoUseFileProtocol', 'the warning has to point at the option');
	});

	test('enabled it prepends the protocol and says so', () => {
		const { input, out } = handle('./some/script.R', true);
		assert.strictEqual(input, 'file://./some/script.R');
		assert.include(out, 'repl.autoUseFileProtocol');
	});

	test('an input that is no path is left alone in either state', () => {
		for(const prepend of [true, false]) {
			const { input, out } = handle('x <- 1', prepend);
			assert.strictEqual(input, 'x <- 1');
			assert.strictEqual(out, '', 'R code must not be commented on');
		}
	});

	test('an input that already carries the protocol is left alone', () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'flowr-prepend-'));
		try {
			const file = path.join(dir, 'a.R');
			fs.writeFileSync(file, 'x <- 1\n');
			const { input, out } = handle('file://' + file, true);
			assert.strictEqual(input, 'file://' + file);
			assert.strictEqual(out, '');
		} finally {
			fs.rmSync(dir, { recursive: true, force: true });
		}
	});
});
