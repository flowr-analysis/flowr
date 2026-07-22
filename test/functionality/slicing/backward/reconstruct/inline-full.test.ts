import { afterAll, assert, describe, test } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { TreeSitterExecutor } from '../../../../../src/r-bridge/lang-4.x/tree-sitter/tree-sitter-executor';
import { FlowrAnalyzerContext, contextFromInput } from '../../../../../src/project/context/flowr-analyzer-context';
import { FlowrInlineTextFile } from '../../../../../src/project/context/flowr-file';
import { PluginType } from '../../../../../src/project/plugins/flowr-analyzer-plugin';
import { createDataflowPipeline } from '../../../../../src/core/steps/pipeline/default-pipelines';
import { type InlineFull, reconstructToCode } from '../../../../../src/reconstruct/reconstruct';
import { SourceInlineMap } from '../../../../../src/reconstruct/inline/source-inline-map';
import { FlowrConfig } from '../../../../../src/config';
import {
	FlowrAnalyzerLoadingOrderImplicitSourcesPlugin
} from '../../../../../src/project/plugins/loading-order-plugins/flowr-analyzer-loading-order-implicit-sources-plugin';

const dirs: string[] = [];

/** a fresh project directory holding `files` */
function project(files: Record<string, string>): string {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'flowr-inline-full-'));
	dirs.push(dir);
	for(const [name, content] of Object.entries(files)) {
		fs.writeFileSync(path.join(dir, name), content);
	}
	return dir;
}

/** reconstruct the whole context (every node selected, so no slice interferes) with `inlineFull` */
async function inlineFull(context: FlowrAnalyzerContext, mode: InlineFull = true): Promise<string> {
	const res = await createDataflowPipeline(new TreeSitterExecutor(), { context }).allRemainingSteps();
	return reconstructToCode(res.normalize, {
		nodes:      new Set(res.normalize.idMap.keys()),
		inlineFull: mode,
		sourceMap:  SourceInlineMap.build(res.normalize, res.dataflow.graph)
	}).code;
}

/** the context of a project directory, with the implicit sources plugin active */
async function projectContext(dir: string): Promise<FlowrAnalyzerContext> {
	await TreeSitterExecutor.initTreeSitter();
	const context = new FlowrAnalyzerContext(FlowrConfig.default(), new Map([
		[PluginType.LoadingOrder, [new FlowrAnalyzerLoadingOrderImplicitSourcesPlugin()]]
	]));
	context.addRequests([{ request: 'project', content: dir }]);
	return context;
}

/** a shiny app whose files are never sourced explicitly, the framework loads them */
const shinyApp = {
	'app.R':    'library(shiny)\nshinyApp(ui, server)\n',
	'global.R': 'TITLE <- "hi"\n',
	'ui.R':     'fluidPage(TITLE)\n',
	'server.R': 'function(input, output) { TITLE }\n'
};

describe.sequential('Reconstruct inline-full', () => {
	afterAll(() => {
		for(const dir of dirs) {
			fs.rmSync(dir, { recursive: true, force: true });
		}
	});

	test('every file is inlined in the implicit loading order, without any source() call', async() => {
		const code = await inlineFull(await projectContext(project(shinyApp)));
		// global.R, ui.R, server.R, app.R is the order the shiny `specializeConfig` entry configures
		const at = ['TITLE <- "hi"', 'fluidPage(TITLE)', 'function(input, output)', 'shinyApp(ui, server)']
			.map(o => code.indexOf(o));
		assert.isTrue(at.every(i => i >= 0), `every file has to be inlined, got:\n${code}`);
		assert.deepStrictEqual(at, [...at].sort((a, b) => a - b), `files have to keep the loading order, got:\n${code}`);
		assert.notInclude(code, '# ----', 'banners are opt-in');
	});

	test('banner comments name every inlined file', async() => {
		const dir = project(shinyApp);
		const code = await inlineFull(await projectContext(dir), 'banner');
		for(const name of Object.keys(shinyApp)) {
			assert.include(code, `# ---- ${path.join(dir, name)} ----`, `a banner has to name ${name}`);
		}
	});

	test('a sourced file is spliced into its source() call instead of being repeated', async() => {
		await TreeSitterExecutor.initTreeSitter();
		const context = contextFromInput('source("helper.R")\nmain <- 1\n');
		context.addFiles([new FlowrInlineTextFile('helper.R', 'helper <- function() 1\n')]);
		const code = await inlineFull(context);
		assert.notInclude(code, 'source(', 'the resolvable source() has to be replaced by the file it sources');
		assert.strictEqual(code.split('helper <- function()').length - 1, 1,
			`the sourced file may only be inlined at its call site, got:\n${code}`);
	});

	test('a project file that is sourced explicitly is still inlined exactly once', async() => {
		// flowR does not load a file the project already knows a second time, so the call keeps no sourced block to
		// splice; the loading order inlines the file instead and the (then redundant) call stays literal
		const dir = project({
			'app.R':    'library(shiny)\nsource("helper.R")\nshinyApp(ui, server)\n',
			'global.R': 'TITLE <- "hi"\n',
			'helper.R': 'helper <- function() 1\n'
		});
		const code = await inlineFull(await projectContext(dir));
		assert.strictEqual(code.split('helper <- function()').length - 1, 1,
			`the sourced project file may only appear once, got:\n${code}`);
	});
});
