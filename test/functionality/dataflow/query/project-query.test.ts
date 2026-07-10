import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { withTreeSitter } from '../../_helper/shell';
import { label } from '../../_helper/label';
import { FlowrAnalyzerBuilder } from '../../../../src/project/flowr-analyzer-builder';
import { FlowrConfig } from '../../../../src/config';
import { FlowrAnalyzerPackageVersionsPkgDbPlugin, PkgDbPluginName } from '../../../../src/project/plugins/package-version-plugins/flowr-analyzer-package-versions-pkgdb-plugin';
import { PkgDatabase } from '../../../../src/project/plugins/package-version-plugins/pkgdb';
import { buildPkgDbFromInstalled, readInstalledPackages } from '../../../../src/project/plugins/package-version-plugins/pkgdb-local';
import { executeQueries } from '../../../../src/queries/query';
import { asciiSummaryOfQueryResult } from '../../../../src/queries/query-print';
import { ansiFormatter } from '../../../../src/util/text/ansi';
import type { TreeSitterExecutor } from '../../../../src/r-bridge/lang-4.x/tree-sitter/tree-sitter-executor';
import fs from 'fs';
import os from 'os';
import path from 'path';

/** in-memory database exporting a couple of symbols for cli and ggplot2 */
function db(): PkgDatabase {
	return PkgDatabase.fromObject({
		format:  'flowr-pkgdb',
		schema:  4,
		scope:   'latest',
		content: { version: 1, date: '2026-05-23', hash: 'x', generated: 0, packages: 2, versions: 2 },
		strings: [],
		pkgs:    {
			cli:     ['3.6.0', ['cli_alert']],
			ggplot2: ['3.5.1', ['ggplot', 'aes', 'geom_point']]
		}
	});
}

function writePackage(root: string, pkgName: string, description: string, code: string): string {
	const dir = fs.mkdtempSync(path.join(root, pkgName + '-'));
	fs.writeFileSync(path.join(dir, 'DESCRIPTION'), `Package: ${pkgName}\n${description}`);
	fs.mkdirSync(path.join(dir, 'R'));
	fs.writeFileSync(path.join(dir, 'R', 'foo.R'), code);
	return dir;
}

async function analyzeProject(parser: TreeSitterExecutor, dir: string, config?: FlowrConfig) {
	const builder = new FlowrAnalyzerBuilder().setParser(parser)
		.unregisterPlugins(PkgDbPluginName)
		.registerPlugins(new FlowrAnalyzerPackageVersionsPkgDbPlugin(db()));
	if(config) {
		builder.setConfig(config);
	}
	const analyzer = await builder.build();
	analyzer.addRequest('file://' + dir);
	return analyzer;
}

describe.sequential('Project Query', withTreeSitter(parser => {
	let tmp: string;
	beforeAll(() => {
		tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'flowr-project-query-'));
	});
	afterAll(() => {
		fs.rmSync(tmp, { recursive: true, force: true });
	});

	test(label('reports dependency statistics from the DESCRIPTION file', [], ['other']), async() => {
		const dir = writePackage(tmp, 'mypkg',
			'Version: 1.2.3\nDepends: R (>= 4.0.0), methods\nImports: cli, ggplot2, notarealpkg\nSuggests: testthat, knitr\nLinkingTo: Rcpp\n',
			'library(ggplot2)\nfoo <- function(x) ggplot(x)\n');
		const analyzer = await analyzeProject(parser, dir);

		const results = await executeQueries({ analyzer }, [{ type: 'project' }]);
		const project = results.project;
		expect(project.name).toBe('mypkg');
		expect(project.kind).toBe('package');
		const deps = project.dependencies;
		expect(deps).toBeDefined();
		expect(deps?.imports).toBe(3);
		expect(deps?.depends).toBe(1);
		expect(deps?.suggests).toBe(2);
		expect(deps?.linkingTo).toBe(1);
		expect(deps?.runtime).toBe(5);
		expect(deps?.base).toBe(1);
		expect(deps?.covered).toBe(2);
		expect(deps?.rVersion).toContain('4.0.0');
		// the first runtime deps carry the version resolved from the database (cli/ggplot2 are in the test db)
		expect(deps?.first).toEqual([
			{ name: 'cli', base: false, dbVersion: '3.6.0' },
			{ name: 'ggplot2', base: false, dbVersion: '3.5.1' },
			{ name: 'notarealpkg', base: false, dbVersion: undefined }
		]);

		const summary = await asciiSummaryOfQueryResult(ansiFormatter, 0, results, analyzer, [{ type: 'project' }]);
		expect(summary).toContain('Dependencies:');
		expect(summary).toContain('cli@3.6.0');
		expect(summary).toContain('Dataflow not performed');
		expect(summary).toContain(':df#');
	});

	test(label('honors a configured base-package list when counting dependencies', [], ['other']), async() => {
		const dir = writePackage(tmp, 'mypkg',
			'Version: 1.0.0\nImports: cli, ggplot2, notarealpkg\nDepends: methods\nLinkingTo: Rcpp\n',
			'x <- 1\n');
		const config = FlowrConfig.amend(FlowrConfig.default(), c => {
			c.project.basePackages = ['methods', 'ggplot2'];
		});
		const deps = (await executeQueries({ analyzer: await analyzeProject(parser, dir, config) }, [{ type: 'project' }])).project.dependencies;
		expect(deps?.base).toBe(2);
		expect(deps?.covered).toBe(1);
	});

	test(label('does not resolve the analyzed package itself from the database', [], ['other']), async() => {
		const dir = writePackage(tmp, 'ggplot2',
			'Version: 3.5.1\nImports: cli\n',
			'ggplot <- function(x) x\nuseCli <- function() cli::cli_alert("hi")\n');
		const analyzer = await analyzeProject(parser, dir);
		await analyzer.dataflow();

		const deps = analyzer.inspectContext().deps;
		expect(deps.getDependency('ggplot2')?.namespaceInfo).toBeUndefined();
		expect(deps.getDependency('cli')?.namespaceInfo).toBeDefined();
	});

	test(label('classifies a non-package project once its files are known', [], ['other']), async() => {
		const dir = fs.mkdtempSync(path.join(tmp, 'shiny-'));
		fs.writeFileSync(path.join(dir, 'app.R'), 'library(shiny)\nx <- 1\n');
		fs.writeFileSync(path.join(dir, 'helper.R'), 'y <- 2\n');
		const analyzer = await analyzeProject(parser, dir);

		expect((await executeQueries({ analyzer }, [{ type: 'project' }])).project.kind).toBe('unknown');
		expect((await executeQueries({ analyzer }, [{ type: 'project', withDf: true }])).project.kind).toBe('shiny-app');
	});
}));

describe.sequential('Add a locally installed package to a pkgdb database', withTreeSitter(() => {
	let tmp: string;
	beforeAll(() => {
		tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'flowr-pkgdb-local-'));
	});
	afterAll(() => {
		fs.rmSync(tmp, { recursive: true, force: true });
	});

	function installPackage(root: string, name: string, description: string, namespace: string): string {
		const dir = fs.mkdtempSync(path.join(root, name + '-'));
		fs.writeFileSync(path.join(dir, 'DESCRIPTION'), `Package: ${name}\n${description}`);
		fs.writeFileSync(path.join(dir, 'NAMESPACE'), namespace);
		return dir;
	}

	test(label('extracts installed exports and builds a loadable, resolving database', [], ['other']), async() => {
		const dir = installPackage(tmp, 'mypkg', 'Version: 2.1.0\n', 'export(foo)\nexport(bar)\nS3method(print, mypkg)\n');

		const [info] = await readInstalledPackages(FlowrConfig.default(), dir);
		expect(info?.name).toBe('mypkg');
		expect(info?.version).toBe('2.1.0');
		expect(new Set(info?.exported)).toEqual(new Set(['foo', 'bar', 'print.mypkg']));

		const { db, added } = await buildPkgDbFromInstalled(FlowrConfig.default(), dir, { date: '2026-07-09', generated: 0 });
		expect(added).toEqual(['mypkg']);

		const reader = PkgDatabase.fromObject(db);
		expect(reader.lookup('mypkg')?.version).toBe('2.1.0');
		expect(new Set(reader.lookup('mypkg')?.exported)).toEqual(new Set(['foo', 'bar', 'print.mypkg']));
		expect(reader.lookup('mypkg')?.cran).toBe(false);
	});

	test(label('reads every package in a library folder and skips a broken one', [], ['other']), async() => {
		const lib = fs.mkdtempSync(path.join(tmp, 'lib-'));
		installPackage(lib, 'pkgA', 'Version: 1.0.0\n', 'export(a)\n');
		installPackage(lib, 'pkgB', 'Version: 2.0.0\n', 'export(b1)\nexport(b2)\n');
		// a directory without a DESCRIPTION must not abort the run
		fs.mkdirSync(path.join(lib, 'not-a-package'));

		const { added } = await buildPkgDbFromInstalled(FlowrConfig.default(), lib, { date: '2026-07-09', generated: 0 });
		expect(new Set(added)).toEqual(new Set(['pkgA', 'pkgB']));
	});

	test(label('returns nothing for a non-existent directory instead of throwing', [], ['other']), async() => {
		const { added } = await buildPkgDbFromInstalled(FlowrConfig.default(), path.join(tmp, 'does-not-exist'), { date: '2026-07-09', generated: 0 });
		expect(added).toEqual([]);
	});
}));
