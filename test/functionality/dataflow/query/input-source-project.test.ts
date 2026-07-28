import { afterAll, assert, beforeAll, describe, test } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { withTreeSitter } from '../../_helper/shell';
import { FlowrAnalyzerBuilder } from '../../../../src/project/flowr-analyzer-builder';
import { executeQueries } from '../../../../src/queries/query';
import type { TreeSitterExecutor } from '../../../../src/r-bridge/lang-4.x/tree-sitter/tree-sitter-executor';
import { InputType } from '../../../../src/queries/catalog/input-sources-query/simple-input-classifier';
import type { ProblematicInputsResult } from '../../../../src/linter/rules/problematic-inputs';
import { uniqueArray } from '../../../../src/util/collections/arrays';
import { FlowrConfig } from '../../../../src/config';

/** writes the given `name -> content` map below a fresh directory in `root` */
function writeProject(root: string, name: string, files: Record<string, string>): string {
	const dir = fs.mkdtempSync(path.join(root, name + '-'));
	for(const [file, content] of Object.entries(files)) {
		const target = path.join(dir, file);
		fs.mkdirSync(path.dirname(target), { recursive: true });
		fs.writeFileSync(target, content);
	}
	return dir;
}

/** all input types the `problematic-inputs` rule reports for the whole project */
async function inputTypesOf(parser: TreeSitterExecutor, dir: string, config?: FlowrConfig): Promise<InputType[]> {
	const builder = new FlowrAnalyzerBuilder().setParser(parser);
	const analyzer = await (config ? builder.setConfig(config) : builder).build();
	analyzer.addRequest('file://' + dir);
	const out = await executeQueries({ analyzer }, [{ type: 'linter', rules: ['problematic-inputs'] }]);
	const rule = out.linter.results['problematic-inputs'];
	assert.isTrue(rule !== undefined && 'results' in rule, 'the rule must not error');
	const results = (rule as { results: readonly ProblematicInputsResult[] }).results;
	assert.isNotEmpty(results, 'the rule has to flag the system calls of the project');
	return uniqueArray(results.flatMap(r => r.sources.flatMap(s => s.types)));
}

describe.sequential('Input Sources across Files (issue #2625)', withTreeSitter(parser => {
	let tmp: string;
	beforeAll(() => {
		tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'flowr-input-source-project-'));
	});
	afterAll(() => {
		fs.rmSync(tmp, { recursive: true, force: true });
	});

	test('the input of a shiny app assembled from several files', async() => {
		const dir = writeProject(tmp, 'shiny-app', {
			'global.R': 'library(shiny)\nCONVERTER <- "convert"\n',
			'ui.R':     'fluidPage(textInput("n", "Name"))\n',
			'server.R': 'function(input, output, session) {\n  output$greeting <- renderText({\n    system(paste(CONVERTER, input$n))\n  })\n}\n'
		});
		assert.include(await inputTypesOf(parser, dir), InputType.User);
	});

	test('the input of a module living in a sourced file', async() => {
		const dir = writeProject(tmp, 'shiny-module', {
			'global.R': 'library(shiny)\n',
			'server.R': 'source("R/mod.R")\nfunction(input, output, session) {\n  cmdModuleServer("cmd")\n}\n',
			'R/mod.R':  'cmdModuleServer <- function(id) {\n  moduleServer(id, function(input, output, session) {\n    observeEvent(input$go, {\n      system(paste("rm -rf", input$path))\n    })\n  })\n}\n'
		});
		assert.include(await inputTypesOf(parser, dir), InputType.User);
	});

	test('the input handed to a helper in another file', async() => {
		const dir = writeProject(tmp, 'shiny-helper', {
			'global.R':    'library(shiny)\nsource("R/helpers.R")\n',
			'server.R':    'function(input, output, session) {\n  runIndirect(input)\n}\n',
			'R/helpers.R': 'runIndirect <- function(input) {\n  system(input$cmd)\n}\n'
		});
		assert.include(await inputTypesOf(parser, dir), InputType.User);
	});

	test('a framework flowR knows nothing about, taught entirely through the configuration', async() => {
		const dir = writeProject(tmp, 'own-framework', {
			'ui.R':      'field("q", "Query")\n',
			'handler.R': 'handle <- function(request, res) {\n  system(request$q)\n}\nserve(handle)\n'
		});
		const config = FlowrConfig.amend(FlowrConfig.default(), c => {
			c.inputSources = {
				linkedObjects:     [{ name: 'ctx', type: InputType.User, declaredBy: { calls: ['field'], argName: 'id', argIdx: 0 } }],
				linkedEntryPoints: [{ call: 'serve', argName: 'handler', argIdx: 0, params: ['ctx', undefined] }]
			};
		});
		assert.include(await inputTypesOf(parser, dir, config), InputType.User);
	});

	test('a cohort built in one file and read in another', async() => {
		const dir = writeProject(tmp, 'cohort-app', {
			'global.R':   'library(shiny)\nlibrary(cohortBuilder)\nlibrary(shinyCohortBuilder)\nsource("R/report.R")\ncoh <- cohort(set_source(as.tblist(read.csv("patients.csv"))))\n',
			'ui.R':       'fluidPage(cb_ui("cohort"))\n',
			'server.R':   'function(input, output, session) {\n  cb_server("cohort", cohort = coh)\n  output$report <- renderText({ writeReport(coh) })\n}\n',
			'R/report.R': 'writeReport <- function(cohort) {\n  system(paste("report", get_data(cohort)))\n}\n'
		});
		assert.include(await inputTypesOf(parser, dir), InputType.User);
	});
}));
