import { assert, describe, test, vi } from 'vitest';
import { FlowrAnalyzerContext } from '../../../src/project/context/flowr-analyzer-context';
import { ProjectKind } from '../../../src/project/context/project-kind';
import { FlowrConfig } from '../../../src/config';
import { PluginType } from '../../../src/project/plugins/flowr-analyzer-plugin';
import {
	FlowrAnalyzerLoadingOrderImplicitSourcesPlugin, implicitSourcesLog
} from '../../../src/project/plugins/loading-order-plugins/flowr-analyzer-loading-order-implicit-sources-plugin';
import type { RParseRequest } from '../../../src/r-bridge/retriever';
import { FlowrAnalyzerLoadingOrderDescriptionFilePlugin } from '../../../src/project/plugins/loading-order-plugins/flowr-analyzer-loading-order-description-file-plugin';
import { FlowrDescriptionFile } from '../../../src/project/plugins/file-plugins/files/flowr-description-file';
import { FileRole, FlowrInlineTextFile } from '../../../src/project/context/flowr-file';

/** the loading order of a context holding `files`, analyzed with the given `config` */
function orderOf(config: FlowrConfig, ...files: string[]): string[] {
	const ctx = new FlowrAnalyzerContext(config, new Map([
		[PluginType.LoadingOrder, [new FlowrAnalyzerLoadingOrderImplicitSourcesPlugin()]]
	]));
	ctx.addRequests(files.map(content => ({ request: 'file', content }) as RParseRequest));
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
		assert.deepStrictEqual(
			orderOf(withImplicit('global.R', 'ui.R', 'app.R'), 'app.R', 'b.R', 'ui.R', 'a.R', 'global.R'),
			['b.R', 'a.R', 'global.R', 'ui.R', 'app.R']
		);
	});

	test('names are matched on the file name ignoring capitalization, unknown ones are ignored', () => {
		assert.deepStrictEqual(
			orderOf(withImplicit('global.r', 'missing.R', 'app.r'), '/proj/App.R', '/proj/Global.R'),
			['/proj/Global.R', '/proj/App.R']
		);
	});

	test('without any implicit source the order is untouched', () => {
		assert.deepStrictEqual(orderOf(FlowrConfig.default(), 'b.R', 'a.R'), ['b.R', 'a.R']);
	});

	test('a shiny app gets its implicit sources from the specialized config', () => {
		// only app.R/ui.R decide the kind here, the order has to come from the shipped `specializeConfig` default
		assert.deepStrictEqual(
			orderOf(FlowrConfig.default(), '/app/app.R', '/app/server.R', '/app/ui.R', '/app/global.R'),
			['/app/global.R', '/app/ui.R', '/app/server.R', '/app/app.R']
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
		assert.isEmpty(warningsFor(withImplicit(), 'b.R', 'a.R'));
	});

	test('an explicit Collate order wins, as implicit sources are only a guess', () => {
		const ctx = new FlowrAnalyzerContext(withImplicit('global.R'), new Map([
			[PluginType.LoadingOrder, [
				new FlowrAnalyzerLoadingOrderImplicitSourcesPlugin(),
				new FlowrAnalyzerLoadingOrderDescriptionFilePlugin()
			]]
		]));
		ctx.addFile(FlowrDescriptionFile.from(new FlowrInlineTextFile('DESCRIPTION', 'Package: a\nCollate: global.R a.R\n'), FileRole.Description));
		ctx.addRequests(['a.R', 'global.R'].map(content => ({ request: 'file', content }) as RParseRequest));
		assert.deepStrictEqual(
			ctx.files.loadingOrder.getLoadingOrder().map(r => r.request === 'file' ? r.content : '<text>'),
			['global.R', 'a.R'],
			'Collate is certain, so it overrides the guess instead of depending on the plugin order'
		);
	});
});

describe('FlowrConfig.forKind', () => {
	test('a kind without an overwrite keeps the config untouched', () => {
		const config = FlowrConfig.default();
		assert.strictEqual(FlowrConfig.forKind(config, ProjectKind.Package), config);
		assert.isUndefined(FlowrConfig.forKind(config, ProjectKind.Package).project.implicitSources);
	});

	test('any kind can be given an overwrite, not just shiny', () => {
		const config = FlowrConfig.amend(FlowrConfig.default(), c => {
			c.specializeConfig = { [ProjectKind.Notebook]: { project: { implicitSources: ['setup.R'] } } };
		});
		assert.deepStrictEqual(FlowrConfig.forKind(config, ProjectKind.Notebook).project.implicitSources, ['setup.R']);
	});
});
