import { afterAll, assert, describe, test } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { TreeSitterExecutor } from '../../../../../src/r-bridge/lang-4.x/tree-sitter/tree-sitter-executor';
import { FlowrAnalyzerContext } from '../../../../../src/project/context/flowr-analyzer-context';
import { createDataflowPipeline } from '../../../../../src/core/steps/pipeline/default-pipelines';
import { FlowrConfig } from '../../../../../src/config';
import { PluginType } from '../../../../../src/project/plugins/flowr-analyzer-plugin';
import {
	FlowrAnalyzerLoadingOrderImplicitSourcesPlugin
} from '../../../../../src/project/plugins/loading-order-plugins/flowr-analyzer-loading-order-implicit-sources-plugin';
import { reconstructSlice } from '../../../../../src/queries/catalog/slice-query-options';
import type { SliceQueryOptions } from '../../../../../src/queries/catalog/slice-query-options';

const dirs: string[] = [];

function project(files: Record<string, string>): string {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'flowr-per-file-'));
	dirs.push(dir);
	for(const [name, content] of Object.entries(files)) {
		fs.writeFileSync(path.join(dir, name), content);
	}
	return dir;
}

/** reconstruct every node of a project directory with the given slice options */
async function reconstruct(files: Record<string, string>, options: SliceQueryOptions, implicitSources = false) {
	await TreeSitterExecutor.initTreeSitter();
	const context = new FlowrAnalyzerContext(FlowrConfig.default(), implicitSources ? new Map([
		[PluginType.LoadingOrder, [new FlowrAnalyzerLoadingOrderImplicitSourcesPlugin()]]
	]) : new Map());
	context.addRequests([{ request: 'project', content: project(files) }]);
	const res = await createDataflowPipeline(new TreeSitterExecutor(), { context }).allRemainingSteps();
	return reconstructSlice(res.normalize, res.dataflow.graph, new Set(res.normalize.idMap.keys()), options);
}

const names = (result: { files?: readonly { path: string | undefined }[] }) =>
	result.files?.map(f => f.path === undefined ? '<inline>' : path.basename(f.path));

const twoFiles = {
	'main.R':   'source("helper.R")\nf()\n',
	'helper.R': 'f <- function() 1\n'
};

describe('Reconstruct a slice per file', { concurrent: false }, () => {
	afterAll(() => {
		for(const dir of dirs) {
			fs.rmSync(dir, { recursive: true, force: true });
		}
	});

	// without `perFile` only the entry file is reconstructed, so everything the other files kept is dropped
	test('every file is reported on its own, in loading order, with its path', async() => {
		const result = await reconstruct(twoFiles, { perFile: true });
		assert.deepStrictEqual(names(result), ['helper.R', 'main.R'], 'files keep the loading order');
		assert.deepStrictEqual(result.files?.map(f => f.code), ['f <- function() 1', 'source("helper.R")\nf()']);
		assert.deepStrictEqual(result.code, result.files?.map(f => f.code), '`code` holds the same parts');
	});

	test('without the option only the entry file comes back', async() => {
		const result = await reconstruct(twoFiles, {});
		assert.deepStrictEqual(names(result), ['helper.R'], 'the entry file alone');
		assert.strictEqual(result.code, 'f <- function() 1', '`code` stays a plain string');
	});

	/*
	 * Project discovery and the implicit-source scan reach the same file from both ends, so every file used to
	 * land in the loading order twice; only per-file reconstruction made it visible.
	 */
	test('a file is never registered, and so never reconstructed, twice', async() => {
		const result = await reconstruct({
			'app.R':    'library(shiny)\nshinyApp(ui, server)\n',
			'global.R': 'TITLE <- "hi"\n',
			'ui.R':     'fluidPage(TITLE)\n'
		}, { perFile: true }, true);
		assert.deepStrictEqual(names(result), ['global.R', 'ui.R', 'app.R']);
	});

	// the inlinings produce the opposite (one self-contained text), so they win
	test('inlining overrides it', async() => {
		const result = await reconstruct(twoFiles, { perFile: true, inlineFull: true });
		assert.isUndefined(result.files);
		assert.isString(result.code);
	});
});
