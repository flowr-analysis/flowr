import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { withTreeSitter } from '../../_helper/shell';
import { label } from '../../_helper/label';
import { FlowrAnalyzerBuilder } from '../../../../src/project/flowr-analyzer-builder';
import { FlowrConfig } from '../../../../src/config';
import { FlowrAnalyzerPackageVersionsSigDbPlugin, SigDbPluginName } from '../../../../src/project/plugins/package-version-plugins/flowr-analyzer-package-versions-sigdb-plugin';
import { SigDatabase } from '../../../../src/project/sigdb/reader';
import { SigDbBuilder, writeSignatureDb } from '../../../../src/project/sigdb/build';
import { SigDbExt, FnProp, type SigVersionInfo } from '../../../../src/project/sigdb/schema';
import { executeQueries } from '../../../../src/queries/query';
import { asciiSummaryOfQueryResult } from '../../../../src/queries/query-print';
import { ansiFormatter } from '../../../../src/util/text/ansi';
import type { TreeSitterExecutor } from '../../../../src/r-bridge/lang-4.x/tree-sitter/tree-sitter-executor';
import fs from 'fs';
import os from 'os';
import path from 'path';

const expFn = (name: string) => ({ name, props: FnProp.Exported, params: [], callees: [], line: 1 });
const ver = (functions: SigVersionInfo['functions']): SigVersionInfo => ({ cran: true, functions });

/** an in-memory signature database exporting a couple of symbols for cli and ggplot2 */
async function buildDb(dir: string): Promise<SigDatabase> {
	const b = new SigDbBuilder();
	b.addPackage('cli', { latest: '3.6.0', downloads: 5 });
	b.addVersion('cli', '3.6.0', ver([expFn('cli_alert')]));
	b.addPackage('ggplot2', { latest: '3.5.1', downloads: 5 });
	b.addVersion('ggplot2', '3.5.1', ver([expFn('ggplot'), expFn('aes'), expFn('geom_point')]));
	await writeSignatureDb(path.join(dir, 'db'), b.build({ date: '2026-05-23', generated: 0 }));
	return SigDatabase.open(path.join(dir, `db${SigDbExt}`));
}

function writePackage(root: string, pkgName: string, description: string, code: string): string {
	const dir = fs.mkdtempSync(path.join(root, pkgName + '-'));
	fs.writeFileSync(path.join(dir, 'DESCRIPTION'), `Package: ${pkgName}\n${description}`);
	fs.mkdirSync(path.join(dir, 'R'));
	fs.writeFileSync(path.join(dir, 'R', 'foo.R'), code);
	return dir;
}

async function analyzeProject(parser: TreeSitterExecutor, db: SigDatabase, dir: string, config?: FlowrConfig) {
	const builder = new FlowrAnalyzerBuilder().setParser(parser)
		.unregisterPlugins(SigDbPluginName)
		.registerPlugins(new FlowrAnalyzerPackageVersionsSigDbPlugin(db));
	if(config) {
		builder.setConfig(config);
	}
	const analyzer = await builder.build();
	analyzer.addRequest('file://' + dir);
	return analyzer;
}

describe.sequential('Project Query', withTreeSitter(parser => {
	let tmp: string;
	let db: SigDatabase;
	beforeAll(async() => {
		tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'flowr-project-query-'));
		db = await buildDb(tmp);
	});
	afterAll(() => {
		db?.close();
		fs.rmSync(tmp, { recursive: true, force: true });
	});

	test(label('reports dependency statistics from the DESCRIPTION file', [], ['other']), async() => {
		const dir = writePackage(tmp, 'mypkg',
			'Version: 1.2.3\nDepends: R (>= 4.0.0), methods\nImports: cli, ggplot2, notarealpkg\nSuggests: testthat, knitr\nLinkingTo: Rcpp\n',
			'library(ggplot2)\nfoo <- function(x) ggplot(x)\n');
		const analyzer = await analyzeProject(parser, db, dir);

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
		const deps = (await executeQueries({ analyzer: await analyzeProject(parser, db, dir, config) }, [{ type: 'project' }])).project.dependencies;
		expect(deps?.base).toBe(2);
		expect(deps?.covered).toBe(1);
	});

	test(label('does not resolve the analyzed package itself from the database', [], ['other']), async() => {
		const dir = writePackage(tmp, 'ggplot2',
			'Version: 3.5.1\nImports: cli\n',
			'ggplot <- function(x) x\nuseCli <- function() cli::cli_alert("hi")\n');
		const analyzer = await analyzeProject(parser, db, dir);
		await analyzer.dataflow();

		const deps = analyzer.inspectContext().deps;
		expect(deps.getDependency('ggplot2')?.namespaceInfo).toBeUndefined();
		expect(deps.getDependency('cli')?.namespaceInfo).toBeDefined();
	});

	test(label('classifies a non-package project once its files are known', [], ['other']), async() => {
		const dir = fs.mkdtempSync(path.join(tmp, 'shiny-'));
		fs.writeFileSync(path.join(dir, 'app.R'), 'library(shiny)\nx <- 1\n');
		fs.writeFileSync(path.join(dir, 'helper.R'), 'y <- 2\n');
		const analyzer = await analyzeProject(parser, db, dir);

		expect((await executeQueries({ analyzer }, [{ type: 'project' }])).project.kind).toBe('unknown');
		expect((await executeQueries({ analyzer }, [{ type: 'project', withDf: true }])).project.kind).toBe('shiny-app');
	});
}));
