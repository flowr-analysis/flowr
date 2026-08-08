import { afterAll, assert, describe, test } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { FlowrAnalyzerContext } from '../../../../src/project/context/flowr-analyzer-context';
import { FlowrConfig } from '../../../../src/config';
import { arraysGroupBy } from '../../../../src/util/collections/arrays';
import { FlowrAnalyzerDefaultProjectDiscoveryPlugin } from '../../../../src/project/plugins/project-discovery/flowr-analyzer-project-discovery-plugin';
import { isParseRequest } from '../../../../src/r-bridge/retriever';
import type { FlowrFile } from '../../../../src/project/context/flowr-file';

const roots: string[] = [];
afterAll(() => {
	for(const r of roots) {
		fs.rmSync(r, { recursive: true, force: true });
	}
});

function project(files: Record<string, string>): string {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), 'flowr-intel-'));
	roots.push(root);
	for(const [file, content] of Object.entries(files)) {
		const target = path.join(root, file);
		fs.mkdirSync(path.dirname(target), { recursive: true });
		fs.writeFileSync(target, content);
	}
	return root;
}

/** the root-relative posix paths the intelligent plugin discovers under `config` */
function discovered(root: string, config: FlowrConfig = FlowrConfig.default()): string[] {
	const plugin = new FlowrAnalyzerDefaultProjectDiscoveryPlugin();
	const ctx = new FlowrAnalyzerContext(config, arraysGroupBy([plugin], p => p.type));
	return plugin.processor(ctx, { request: 'project', content: root })
		.map(r => isParseRequest(r) && r.request === 'file' ? r.content : (r as FlowrFile<string>).path())
		.map(p => path.relative(root, p).replaceAll(path.sep, '/'))
		.sort();
}

const pkg = {
	'R/foo.R':                   'f <- function() 1',
	'R/bar.R':                   'g <- function() 2',
	'DESCRIPTION':               'Package: mypkg\nType: Package\nImports: dplyr\n',
	'NAMESPACE':                 'export(f)\n',
	'renv.lock':                 '{}',
	'tests/testthat/test-foo.R': 'test_that("x", { expect_true(TRUE) })',
	'vignettes/intro.Rmd':       'x <- 1',
	'man/f.Rd':                  '\\name{f}',
	'inst/extdata/big.bin':      'BINARY',
	'renv/library/foo/lib.R':    'ignored <- 1',
	'RtmpAB12/scratch.R':        'tmp <- 1',
	'README.md':                 '# readme'
};

describe('Default (scoped) project discovery', () => {
	test('a package keeps R sources, tests, vignettes and metadata but drops noise', () => {
		const got = discovered(project(pkg));
		assert.includeMembers(got, [
			'R/foo.R', 'R/bar.R', 'DESCRIPTION', 'NAMESPACE', 'renv.lock',
			'tests/testthat/test-foo.R', 'vignettes/intro.Rmd'
		], 'project sources + metadata are kept');
		for(const dropped of ['man/f.Rd', 'inst/extdata/big.bin', 'renv/library/foo/lib.R', 'RtmpAB12/scratch.R', 'README.md']) {
			assert.notInclude(got, dropped, `${dropped} is noise and must be dropped`);
		}
	});

	test('full mode collects everything, including the noise', () => {
		const full = FlowrConfig.amend(FlowrConfig.default(), c => {
			c.project.discovery = { full: true };
		});
		const got = discovered(project(pkg), full);
		// full mode keeps files the scoped default drops (renv/library stays excluded -- that is the legacy behavior)
		assert.includeMembers(got, ['man/f.Rd', 'inst/extdata/big.bin', 'README.md'],
			'full mode keeps files the scoped default drops');
	});

	test('perKind exclude overrides drop otherwise-kept files', () => {
		const config = FlowrConfig.amend(FlowrConfig.default(), c => {
			c.project.discovery = { perKind: { package: { exclude: ['tests/**'] } } };
		});
		const got = discovered(project(pkg), config);
		assert.notInclude(got, 'tests/testthat/test-foo.R', 'the per-kind exclude drops the tests directory');
		assert.includeMembers(got, ['R/foo.R'], 'unrelated files are still kept');
	});

	test('perKind include overrides keep otherwise-dropped files', () => {
		const root = project({ 'R/foo.R': 'x <- 1', 'notes/info.txt': 'hi' });
		const config = FlowrConfig.amend(FlowrConfig.default(), c => {
			c.project.discovery = { perKind: { script: { include: ['notes/**'] }, project: { include: ['notes/**'] } } };
		});
		const got = discovered(root, config);
		assert.include(got, 'notes/info.txt', 'the per-kind include keeps an otherwise-dropped file');
	});

	test('a shiny app keeps its entry files', () => {
		const root = project({
			'app.R':    'library(shiny)\nshinyApp(ui, server)',
			'R/mod.R':  'x <- 1',
			'data.csv': 'a,b'
		});
		const got = discovered(root);
		assert.includeMembers(got, ['app.R', 'R/mod.R']);
		assert.notInclude(got, 'data.csv');
	});
});
