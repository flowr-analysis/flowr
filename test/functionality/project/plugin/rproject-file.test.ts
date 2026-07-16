import { assert, describe, test } from 'vitest';
import { FlowrAnalyzerContext } from '../../../../src/project/context/flowr-analyzer-context';
import { arraysGroupBy } from '../../../../src/util/collections/arrays';
import { FileRole, FlowrInlineTextFile } from '../../../../src/project/context/flowr-file';
import { FlowrConfig } from '../../../../src/config';
import {
	FlowrAnalyzerRProjectFilePlugin
} from '../../../../src/project/plugins/file-plugins/flowr-analyzer-rproject-file-plugin';
import { FlowrRProjectFile } from '../../../../src/project/plugins/file-plugins/files/flowr-rproject-file';

/** an rproject.toml as rv writes it, with the inline tables and comments that break a naive regex */
const realistic = `[project]
# Note: do not update the lockfile from this project
name = "package-upgrade"
r_version = "4.5"

repositories = [
    { alias = "RSPM", url = "https://packagemanager.posit.co/cran/2025-01-01" },
]

dependencies = [
    "R6",
    { name = "ggplot2", repository = "new-rspm" },
]
`;

describe('rproject.toml', () => {
	function fileWith(content: string): FlowrRProjectFile {
		const ctx = new FlowrAnalyzerContext(
			FlowrConfig.default(),
			arraysGroupBy([new FlowrAnalyzerRProjectFilePlugin()], p => p.type)
		);
		ctx.addFile(new FlowrInlineTextFile('rproject.toml', content));
		const files = ctx.files.getFilesByRole(FileRole.Manifest);
		assert.lengthOf(files, 1);
		return files[0];
	}

	test('rproject.toml is tagged Manifest and lifted', () => {
		assert.instanceOf(fileWith(realistic), FlowrRProjectFile);
	});

	test('unrelated files are not tagged', () => {
		const ctx = new FlowrAnalyzerContext(
			FlowrConfig.default(),
			arraysGroupBy([new FlowrAnalyzerRProjectFilePlugin()], p => p.type)
		);
		ctx.addFile(new FlowrInlineTextFile('project.toml', ''));
		ctx.addFile(new FlowrInlineTextFile('DESCRIPTION', ''));
		assert.lengthOf(ctx.files.getFilesByRole(FileRole.Manifest), 0);
	});

	test('reads the name and the r_version of the [project] table', () => {
		const file = fileWith(realistic);
		assert.strictEqual(file.projectName(), 'package-upgrade');
		assert.strictEqual(file.rVersion(), '4.5');
	});

	test('reads plain and table dependencies', () => {
		assert.deepStrictEqual(fileWith(realistic).dependencies().map(d => d.name), ['R6', 'ggplot2']);
	});

	test('a `name` inside dependencies is no project name', () => {
		// a regex over the file would take the first `name =` it finds, which is the one of the dependency
		const file = fileWith('[project]\ndependencies = [\n    { name = "ggplot2" },\n]\nname = "real"\n');
		assert.strictEqual(file.projectName(), 'real');
	});

	test('an r_version in a template string is no r_version', () => {
		const file = fileWith('[project]\nname = "x"\nr_version = "4.5"\nlibrary = "libs/{r_version}/{name}"\n');
		assert.strictEqual(file.rVersion(), '4.5');
	});

	test('a broken toml yields no fields rather than throwing', () => {
		const file = fileWith('[project\nname = "x"');
		assert.isUndefined(file.projectName());
		assert.deepStrictEqual(file.dependencies(), []);
	});

	test('a missing [project] table yields no fields', () => {
		const file = fileWith('[other]\nname = "x"\n');
		assert.isUndefined(file.projectName());
		assert.isUndefined(file.rVersion());
	});
});
