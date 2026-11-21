import { assert, describe, test } from 'vitest';
import { FlowrAnalyzerContext } from '../../../../src/project/context/flowr-analyzer-context';
import { FileRole, FlowrInlineTextFile } from '../../../../src/project/context/flowr-file';
import { FlowrConfig } from '../../../../src/config';
import {
	FlowrAnalyzerMetaInstFilesPlugin
} from '../../../../src/project/plugins/file-plugins/flowr-analyzer-inst-file-plugin';
import { FlowrAnalyzerMetaTestFilesPlugin } from '../../../../src/project/plugins/file-plugins/flowr-analyzer-test-file-plugin';
import { FlowrAnalyzerMetaVignetteFilesPlugin } from '../../../../src/project/plugins/file-plugins/flowr-analyzer-vignette-file-plugin';


describe('Inst-file', function() {
	const ctx = new FlowrAnalyzerContext(
		FlowrConfig.default(),
		[
			new FlowrAnalyzerMetaInstFilesPlugin()
		]
	);

	ctx.addFile(new FlowrInlineTextFile('inst/REFERENCES.R', 'x <- 2'));
	ctx.addFile(new FlowrInlineTextFile('R/foo.R', 'y <- 3'));

	test('Installed file gets the Installed role', () => {
		const files = ctx.files.getFilesByRole(FileRole.Install);
		assert.lengthOf(files, 1, 'There should be exactly one Installed file');
		assert.strictEqual(files[0].path(), 'inst/REFERENCES.R');
	});

	test('Installed file still gets the Source role', () => {
		const files = ctx.files.getFilesByRole(FileRole.Source);
		assert.includeMembers(
			files.map(f => f.path()),
			['inst/REFERENCES.R'],
			'The installed R file should also be a Source file'
		);
	});

	test('A normal R source file does not get the Installed role', () => {
		const files = ctx.files.getFilesByRole(FileRole.Install);
		assert.notIncludeMembers(
			files.map(f => f.path()),
			['R/foo.R'],
			'A normal R/foo.R file should not be marked as Installed'
		);
	});
});

describe('Folder roles match whole path segments only', () => {
	for(const [plugin, matched, unmatched] of [
		[new FlowrAnalyzerMetaTestFilesPlugin(), ['pkg/tests/a.R', 'tests/testthat/test-a.R', 'pkg/inst/tests/a.R', 'C:\\pkg\\tests\\a.R'], ['/tmp/test-workspace/pkg/R/f.R', '/home/u/contests/f.R', 'pkg/R/tests.R', 'pkg/latest/f.R']],
		[new FlowrAnalyzerMetaVignetteFilesPlugin(), ['pkg/vignettes/intro.Rmd', 'C:\\pkg\\vignettes\\intro.Rmd'], ['/home/u/vignettes-draft/pkg/R/f.R', 'pkg/R/vignette.R']]
	] as const) {
		test(plugin.name, () => {
			for(const path of matched) {
				assert.isTrue(plugin.applies(path), path);
			}
			for(const path of unmatched) {
				assert.isFalse(plugin.applies(path), path);
			}
		});
	}
});
