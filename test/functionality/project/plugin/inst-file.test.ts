import { assert, describe, test } from 'vitest';
import { FlowrAnalyzerContext } from '../../../../src/project/context/flowr-analyzer-context';
import { arraysGroupBy } from '../../../../src/util/collections/arrays';
import { FileRole, FlowrInlineTextFile } from '../../../../src/project/context/flowr-file';
import { FlowrConfig } from '../../../../src/config';
import {
	FlowrAnalyzerMetaInstFilesPlugin
} from '../../../../src/project/plugins/file-plugins/flowr-analyzer-inst-file-plugin';


describe('Inst-file', function() {
	const ctx = new FlowrAnalyzerContext(
		FlowrConfig.default(),
		arraysGroupBy([
			new FlowrAnalyzerMetaInstFilesPlugin()
		], p => p.type)
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
