import { afterAll, assert, beforeAll, describe, test } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { FlowrAnalyzerBuilder } from '../../../../src/project/flowr-analyzer-builder';
import { TreeSitterExecutor } from '../../../../src/r-bridge/lang-4.x/tree-sitter/tree-sitter-executor';
import { FlowrAnalyzerContext } from '../../../../src/project/context/flowr-analyzer-context';
import { arraysGroupBy } from '../../../../src/util/collections/arrays';
import { FileRole, FlowrInlineTextFile } from '../../../../src/project/context/flowr-file';
import { FlowrConfig } from '../../../../src/config';
import {
	FlowrAnalyzerRprofileFilePlugin
} from '../../../../src/project/plugins/file-plugins/flowr-analyzer-rprofile-file-plugin';

describe('Rprofile-file', function() {
	function ctxWith(...files: string[]): FlowrAnalyzerContext {
		const ctx = new FlowrAnalyzerContext(
			FlowrConfig.default(),
			arraysGroupBy([new FlowrAnalyzerRprofileFilePlugin()], p => p.type)
		);
		for(const f of files) {
			ctx.addFile(new FlowrInlineTextFile(f, ''));
		}
		return ctx;
	}

	test('.Rprofile and Rprofile.site are tagged Startup and Source', () => {
		const ctx = ctxWith('.Rprofile', 'Rprofile.site');
		assert.sameMembers(ctx.files.getFilesByRole(FileRole.Startup).map(f => f.path()), ['.Rprofile', 'Rprofile.site']);
		assert.sameMembers(ctx.files.getFilesByRole(FileRole.Source).map(f => f.path()), ['.Rprofile', 'Rprofile.site']);
	});

	test('unrelated files are not tagged', () => {
		const ctx = ctxWith('script.R', 'profile.R', 'DESCRIPTION');
		assert.lengthOf(ctx.files.getFilesByRole(FileRole.Startup), 0);
	});

	describe('within a discovered project', () => {
		let root: string;
		beforeAll(() => {
			root = fs.mkdtempSync(path.join(os.tmpdir(), 'flowr-rprofile-'));
			fs.mkdirSync(path.join(root, 'R'));
			fs.writeFileSync(path.join(root, '.Rprofile'), 'options(stringsAsFactors = FALSE)');
			fs.writeFileSync(path.join(root, 'R', 'main.R'), 'x <- 1');
		});
		afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

		async function analyze() {
			const analyzer = await new FlowrAnalyzerBuilder().setParser(new TreeSitterExecutor()).build();
			/* seed another file first so the profile is not already in front */
			analyzer.addRequest({ request: 'file', content: path.join(root, 'R', 'main.R') });
			analyzer.addRequest({ request: 'project', content: root });
			return analyzer.inspectContext();
		}

		test('a discovered .Rprofile is tagged, though parse requests skip the file plugins', async() => {
			const ctx = await analyze();
			assert.deepStrictEqual(ctx.files.getFilesByRole(FileRole.Startup).map(f => path.basename(f.path())), ['.Rprofile']);
		});

		test('a discovered .Rprofile is loaded first', async() => {
			const ctx = await analyze();
			const order = ctx.files.loadingOrder.getLoadingOrder().map(r => r.request === 'file' ? path.basename(r.content) : '<inline>');
			assert.strictEqual(order[0], '.Rprofile');
		});
	});
});
