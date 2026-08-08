import { assert, beforeAll, describe, test } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { FlowrAnalyzerBuilder } from '../../../src/project/flowr-analyzer-builder';
import { FlowrAnalyzerPackageVersionsLibraryPlugin } from '../../../src/project/plugins/package-version-plugins/flowr-analyzer-package-versions-library-plugin';
import { withTreeSitter } from '../_helper/shell';
import { label } from '../_helper/label';
import { Dataflow } from '../../../src/dataflow/graph/df-helper';
import { VertexType } from '../../../src/dataflow/graph/vertex';
import { Identifier } from '../../../src/dataflow/environments/identifier';
import type { KnownParser } from '../../../src/r-bridge/parser';

/** a package no signature database knows, as it would sit in an R library */
function installPackage(root: string, name: string, description: string, namespace: string): void {
	const dir = path.join(root, name);
	fs.mkdirSync(dir, { recursive: true });
	fs.writeFileSync(path.join(dir, 'DESCRIPTION'), description);
	fs.writeFileSync(path.join(dir, 'NAMESPACE'), namespace);
}

describe('Recovering packages from an installed copy', withTreeSitter(parser => {
	let library: string;
	beforeAll(() => {
		library = fs.mkdtempSync(path.join(os.tmpdir(), 'flowr-lib-'));
		installPackage(library, 'maptools', 'Package: maptools\nVersion: 1.1-8\n',
			'export(readShapePoly, unionSpatialPolygons)\nS3method(print, Map)\n');
	});

	async function analyze(code: string, withFallback: boolean, p: KnownParser = parser) {
		let builder = new FlowrAnalyzerBuilder().setParser(p);
		if(withFallback) {
			builder = builder.registerPlugins(new FlowrAnalyzerPackageVersionsLibraryPlugin({ enabled: true, paths: [library] }));
		}
		const analyzer = await builder.build();
		analyzer.addRequest(code);
		return analyzer;
	}

	const code = 'library(maptools)\nx <- readShapePoly("a.shp")';

	test(label('the exports come from the installed NAMESPACE', ['name-normal'], ['other']), async() => {
		const analyzer = await analyze(code, true);
		await analyzer.dataflow();
		const pkg = analyzer.inspectContext().deps.getDependency('maptools');
		assert.deepStrictEqual(pkg?.namespaceInfo?.exportedSymbols, ['readShapePoly', 'unionSpatialPolygons']);
		assert.strictEqual(pkg?.resolvedVersion, '1.1-8');
	});

	test(label('so a bare call of one of them names the package', ['name-normal'], ['other']), async() => {
		const analyzer = await analyze(code, true);
		const { graph } = await analyzer.dataflow();
		const call = graph.vertices(true).find(([, v]) => v.tag === VertexType.FunctionCall && v.name === 'readShapePoly');
		assert.isDefined(call);
		assert.strictEqual(Identifier.getNamespace(Dataflow.qualify(call[0], graph, false) ?? ''), 'maptools');
	});

	test(label('without the fallback the package stays unknown', ['name-normal'], ['other']), async() => {
		const analyzer = await analyze(code, false);
		await analyzer.dataflow();
		assert.isUndefined(analyzer.inspectContext().deps.getDependency('maptools'));
	});

	test(label('a package nothing installed is not invented', ['name-normal'], ['other']), async() => {
		const analyzer = await analyze('library(notInstalledAnywhere)', true);
		await analyzer.dataflow();
		assert.isUndefined(analyzer.inspectContext().deps.getDependency('notInstalledAnywhere'));
	});

	test(label('registering the plugin alone changes nothing, it is off by default', ['name-normal'], ['other']), async() => {
		const analyzer = await new FlowrAnalyzerBuilder().setParser(parser)
			.registerPlugins(new FlowrAnalyzerPackageVersionsLibraryPlugin({ paths: [library] })).build();
		analyzer.addRequest(code);
		await analyzer.dataflow();
		assert.isUndefined(analyzer.inspectContext().deps.getDependency('maptools'));
	});

	test(label('the configuration alone switches it on, no plugin to register', ['name-normal'], ['other']), async() => {
		const analyzer = await new FlowrAnalyzerBuilder().setParser(parser)
			.amendConfig(c => {
				c.solver.sigdb.installedLibrary = { enabled: true, paths: [library] };
			}).build();
		analyzer.addRequest(code);
		await analyzer.dataflow();
		assert.deepStrictEqual(analyzer.inspectContext().deps.getDependency('maptools')?.namespaceInfo?.exportedSymbols,
			['readShapePoly', 'unionSpatialPolygons']);
	});

	test(label('and it is off in the default configuration', ['name-normal'], ['other']), async() => {
		const analyzer = await new FlowrAnalyzerBuilder().setParser(parser).build();
		analyzer.addRequest(code);
		await analyzer.dataflow();
		assert.isUndefined(analyzer.inspectContext().deps.getDependency('maptools'));
	});

	test(label('the configuration decides which packages may be recovered', ['name-normal'], ['other']), async() => {
		const analyzer = await new FlowrAnalyzerBuilder().setParser(parser)
			.registerPlugins(new FlowrAnalyzerPackageVersionsLibraryPlugin({ enabled: true, paths: [library], packages: ['^rgdal$'] })).build();
		analyzer.addRequest(code);
		await analyzer.dataflow();
		assert.isUndefined(analyzer.inspectContext().deps.getDependency('maptools'), 'maptools does not match the allow-list');
	});
}));
