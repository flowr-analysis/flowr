import { assert, describe, test } from 'vitest';
import { FlowrAnalyzerBuilder } from '../../../../src/project/flowr-analyzer-builder';
import { FlowrInlineTextFile } from '../../../../src/project/context/flowr-file';

/* windows joins paths with backslashes, so lookups must not depend on the separator a file was added with */
describe('file lookup is independent of the path separator', () => {
	const files = async(...paths: readonly string[]) => {
		const analyzer = await new FlowrAnalyzerBuilder().setEngine('tree-sitter').build();
		for(const p of paths) {
			analyzer.addFile(new FlowrInlineTextFile(p, 'x'));
		}
		return analyzer.inspectContext().files;
	};
	test('forward slashes looked up with backslashes', async() => {
		const ctx = await files('/pkg/R/survey.csv');
		assert.isTrue(ctx.hasCached('\\pkg\\R\\survey.csv'));
		assert.isDefined(ctx.getFileByPath('\\pkg\\R\\survey.csv'));
		assert.strictEqual(ctx.exists('\\pkg\\R\\Survey.csv', true), '/pkg/R/survey.csv');
	});
	test('backslashes looked up with forward slashes', async() => {
		const ctx = await files('C:\\pkg\\R\\survey.csv');
		assert.isTrue(ctx.hasCached('C:/pkg/R/survey.csv'));
		assert.strictEqual(ctx.exists('C:/pkg/R/SURVEY.csv', true), 'C:\\pkg\\R\\survey.csv');
	});
});
