import { assert, describe, test } from 'vitest';
import { FlowrInlineTextFile } from '../../../../src/project/context/flowr-file';
import { FlowrRSessionFile } from '../../../../src/project/plugins/file-plugins/files/flowr-rsession-file';
import { FlowrAnalyzerRSessionFilePlugin } from '../../../../src/project/plugins/file-plugins/notebooks/flowr-analyzer-rsession-file-plugin';

describe('R-session-file', () => {
	const transcript = '> x <- c(1, 2)\n> report <- function(v) {\n+   mean(v)\n+ }\n> report(x)\n[1] 1.5\n';
	const file = FlowrRSessionFile.from(new FlowrInlineTextFile('t.Rout.save', transcript));
	test('the commands are the code, in the lines they were in', () => {
		assert.strictEqual(String(file.content()), '  x <- c(1, 2)\n  report <- function(v) {\n    mean(v)\n  }\n  report(x)\n# [1] 1.5\n');
	});
	test('records the output below each command', () => {
		assert.deepStrictEqual(file.recorded().map(r => r.output), ['', '', '[1] 1.5']);
	});
	test('the plugin picks up transcripts only', () => {
		const plugin = new FlowrAnalyzerRSessionFilePlugin();
		assert.isTrue(plugin.applies('a/test.Rout.save') && plugin.applies('b.Rout') && !plugin.applies('script.R'));
	});
});
