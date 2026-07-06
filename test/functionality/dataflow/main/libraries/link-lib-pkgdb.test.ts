import { describe, expect, test, vi } from 'vitest';
import { withTreeSitter } from '../../../_helper/shell';
import type { TreeSitterExecutor } from '../../../../../src/r-bridge/lang-4.x/tree-sitter/tree-sitter-executor';
import { FlowrAnalyzerBuilder } from '../../../../../src/project/flowr-analyzer-builder';
import { FlowrConfig } from '../../../../../src/config';
import { Package } from '../../../../../src/project/plugins/package-version-plugins/package';
import { PkgDatabase, defaultPkgDbPath } from '../../../../../src/project/plugins/package-version-plugins/pkgdb';
import { FlowrAnalyzerPackageVersionsPkgDbPlugin, PkgDbPluginName, reconstructS3Generics } from '../../../../../src/project/plugins/package-version-plugins/flowr-analyzer-package-versions-pkgdb-plugin';
import { FlowrInlineTextFile } from '../../../../../src/project/context/flowr-file';
import { NodeId } from '../../../../../src/r-bridge/lang-4.x/ast/model/processing/node-id';
import { EnvType, REnvironment } from '../../../../../src/dataflow/environments/environment';
import { isFunctionCallVertex } from '../../../../../src/dataflow/graph/vertex';
import { Identifier } from '../../../../../src/dataflow/environments/identifier';
import { getOriginInDfg } from '../../../../../src/dataflow/origin/dfg-get-origin';
import { DfEdge, EdgeType } from '../../../../../src/dataflow/graph/edge';
import { label } from '../../../_helper/label';

/** in-memory database with ggplot2 exporting ggplot/aes/geom_point */
function ggplotDb(): PkgDatabase {
	return PkgDatabase.fromObject({
		format:  'flowr-pkgdb',
		schema:  4,
		scope:   'latest',
		content: { version: 1, date: '2026-05-23', hash: 'x', generated: 0, packages: 1, versions: 1 },
		strings: [],
		pkgs:    { ggplot2: ['3.5.1', ['ggplot', 'aes', 'geom_point']] }
	});
}

async function analyze(ts: TreeSitterExecutor, code: string, db?: PkgDatabase | string) {
	const plugin = db !== undefined
		? new FlowrAnalyzerPackageVersionsPkgDbPlugin(db)
		: new FlowrAnalyzerPackageVersionsPkgDbPlugin();
	// replace the default-registered pkgdb plugin so this one has sole (deterministic) precedence
	const analyzer = await new FlowrAnalyzerBuilder().setParser(ts)
		.unregisterPlugins(PkgDbPluginName).registerPlugins(plugin).build();
	analyzer.addRequest(code);
	return analyzer.dataflow();
}

function hasBuiltIn(df: Awaited<ReturnType<typeof analyze>>, pkg: string, fn: string): boolean {
	const target = String(NodeId.toBuiltIn(Package.funcIdentif(pkg, fn)));
	return [...df.graph.vertices(true)].some(([id]) => String(id) === target);
}

/** whether the call named `callName` resolves via a `Reads|Calls` edge to the export `pkg::fn`'s built-in vertex */
function callResolvesTo(df: Awaited<ReturnType<typeof analyze>>, callName: string, pkg: string, fn: string): boolean {
	const target = String(NodeId.toBuiltIn(Package.funcIdentif(pkg, fn)));
	const call = [...df.graph.vertices(true)].find(([, v]) => isFunctionCallVertex(v) && Identifier.getName(v.name) === callName);
	const edges = call ? df.graph.outgoingEdges(call[0]) : undefined;
	return edges !== undefined && [...edges].some(([to, e]) => String(to) === target && DfEdge.includesType(e, EdgeType.Calls));
}

describe('Link libraries from a pkgdb database', withTreeSitter(ts => {
	test(label('library(ggplot2) attaches its exports from the database (no explicit dependency)', ['library-loading', 'search-path'], ['dataflow']), async() => {
		const df = await analyze(ts, 'library(ggplot2)\nggplot()', ggplotDb());
		const env = REnvironment.findGlobal(df.environment.current).parent;
		expect(env.n === 'ggplot2' && env.t === EnvType.Namespace).toBeTruthy();
		expect(new Set(env.memory.keys())).toEqual(new Set(['ggplot', 'aes', 'geom_point']));
		expect(hasBuiltIn(df, 'ggplot2', 'ggplot')).toBe(true);
		expect(callResolvesTo(df, 'ggplot', 'ggplot2', 'ggplot')).toBe(true);   // the call links to the export
	});

	test(label('on demand: loading a package materializes no export vertices until one is called', ['library-loading', 'search-path'], ['dataflow']), async() => {
		const loaded = await analyze(ts, 'library(ggplot2)', ggplotDb());
		expect(hasBuiltIn(loaded, 'ggplot2', 'ggplot')).toBe(false);   // nothing called -> no vertices (no DFG pollution)
		expect(hasBuiltIn(loaded, 'ggplot2', 'aes')).toBe(false);
		const called = await analyze(ts, 'library(ggplot2)\nggplot()', ggplotDb());
		expect(hasBuiltIn(called, 'ggplot2', 'ggplot')).toBe(true);    // only the called export is materialized
		expect(callResolvesTo(called, 'ggplot', 'ggplot2', 'ggplot')).toBe(true);
		expect(hasBuiltIn(called, 'ggplot2', 'aes')).toBe(false);      // the uncalled ones stay absent
	});

	test(label('eager mode (config) materializes every export vertex on load', ['library-loading'], ['dataflow']), async() => {
		const eager = FlowrConfig.amend(FlowrConfig.default(), c => {
			c.solver.eagerlyLoadPackages = true;
		});
		const analyzer = await new FlowrAnalyzerBuilder().setParser(ts).setConfig(eager)
			.unregisterPlugins(PkgDbPluginName).registerPlugins(new FlowrAnalyzerPackageVersionsPkgDbPlugin(ggplotDb())).build();
		analyzer.addRequest('library(ggplot2)');
		const df = await analyzer.dataflow();
		expect(hasBuiltIn(df, 'ggplot2', 'aes')).toBe(true);           // uncalled export DID get a vertex in eager mode
	});

	test(label('S3 generics are reconstructed from the flat export list (for dispatch)', ['library-loading'], ['dataflow']), () => {
		expect(reconstructS3Generics(['print', 'print.foo', 'print.bar', 'as.data.frame', 'plain']))
			.toEqual(new Map([['print', ['foo', 'bar']]]));   // as.data.frame is not split ('as' is not exported)
	});

	test(label('an S3 method export is attached and materializes on demand when used', ['library-loading', 'search-path'], ['dataflow']), async() => {
		const s3Db = PkgDatabase.fromObject({
			format:  'flowr-pkgdb', schema:  4, scope:   'latest',
			content: { version: 1, date: '2026-05-23', hash: 'x', generated: 0, packages: 1, versions: 1 },
			strings: [], pkgs:    { s3pkg: ['1.0.0', ['describe', 'describe.cat', 'plain']] }
		});
		const df = await analyze(ts, 'library(s3pkg)\ndescribe.cat(x)', s3Db);
		const env = REnvironment.findGlobal(df.environment.current).parent;
		expect(env.memory.has('describe.cat')).toBe(true);            // the method is in scope for dispatch
		expect(hasBuiltIn(df, 's3pkg', 'describe.cat')).toBe(true);   // materialized on demand
		expect(callResolvesTo(df, 'describe.cat', 's3pkg', 'describe.cat')).toBe(true);
	});

	test(label('use(ggplot2, ggplot) resolves the named export from the database', ['library-loading', 'search-path'], ['dataflow']), async() => {
		const df = await analyze(ts, 'use(ggplot2, ggplot)\nggplot()', ggplotDb());
		expect(hasBuiltIn(df, 'ggplot2', 'ggplot')).toBe(true);
		expect(callResolvesTo(df, 'ggplot', 'ggplot2', 'ggplot')).toBe(true);
	});

	test(label('a package absent from the database is not resolved', ['library-loading'], ['dataflow']), async() => {
		const df = await analyze(ts, 'library(nopkg)\nfoo()', ggplotDb());
		expect(hasBuiltIn(df, 'nopkg', 'foo')).toBe(false);
		expect(callResolvesTo(df, 'foo', 'nopkg', 'foo')).toBe(false);
	});

	test(label('database is loaded lazily: untouched without a library request, consulted on one', ['library-loading'], ['dataflow']), async() => {
		const db = ggplotDb();
		const spy = vi.spyOn(db, 'lookup');
		await analyze(ts, 'x <- 1\ny <- x', db);
		expect(spy).not.toHaveBeenCalled();
		await analyze(ts, 'library(ggplot2)\nggplot()', db);
		expect(spy).toHaveBeenCalled();
	});

	test(label('an unreadable database source is tolerated (no throw, no spurious resolution)', ['library-loading'], ['dataflow']), async() => {
		const df = await analyze(ts, 'library(zzznotreal)\nzzzfn()', '/does/not/exist.json.gz');
		expect(hasBuiltIn(df, 'zzznotreal', 'zzzfn')).toBe(false);
	});

	test(label('the qualified identifier/name of a call resolved to a loaded export', ['library-loading', 'search-path'], ['dataflow']), async() => {
		const df = await analyze(ts, 'library(ggplot2)\nggplot()', ggplotDb());
		const call = [...df.graph.vertices(true)].find(([, v]) => isFunctionCallVertex(v) && Identifier.getName(v.name) === 'ggplot');
		expect(call).toBeDefined();
		const [callId] = call ?? [];
		const origins = getOriginInDfg(df.graph, callId as NodeId);
		expect(Identifier.toQualified(origins)).toEqual(Identifier.make('ggplot', 'ggplot2'));
		expect(Identifier.toQualifiedName(origins)).toBe('ggplot2::ggplot');
	});

	test(label('the loaded package databases are reported (drives the REPL :version output)', ['library-loading'], ['dataflow']), async() => {
		const analyzer = await new FlowrAnalyzerBuilder().setParser(ts)
			.unregisterPlugins(PkgDbPluginName).registerPlugins(new FlowrAnalyzerPackageVersionsPkgDbPlugin(ggplotDb())).build();
		expect(analyzer.inspectContext().deps.loadedPackageDatabases())
			.toContainEqual({ scope: 'latest', version: 1, date: '2026-05-23' });
	});

	test(label('a bare call resolved through a loaded package qualifies to package::name', ['library-loading', 'search-path'], ['dataflow']), async() => {
		// purrr exports map -> a bare map() after library(purrr) resolves to purrr::map (the origins path)
		const purrrDb = PkgDatabase.fromObject({
			format:  'flowr-pkgdb', schema:  4, scope:   'latest',
			content: { version: 1, date: '2026-05-23', hash: 'x', generated: 0, packages: 1, versions: 1 },
			strings: [], pkgs:    { purrr: ['1.0.0', ['map', 'reduce']] }
		});
		const df = await analyze(ts, 'library(purrr)\nmap(x, f)', purrrDb);
		const call = [...df.graph.vertices(true)].find(([, v]) => isFunctionCallVertex(v) && Identifier.getName(v.name) === 'map');
		expect(call).toBeDefined();
		const [callId] = call ?? [];
		expect(Identifier.toQualifiedName(getOriginInDfg(df.graph, callId as NodeId))).toBe('purrr::map');
		expect(callResolvesTo(df, 'map', 'purrr', 'map')).toBe(true);
	});

	test(label('renv.lock pins a version and the all-scope database resolves that version\'s exports', ['library-loading', 'search-path'], ['dataflow']), async() => {
		const allDb = PkgDatabase.fromObject({
			format:  'flowr-pkgdb', schema:  4, scope:   'all',
			content: { version: 1, date: '2026-05-23', hash: 'x', generated: 0, packages: 1, versions: 2 },
			strings: [], lists:   [[], ['oldFn'], ['newFn']],
			pkgs:    { demo: ['2.0.0', [['1.0.0', 1], ['2.0.0', 2]]] }
		});
		const analyzer = await new FlowrAnalyzerBuilder().setParser(ts)
			.unregisterPlugins(PkgDbPluginName).registerPlugins(new FlowrAnalyzerPackageVersionsPkgDbPlugin(allDb)).build();
		analyzer.addFile(new FlowrInlineTextFile('renv.lock', JSON.stringify({ Packages: { demo: { Package: 'demo', Version: '1.0.0' } } })));
		analyzer.addRequest('library(demo)\noldFn()\nnewFn()');
		const df = await analyzer.dataflow();
		expect(hasBuiltIn(df, 'demo', 'oldFn')).toBe(true);  // exported by the pinned 1.0
		expect(callResolvesTo(df, 'oldFn', 'demo', 'oldFn')).toBe(true);
		expect(hasBuiltIn(df, 'demo', 'newFn')).toBe(false); // only in 2.0, which is not pinned
	});

	test(label('rv.lock (TOML) pins a version and the all-scope database resolves that version\'s exports', ['library-loading', 'search-path'], ['dataflow']), async() => {
		const allDb = PkgDatabase.fromObject({
			format:  'flowr-pkgdb', schema:  4, scope:   'all',
			content: { version: 1, date: '2026-05-23', hash: 'x', generated: 0, packages: 1, versions: 2 },
			strings: [], lists:   [[], ['oldFn'], ['newFn']],
			pkgs:    { demo: ['2.0.0', [['1.0.0', 1], ['2.0.0', 2]]] }
		});
		const analyzer = await new FlowrAnalyzerBuilder().setParser(ts)
			.unregisterPlugins(PkgDbPluginName).registerPlugins(new FlowrAnalyzerPackageVersionsPkgDbPlugin(allDb)).build();
		analyzer.addFile(new FlowrInlineTextFile('rv.lock', '[[packages]]\nname = "demo"\nversion = "1.0.0"\n'));
		analyzer.addRequest('library(demo)\noldFn()\nnewFn()');
		const df = await analyzer.dataflow();
		expect(hasBuiltIn(df, 'demo', 'oldFn')).toBe(true);
		expect(callResolvesTo(df, 'oldFn', 'demo', 'oldFn')).toBe(true);
		expect(hasBuiltIn(df, 'demo', 'newFn')).toBe(false);
	});

	test(label('resolution falls through several databases (miss in the first, hit in a later one)', ['library-loading', 'search-path'], ['dataflow']), async() => {
		const other = PkgDatabase.fromObject({
			format:  'flowr-pkgdb', schema:  4, scope:   'latest',
			content: { version: 1, date: '2026-05-23', hash: 'x', generated: 0, packages: 1, versions: 1 },
			strings: [], pkgs:    { somethingElse: ['1.0', ['x']] }
		});
		const plugin = new FlowrAnalyzerPackageVersionsPkgDbPlugin(other, ggplotDb());
		await plugin.preload(); // exercises the download/preload path (local sources here)
		const analyzer = await new FlowrAnalyzerBuilder().setParser(ts)
			.unregisterPlugins(PkgDbPluginName).registerPlugins(plugin).build();
		analyzer.addRequest('library(ggplot2)\nggplot()');
		const df = await analyzer.dataflow();
		expect(hasBuiltIn(df, 'ggplot2', 'ggplot')).toBe(true);
		expect(callResolvesTo(df, 'ggplot', 'ggplot2', 'ggplot')).toBe(true);
	});

	test(label('the real database bundled with flowR decodes and resolves a known package', ['library-loading', 'search-path'], ['dataflow']), async({ skip }) => {
		const bundled = defaultPkgDbPath('latest');
		if(bundled === undefined) {
			skip(); // the bundled database is only present after it has been generated/committed
		}
		const df = await analyze(ts, 'library(ggplot2)\nggplot()', bundled); // load the shipped file explicitly
		expect(hasBuiltIn(df, 'ggplot2', 'ggplot')).toBe(true);
		expect(callResolvesTo(df, 'ggplot', 'ggplot2', 'ggplot')).toBe(true);
	});

	// exercises the full default path: default builder -> auto-discovered bundled .br -> decode -> resolve
	test(label('default-on: the bundled database resolves through the default builder (env opt-out lifted)', ['library-loading', 'search-path'], ['dataflow']), async({ skip }) => {
		if(defaultPkgDbPath('latest') === undefined) {
			skip();
		}
		const prev = process.env.FLOWR_DISABLE_DEFAULT_PKGDB;
		delete process.env.FLOWR_DISABLE_DEFAULT_PKGDB;
		try {
			const analyzer = await new FlowrAnalyzerBuilder().setParser(ts).build();
			analyzer.addRequest('library(ggplot2)\nggplot()');
			const df = await analyzer.dataflow();
			expect(hasBuiltIn(df, 'ggplot2', 'ggplot')).toBe(true);
			expect(callResolvesTo(df, 'ggplot', 'ggplot2', 'ggplot')).toBe(true);
		} finally {
			if(prev !== undefined) {
				process.env.FLOWR_DISABLE_DEFAULT_PKGDB = prev;
			}
		}
	});
}));
