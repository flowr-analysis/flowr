import { afterAll, assert, describe, test, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { FlowrAnalyzerContext } from '../../../src/project/context/flowr-analyzer-context';
import { FlowrConfig } from '../../../src/config';
import { PluginType } from '../../../src/project/plugins/flowr-analyzer-plugin';
import {
	FlowrAnalyzerLoadingOrderImplicitSourcesPlugin, implicitSourcesLog
} from '../../../src/project/plugins/loading-order-plugins/flowr-analyzer-loading-order-implicit-sources-plugin';
import { FlowrAnalyzerLoadingOrderDescriptionFilePlugin } from '../../../src/project/plugins/loading-order-plugins/flowr-analyzer-loading-order-description-file-plugin';
import { FlowrDescriptionFile } from '../../../src/project/plugins/file-plugins/files/flowr-description-file';
import { FileRole, FlowrInlineTextFile } from '../../../src/project/context/flowr-file';
import { FlowrAnalyzerMetaTestFilesPlugin } from '../../../src/project/plugins/file-plugins/flowr-analyzer-test-file-plugin';

/** the loading order of a context holding `files`, analyzed with the given `config` */
function orderOf(config: FlowrConfig, ...files: string[]): string[] {
	const ctx = new FlowrAnalyzerContext(config, new Map([
		[PluginType.LoadingOrder, [new FlowrAnalyzerLoadingOrderImplicitSourcesPlugin()]]
	]));
	ctx.addRequests(files.map(content => ({ request: 'file', content })));
	return ctx.files.loadingOrder.getLoadingOrder().map(r => r.request === 'file' ? r.content : '<text>');
}

/** a config declaring `implicitSources` for every project, independent of its kind */
function withImplicit(...implicitSources: string[]): FlowrConfig {
	return FlowrConfig.amend(FlowrConfig.default(), c => {
		c.project.implicitSources = implicitSources;
	});
}

/** the warnings emitted while ordering the given `files` */
function warningsFor(config: FlowrConfig, ...files: string[]): string[] {
	const warn = vi.spyOn(implicitSourcesLog, 'warn').mockImplementation(() => undefined);
	try {
		orderOf(config, ...files);
		return warn.mock.calls.map(c => String(c[0]));
	} finally {
		warn.mockRestore();
	}
}

describe('Implicit sources', () => {
	test('implicit sources follow the configured order, the other files keep theirs and stay in front', () => {
		/* a folder that is not on disk, so no file of the checkout around the tests joins in */
		assert.deepStrictEqual(
			orderOf(withImplicit('global.R', 'ui.R', 'app.R'), '/proj/app.R', '/proj/b.R', '/proj/ui.R', '/proj/a.R', '/proj/global.R'),
			['/proj/b.R', '/proj/a.R', '/proj/global.R', '/proj/ui.R', '/proj/app.R']
		);
	});

	test('names are matched on the file name ignoring capitalization, unknown ones are ignored', () => {
		assert.deepStrictEqual(
			orderOf(withImplicit('global.r', 'missing.R', 'app.r'), '/proj/App.R', '/proj/Global.R'),
			['/proj/Global.R', '/proj/App.R']
		);
	});

	test('without any implicit source the order is untouched', () => {
		assert.deepStrictEqual(orderOf(FlowrConfig.default(), '/proj/b.R', '/proj/a.R'), ['/proj/b.R', '/proj/a.R']);
	});

	test('a shiny app gets its implicit sources from the specialized config', () => {
		// only app.R/ui.R decide the kind here, the order has to come from the shipped `specializeConfig` default
		assert.deepStrictEqual(
			orderOf(FlowrConfig.default(), '/app/app.R', '/app/server.R', '/app/ui.R', '/app/global.R'),
			['/app/global.R', '/app/ui.R', '/app/server.R', '/app/app.R']
		);
	});

	test('a shiny app loads global.R before its supporting R/ files, as shiny does', () => {
		assert.deepStrictEqual(
			orderOf(FlowrConfig.default(), '/app/server.R', '/app/R/mod.R', '/app/ui.R', '/app/global.R'),
			['/app/global.R', '/app/R/mod.R', '/app/ui.R', '/app/server.R']
		);
	});

	test('an explicitly configured order wins over the one of the project kind', () => {
		assert.deepStrictEqual(
			orderOf(withImplicit('app.R', 'global.R'), '/app/global.R', '/app/ui.R', '/app/app.R'),
			['/app/ui.R', '/app/app.R', '/app/global.R']
		);
	});

	test('a glob entry matches by path, its files keep their relative order', () => {
		assert.deepStrictEqual(
			orderOf(withImplicit('R/*.R', 'app.R'), '/p/app.R', '/p/other.txt', '/p/R/b.R', '/p/R/a.R'),
			['/p/other.txt', '/p/R/b.R', '/p/R/a.R', '/p/app.R']
		);
	});

	test('a globstar entry spans any number of directories', () => {
		assert.deepStrictEqual(
			orderOf(withImplicit('**/helpers/*.R', 'app.R'), '/p/app.R', '/p/a/b/helpers/h.R', '/p/helpers/g.R'),
			['/p/a/b/helpers/h.R', '/p/helpers/g.R', '/p/app.R']
		);
	});

	test('a single star does not match across a directory boundary', () => {
		// R/*.R must not claim R/sub/deep.R, so it stays in front as a non-implicit file
		assert.deepStrictEqual(
			orderOf(withImplicit('R/*.R'), '/p/R/flat.R', '/p/R/sub/deep.R'),
			['/p/R/sub/deep.R', '/p/R/flat.R']
		);
	});

	test('an entry matching no project file warns about exactly that entry', () => {
		const [message, ...rest] = warningsFor(withImplicit('global.R', 'globl.R', 'R/nope/*.R'), '/p/global.R');
		assert.isEmpty(rest, 'one warning names all of them');
		assert.include(message, '\'globl.R\'');
		assert.include(message, '\'R/nope/*.R\'');
		assert.notInclude(message, '\'global.R\'');
	});

	test('a matching or an unset list warns about nothing', () => {
		assert.isEmpty(warningsFor(withImplicit('global.R', 'app.R'), '/p/app.R', '/p/global.R'));
		assert.isEmpty(warningsFor(withImplicit(), '/proj/b.R', '/proj/a.R'));
	});

	const roots: string[] = [];
	afterAll(() => {
		for(const r of roots) {
			fs.rmSync(r, { recursive: true, force: true });
		}
	});

	/** Materializes `files` (path to content) below a fresh temporary root. */
	function project(files: Record<string, string>): string {
		const root = fs.mkdtempSync(path.join(os.tmpdir(), 'flowr-implicit-'));
		roots.push(root);
		for(const [file, content] of Object.entries(files)) {
			fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
			fs.writeFileSync(path.join(root, file), content);
		}
		return root;
	}

	test('a single-file request discovers a sibling implicit source on disk', () => {
		const root = project({ 't.R': 'y <- 42\nprint(x + y)\n', 's.R': 'x <- 21\n' });
		const ctx = new FlowrAnalyzerContext(withImplicit('s.R'), new Map([
			[PluginType.LoadingOrder, [new FlowrAnalyzerLoadingOrderImplicitSourcesPlugin()]]
		]));
		ctx.addRequests([{ request: 'file', content: path.join(root, 't.R') }]);
		assert.deepStrictEqual(
			ctx.files.loadingOrder.getLoadingOrder().map(r => r.request === 'file' ? path.basename(r.content) : '<text>'),
			['t.R', 's.R']
		);
	});

	test('without implicitSources configured, a single-file request stays single', () => {
		const root = project({ 't.R': 'y <- 42\nprint(x + y)\n', 's.R': 'x <- 21\n' });
		const ctx = new FlowrAnalyzerContext(FlowrConfig.default(), new Map([
			[PluginType.LoadingOrder, [new FlowrAnalyzerLoadingOrderImplicitSourcesPlugin()]]
		]));
		ctx.addRequests([{ request: 'file', content: path.join(root, 't.R') }]);
		assert.deepStrictEqual(
			ctx.files.loadingOrder.getLoadingOrder().map(r => r.request === 'file' ? path.basename(r.content) : '<text>'),
			['t.R']
		);
	});

	test.each([['before', true], ['after', false]])('a file added %s implicit-source discovery reaches it again is kept once', (_, first) => {
		const root = project({ 't.R': 'print(x)\n', 's.R': 'x <- 21\n' });
		const ctx = new FlowrAnalyzerContext(withImplicit('s.R'), new Map());
		const sibling = path.join(root, 's.R');
		const request = () => ctx.addRequests([{ request: 'file', content: path.join(root, 't.R') }]);
		if(first) {
			ctx.addFile(sibling, [FileRole.Data]);
			request();
		} else {
			request();
			ctx.addFile(sibling, [FileRole.Data]);
		}
		ctx.addFile(sibling);
		const known = ctx.files.getAllFiles().filter(f => f.path() === sibling);
		assert.strictEqual(known.length, 1);
		assert.include(known[0].roles ?? [], FileRole.Data);
		assert.strictEqual(ctx.files.getFilesByRole(FileRole.Data).length, 1);
	});

	test('a requested file is known with its roles before it is parsed', () => {
		const root = project({ 't.R': 'x <- 1\n' });
		const ctx = new FlowrAnalyzerContext(FlowrConfig.default(), new Map());
		ctx.addRequests([{ request: 'file', content: path.join(root, 't.R') }]);
		assert.deepStrictEqual(ctx.files.getFilesByRole(FileRole.Source).map(f => path.basename(f.path())), ['t.R']);
	});

	test.each([['tests first', true], ['code first', false]])('requests added together see one root (%s)', (_, testsFirst) => {
		const root = project({ 'R/a.R': 'x <- 1\n', 'tests/t.R': 'x\n' });
		const files = ['tests/t.R', 'R/a.R'].map(f => ({ request: 'file' as const, content: path.join(root, f) }));
		const ctx = new FlowrAnalyzerContext(FlowrConfig.default(), new Map([[PluginType.FileLoad, [new FlowrAnalyzerMetaTestFilesPlugin()]]]));
		ctx.addRequests(testsFirst ? files : files.toReversed());
		assert.deepStrictEqual(ctx.files.getFilesByRole(FileRole.Test).map(f => path.relative(root, f.path())), [path.join('tests', 't.R')]);
	});

	test('a provider of its own replaces the known file, keeping its roles', () => {
		const root = project({ 'a.R': 'x <- 1\n' });
		const ctx = new FlowrAnalyzerContext(FlowrConfig.default(), new Map());
		const file = path.join(root, 'a.R');
		ctx.addFile(file, [FileRole.Data]);
		ctx.addFile(new FlowrInlineTextFile(file, 'x <- 2\n'));
		assert.strictEqual(ctx.files.getFileByPath(file)?.content(), 'x <- 2\n');
		assert.deepStrictEqual(ctx.files.getFilesByRole(FileRole.Data).map(f => f.content()), ['x <- 2\n']);
	});

	test('an explicit Collate order wins, as implicit sources are only a guess', () => {
		const ctx = new FlowrAnalyzerContext(withImplicit('global.R'), new Map([
			[PluginType.LoadingOrder, [
				new FlowrAnalyzerLoadingOrderImplicitSourcesPlugin(),
				new FlowrAnalyzerLoadingOrderDescriptionFilePlugin()
			]]
		]));
		ctx.addFile(FlowrDescriptionFile.from(new FlowrInlineTextFile('DESCRIPTION', 'Package: a\nCollate: global.R a.R\n'), FileRole.Description));
		ctx.addRequests(['a.R', 'global.R'].map(content => ({ request: 'file', content })));
		assert.deepStrictEqual(
			ctx.files.loadingOrder.getLoadingOrder().map(r => r.request === 'file' ? r.content : '<text>'),
			['global.R', 'a.R'],
			'Collate is certain, so it overrides the guess instead of depending on the plugin order'
		);
	});
});
