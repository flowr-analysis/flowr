import { assert, describe, test } from 'vitest';
import { label } from '../../_helper/label';
import { FlowrAnalyzerContext } from '../../../../src/project/context/flowr-analyzer-context';
import { FileRole, FlowrInlineTextFile } from '../../../../src/project/context/flowr-file';
import { FlowrConfig } from '../../../../src/config';
import {
	FlowrAnalyzerRigProjectFilePlugin,
	FlowrAnalyzerRProjectFilePlugin,
	FlowrAnalyzerUvrManifestFilePlugin
} from '../../../../src/project/plugins/file-plugins/flowr-analyzer-manifest-file-plugin';
import {
	FlowrRigProjectFile,
	FlowrRProjectFile,
	FlowrUvrManifestFile,
	rigScriptManifest
} from '../../../../src/project/plugins/file-plugins/files/flowr-manifest-files';
import {
	FlowrAnalyzerMetaRigProjectFilePlugin,
	FlowrAnalyzerMetaRigScriptPlugin,
	FlowrAnalyzerMetaUvrManifestFilePlugin
} from '../../../../src/project/plugins/package-version-plugins/flowr-analyzer-meta-manifest-file-plugin';
import { FlowrAnalyzerRmdFilePlugin } from '../../../../src/project/plugins/file-plugins/notebooks/flowr-analyzer-rmd-file-plugin';

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

/** a rig script as `rig proj init --script` and `rig proj add --script` leave it, see `src/script_meta.rs` of rig */
const rigScript = `#!/usr/bin/env -S rig run
# /// script
# [dependencies]
# R = ">= 4.4"
# cli = "*"
# dplyr = ">= 1.1"
# vctrs = ">= 0.4-9, < 1.0"
# mine = { git = "https://github.com/me/mine", ref = "main" }
#
# [[repository]]
# name = "ppm"
# url = "https://p3m.dev/cran/latest"
#
# [tool.rig]
# exclude-newer = "7 days"
# ///

library(dplyr)
`;

describe('rig', () => {
	const names = (pkgs: readonly { name: string }[] | undefined) => pkgs?.map(p => p.name);
	const declared = (code: string) => rigScriptManifest(code, 'script.R')?.declares();
	const block = (...body: string[]) => ['# /// script', ...body.map(l => `# ${l}`), '# ///'].join('\n') + '\n';

	describe(label('inline script block', ['version-manager-rig'], ['other']), () => {
		test('reads packages and the R requirement', () => {
			const d = declared(rigScript);
			assert.deepStrictEqual(names(d?.imports), ['cli', 'dplyr', 'vctrs', 'mine']);
			assert.deepStrictEqual(names(d?.depends), ['R'], 'R is no package, it is required like a DESCRIPTION Depends');
			assert.deepStrictEqual(d?.suggests, []);
		});

		test('requirements become constraints, `*`, a git source and the R requirement pin nothing', () => {
			const m = rigScriptManifest(rigScript, 'script.R');
			const byName = new Map(m?.declares().imports?.map(p => [p.name, p]));
			assert.strictEqual(byName.get('dplyr')?.versionConstraints[0]?.range, '>=1.1.0');
			assert.strictEqual(byName.get('vctrs')?.versionConstraints[0]?.range, '>=0.4.9 <1.0.0', 'a comma joins requirements');
			assert.lengthOf(byName.get('cli')?.versionConstraints ?? [], 0);
			assert.lengthOf(byName.get('mine')?.versionConstraints ?? [], 0);
			assert.isUndefined(m?.rVersion());
			assert.strictEqual(rigScriptManifest(block('[dependencies]', 'R = "4.4.1"'), 'a.R')?.rVersion(), '4.4.1');
		});

		test.each([
			['without a shebang', block('[dependencies]', 'cli = "*"') + 'x <- 1\n'],
			['with `##` as the marker', '## /// script\n## [dependencies]\n## cli = "*"\n## ///\n'],
			['without the space after the marker', '# /// script\n#[dependencies]\n#cli = "*"\n# ///\n'],
			['with CRLF line endings', '# /// script\r\n# [dependencies]\r\n# cli = "*"\r\n# ///\r\n'],
			['after code, as rig looks for it anywhere', 'x <- 1\n' + block('[dependencies]', 'cli = "*"')],
			['after leading comments and blank lines', '\n# analysis of x\n\n' + block('[dependencies]', 'cli = "*"')]
		])('a block %s declares its packages', (_, code) => {
			assert.deepStrictEqual(names(declared(code)?.imports), ['cli']);
		});

		test.each([
			['a block never closed', '# /// script\n# [dependencies]\n# cli = "*"\n'],
			['a block left by a code line', '# /// script\n# [dependencies]\ncli <- "*"\n# ///\n'],
			['a block closed by another marker', '## /// script\n## [dependencies]\n## cli = "*"\n# ///\n'],
			['two blocks', block('[dependencies]', 'cli = "*"') + block('[dependencies]', 'dplyr = "*"')],
			['an indented opener', '  # /// script\n# [dependencies]\n# cli = "*"\n# ///\n'],
			['an opener without its space', '# ///script\n# [dependencies]\n# cli = "*"\n# ///\n'],
			['another block type', '# /// scripts\n# [dependencies]\n# cli = "*"\n# ///\n'],
			['a table rig does not allow in a script', block('[dependencies]', 'cli = "*"', '[dependency-groups.dev]', 'testthat = "*"')],
			['broken toml', block('[dependencies', 'cli = "*"')],
			['an empty file', '']
		])('%s declares nothing, as rig refuses or ignores it', (_, code) => {
			assert.isUndefined(rigScriptManifest(code, 'script.R'));
		});

		test('an empty block or an array declares no package', () => {
			assert.deepStrictEqual(names(declared(block())?.imports), []);
			assert.deepStrictEqual(names(declared(block('dependencies = ["cli"]'))?.imports), []);
		});

		function ctxWith(name: string, content: string): FlowrAnalyzerContext {
			const ctx = new FlowrAnalyzerContext(FlowrConfig.default(), [new FlowrAnalyzerRmdFilePlugin(), new FlowrAnalyzerMetaRigScriptPlugin()]);
			ctx.addFile(new FlowrInlineTextFile(name, content));
			return ctx;
		}

		test('the plugin contributes the packages of a script', () => {
			assert.sameMembers(ctxWith('script.R', rigScript).deps.getDependencies().map(d => d.name), ['R', 'cli', 'dplyr', 'vctrs', 'mine']);
		});

		test('a block in the code of a notebook counts, its markdown does not', () => {
			const rmd = '---\ntitle: x\n---\n\n# /// script\n\n```{r}\nx <- 1\n```\n\n```{r}\n' + block('[dependencies]', 'psych = ">= 2.0"') + 'library(psych)\n```\n';
			assert.deepStrictEqual(ctxWith('report.Rmd', rmd).deps.getDependencies().map(d => d.name), ['psych']);
		});
	});

	describe(label('rproj.toml', ['version-manager-rig'], ['other']), () => {
		function ctxWith(content: string, name = 'rproj.toml'): FlowrAnalyzerContext {
			const ctx = new FlowrAnalyzerContext(FlowrConfig.default(), [new FlowrAnalyzerRigProjectFilePlugin(), new FlowrAnalyzerMetaRigProjectFilePlugin()]);
			ctx.addFile(new FlowrInlineTextFile(name, content));
			return ctx;
		}
		const manifest = `[project]
name = "sample"
version = "0.1.0"

[dependencies]
R = ">= 4.5"
ggplot2 = ">= 3.5"
extra = { version = "*", enhances = true }

[linking-dependencies]
cpp11 = "*"

[optional-dependencies.plot]
plotly = "*"

[dependency-groups.dev]
include-groups = ["test"]
devtools = "*"

[dependency-groups.test]
testthat = "^3.0.0"

[tool.rig]
r-versions = ["4.5"]
`;

		test('rproj.toml is tagged Manifest and lifted, the others are left to their own plugin', () => {
			assert.instanceOf(ctxWith(manifest).files.getFilesByRole(FileRole.Manifest)[0], FlowrRigProjectFile);
			assert.lengthOf(ctxWith(manifest, 'rproject.toml').files.getFilesByRole(FileRole.Manifest), 0);
		});

		test('groups the declared packages as a DESCRIPTION does', () => {
			const d = ctxWith(manifest).meta.getDeclaredPackages();
			assert.deepStrictEqual(names(d.depends), ['R']);
			assert.deepStrictEqual(names(d.imports), ['ggplot2']);
			assert.deepStrictEqual(names(d.enhances), ['extra']);
			assert.deepStrictEqual(names(d.linkingTo), ['cpp11']);
			assert.sameMembers(names(d.suggests) ?? [], ['plotly', 'devtools', 'testthat'], 'include-groups names groups, no package');
		});

		test('the meta plugin contributes the name and what is needed to run the project', () => {
			const ctx = ctxWith(manifest);
			assert.strictEqual(ctx.meta.getProjectName(), 'sample');
			assert.isUndefined(ctx.meta.getNamespace(), 'a rig project is no package');
			assert.isUndefined(ctx.meta.getRVersion(), 'a requirement pins no R version');
			assert.sameMembers(ctx.deps.getDependencies().map(d => d.name), ['R', 'ggplot2']);
		});
	});
});
