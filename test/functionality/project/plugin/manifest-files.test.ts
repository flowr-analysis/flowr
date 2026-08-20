import { assert, describe, test } from 'vitest';
import { FlowrAnalyzerContext } from '../../../../src/project/context/flowr-analyzer-context';
import { FileRole, FlowrInlineTextFile } from '../../../../src/project/context/flowr-file';
import { FlowrConfig } from '../../../../src/config';
import {
	FlowrAnalyzerRProjectFilePlugin,
	FlowrAnalyzerUvrManifestFilePlugin
} from '../../../../src/project/plugins/file-plugins/flowr-analyzer-manifest-file-plugin';
import {
	FlowrRProjectFile,
	FlowrUvrManifestFile
} from '../../../../src/project/plugins/file-plugins/files/flowr-manifest-files';
import {
	FlowrAnalyzerMetaUvrManifestFilePlugin
} from '../../../../src/project/plugins/package-version-plugins/flowr-analyzer-meta-manifest-file-plugin';

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
			[new FlowrAnalyzerRProjectFilePlugin()]
		);
		ctx.addFile(new FlowrInlineTextFile('rproject.toml', content));
		const files = ctx.files.getFilesByRole(FileRole.Manifest);
		assert.lengthOf(files, 1);
		assert.instanceOf(files[0], FlowrRProjectFile);
		return files[0];
	}

	test('rproject.toml is tagged Manifest and lifted', () => {
		assert.instanceOf(fileWith(realistic), FlowrRProjectFile);
	});

	test('unrelated files are not tagged', () => {
		const ctx = new FlowrAnalyzerContext(
			FlowrConfig.default(),
			[new FlowrAnalyzerRProjectFilePlugin()]
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

/** a uvr.toml as uvr writes it */
const uvrManifest = `[project]
name = "sample-project"
r_version = ">=4.0.0"
description = "a sample"

[dependencies]
ggplot2 = ">=3.0.0"
dplyr = "*"
sf = { version = ">=1.0.0", bioc = false }
mine = { git = "user/repo", rev = "main" }

[dev-dependencies]
testthat = ">=3.0.0"
`;

describe('uvr.toml', () => {
	function ctxWith(content: string, name = 'uvr.toml'): FlowrAnalyzerContext {
		const ctx = new FlowrAnalyzerContext(
			FlowrConfig.default(),
			[new FlowrAnalyzerUvrManifestFilePlugin(), new FlowrAnalyzerMetaUvrManifestFilePlugin()]
		);
		ctx.addFile(new FlowrInlineTextFile(name, content));
		return ctx;
	}

	function fileWith(content: string): FlowrUvrManifestFile {
		const files = ctxWith(content).files.getFilesByRole(FileRole.Manifest);
		assert.lengthOf(files, 1);
		assert.instanceOf(files[0], FlowrUvrManifestFile);
		return files[0];
	}

	test('uvr.toml is tagged Manifest and lifted, rproject.toml is left to its own plugin', () => {
		assert.instanceOf(fileWith(uvrManifest), FlowrUvrManifestFile);
		assert.lengthOf(ctxWith('[project]\nname = "x"\n', 'rproject.toml').files.getFilesByRole(FileRole.Manifest), 0);
	});

	test('reads the name of the [project] table', () => {
		assert.strictEqual(fileWith(uvrManifest).projectName(), 'sample-project');
	});

	test('a requirement is no concrete r_version, a pin is', () => {
		assert.isUndefined(fileWith(uvrManifest).rVersion());
		assert.strictEqual(fileWith('[project]\nname = "x"\nr_version = "4.3.2"\n').rVersion(), '4.3.2');
	});

	test('reads bare and table dependencies, dev-dependencies separately', () => {
		const declares = fileWith(uvrManifest).declares();
		assert.deepStrictEqual(declares.imports?.map(d => d.name), ['ggplot2', 'dplyr', 'sf', 'mine']);
		assert.deepStrictEqual(declares.suggests?.map(d => d.name), ['testthat']);
	});

	test('a version requirement becomes a constraint, `*` does not', () => {
		const byName = new Map(fileWith(uvrManifest).declares().imports?.map(d => [d.name, d]));
		assert.strictEqual(byName.get('ggplot2')?.versionConstraints[0]?.raw, '>=3.0.0');
		assert.strictEqual(byName.get('sf')?.versionConstraints[0]?.raw, '>=1.0.0');
		assert.lengthOf(byName.get('dplyr')?.versionConstraints ?? [], 0);
		assert.lengthOf(byName.get('mine')?.versionConstraints ?? [], 0, 'a git source states no version');
	});

	test('an array is no dependency table', () => {
		// its indices would pass as package names
		assert.deepStrictEqual(fileWith('dependencies = ["a", "b"]\n\n[project]\nname = "x"\n').declares().imports, []);
	});

	test('a broken toml yields no fields rather than throwing', () => {
		const file = fileWith('[project\nname = "x"');
		assert.isUndefined(file.projectName());
		assert.deepStrictEqual(file.declares(), { imports: [], suggests: [] });
	});

	test('a missing [project] table yields no fields', () => {
		const file = fileWith('[dependencies]\nggplot2 = "*"\n');
		assert.isUndefined(file.projectName());
		assert.isUndefined(file.rVersion());
		assert.deepStrictEqual(file.declares().imports?.map(d => d.name), ['ggplot2']);
	});

	test('the meta plugin contributes name and dependencies', () => {
		const ctx = ctxWith(uvrManifest);
		assert.strictEqual(ctx.meta.getProjectName(), 'sample-project');
		assert.isUndefined(ctx.meta.getNamespace(), 'a uvr project is no package');
		assert.sameMembers(ctx.deps.getDependencies().map(d => d.name), ['ggplot2', 'dplyr', 'sf', 'mine']);
		assert.deepStrictEqual(ctx.meta.getDeclaredPackages().suggests?.map(d => d.name), ['testthat']);
	});
});
