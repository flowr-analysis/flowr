import { afterAll, describe, expect, test, vi } from 'vitest';
import path from 'path';
import { withTreeSitter } from '../../../_helper/shell';
import { sigTmpDir, cleanupSigTmpDirs, writeAndOpen, sigdbAnalyzer, expFn, ver, hasBuiltInVertex as hasBuiltIn } from '../../../_helper/sigdb';
import type { TreeSitterExecutor } from '../../../../../src/r-bridge/lang-4.x/tree-sitter/tree-sitter-executor';
import { FlowrAnalyzerBuilder } from '../../../../../src/project/flowr-analyzer-builder';
import { DefaultAssumedRVersion, FlowrConfig } from '../../../../../src/config';
import { FlowrAnalyzerPackageVersionsSigDbPlugin, SigDbPluginName, sigDbLog } from '../../../../../src/project/plugins/package-version-plugins/flowr-analyzer-package-versions-sigdb-plugin';
import { getOriginInDfg } from '../../../../../src/dataflow/origin/dfg-get-origin';
import { baseRExportOwner } from '../../../../../src/util/r-base-packages';
import { executeCallContextQueries } from '../../../../../src/queries/catalog/call-context-query/call-context-query-executor';
import type { FlowrAnalyzer } from '../../../../../src/project/flowr-analyzer';
import { type SigDatabase, type PackageSignatureSource } from '../../../../../src/project/sigdb/reader';
import { SigDbBuilder, writeSignatureDb } from '../../../../../src/project/sigdb/build';
import { SigDbExt, FnProp, DepType } from '../../../../../src/project/sigdb/schema';
import { NodeId } from '../../../../../src/r-bridge/lang-4.x/ast/model/processing/node-id';
import type { Environment } from '../../../../../src/dataflow/environments/environment';
import { EnvType, REnvironment } from '../../../../../src/dataflow/environments/environment';
import { isFunctionCallVertex } from '../../../../../src/dataflow/graph/vertex';
import { Identifier } from '../../../../../src/dataflow/environments/identifier';
import { DfEdge, EdgeType } from '../../../../../src/dataflow/graph/edge';
import { FlowrAnalyzerPackageVersionsPlugin } from '../../../../../src/project/plugins/package-version-plugins/flowr-analyzer-package-versions-plugin';
import { SemVer } from 'semver';
import { label } from '../../../_helper/label';

afterAll(cleanupSigTmpDirs);

/** a version plugin that always throws -- stands in for a plugin choking on a malformed project file */
class ThrowingVersionsPlugin extends FlowrAnalyzerPackageVersionsPlugin {
	public readonly name = 'throwing-versions-plugin';
	public readonly description = 'A test plugin that always throws while resolving versions.';
	public readonly version = new SemVer('0.0.0');
	protected process(): void {
		throw new Error('boom: simulated malformed project file');
	}
}

/**
 * A tiny in-memory signature database: base R (`paste` — a registered built-in — and `Reduce`), the base package
 * `stats` shipped across two R releases with different export sets, and a plain CRAN package. Written to a temp
 * file and opened as a real {@link SigDatabase}.
 */
async function buildDb(dir: string): Promise<SigDatabase> {
	const b = new SigDbBuilder();
	b.addPackage('base', { latest: '4.5.0', core: true });
	b.addVersion('base', '4.5.0', ver([expFn('paste'), expFn('Reduce')]));
	b.addPackage('stats', { latest: '4.5.0', core: true });
	b.addVersion('stats', '4.4.0', ver([expFn('arima')]));                 // R 4.4: only arima
	b.addVersion('stats', '4.5.0', ver([expFn('arima'), expFn('newfn')])); // R 4.5: arima + newfn
	b.addPackage('cranpkg', { latest: '1.0.0', downloads: 5 });
	b.addVersion('cranpkg', '1.0.0', ver([expFn('cranfn')]));
	return writeAndOpen(dir, b.build({ date: '2026-05-23', generated: 0 }));
}

/** a config that opts into eager base-R namespace attachment (`solver.sigdb.linkBaseR`) */
function linkBaseRConfig(): FlowrConfig {
	return FlowrConfig.amend(FlowrConfig.default(), c => {
		c.solver.sigdb.linkBaseR = true;
	});
}

async function analyze(ts: TreeSitterExecutor, code: string, db: PackageSignatureSource, config?: FlowrConfig) {
	const analyzer = await sigdbAnalyzer(ts, db, config);
	analyzer.addRequest(code);
	return { df: await analyzer.dataflow(), analyzer };
}

/** whether the call `callName` resolves via a `Calls` edge to the export `pkg::fn`'s built-in vertex */
function callResolvesTo(df: Awaited<ReturnType<typeof analyze>>['df'], callName: string, pkg: string, fn: string): boolean {
	const target = String(NodeId.fromPkgFn(pkg, fn));
	const call = df.graph.vertices(true).find(([, v]) => isFunctionCallVertex(v) && Identifier.getName(v.name) === callName);
	const edges = call ? df.graph.outgoingEdges(call[0]) : undefined;
	return edges !== undefined && edges.entries().some(([to, e]) => String(to) === target && DfEdge.includesType(e, EdgeType.Calls));
}

/** the edge-free qualified name of the call `callName` via {@link Identifier.toQualified} + the base-export index */
function qualifiedName(res: Awaited<ReturnType<typeof analyze>>, callName: string): string | undefined {
	const dfg = res.df.graph;
	for(const [id, v] of dfg.vertices(true)) {
		if(isFunctionCallVertex(v) && Identifier.getName(v.name) === callName) {
			const q = Identifier.toQualified(getOriginInDfg(dfg, id), v.name);
			return q === undefined ? undefined : Identifier.toString(q);
		}
	}
	return undefined;
}

/** the `built-in:pkg:fn` proc strings of the origins that the dataflow attaches to the call `callName` */
function originProcs(res: Awaited<ReturnType<typeof analyze>>, callName: string): string[] {
	const dfg = res.df.graph;
	for(const [id, v] of dfg.vertices(true)) {
		if(isFunctionCallVertex(v) && Identifier.getName(v.name) === callName) {
			return (getOriginInDfg(dfg, id) ?? []).flatMap(o => 'proc' in o ? [o.proc] : []);
		}
	}
	return [];
}

/** the node ids of calls to `callName` that a call-context query resolves to package `namespace` */
async function callTargets(analyzer: FlowrAnalyzer, callName: string, namespace: string): Promise<NodeId[]> {
	const out = await executeCallContextQueries({ analyzer }, [{ type: 'call-context', callName, callTargetNamespace: namespace }]);
	return Object.values(out.kinds).flatMap(({ subkinds }) => Object.values(subkinds).flatMap(rs => rs.map(r => r.id)));
}

/** the attached namespace environment for `pkg` below the global env, if any */
function namespaceEnv(df: Awaited<ReturnType<typeof analyze>>['df'], pkg: string): Environment | undefined {
	for(let e: Environment = REnvironment.findGlobal(df.environment.current).parent; e.t !== undefined && !e.builtInEnv; e = e.parent) {
		if(e.n === pkg && e.t === EnvType.Namespace) {
			return e;
		}
	}
	return undefined;
}

describe('Link libraries from a signature database (sigdb)', withTreeSitter(ts => {
	test(label('library(stats) attaches the base package exports for the assumed R version', ['library-loading', 'search-path'], ['dataflow']), async() => {
		const dir = sigTmpDir('link-sigdb-');
		const { df } = await analyze(ts, 'library(stats)\narima()', await buildDb(dir));
		expect(hasBuiltIn(df, 'stats', 'arima')).toBe(true);                 // the export links (not an unknown side effect)
		expect(callResolvesTo(df, 'arima', 'stats', 'arima')).toBe(true);
		expect(namespaceEnv(df, 'stats')?.memory.has('arima')).toBe(true);
	});

	test(label('a bare base call not in the built-in config resolves to the base package export', ['library-loading', 'search-path'], ['dataflow']), async() => {
		const dir = sigTmpDir('link-sigdb-');
		// eager base attach is opt-in (solver.sigdb.linkBaseR); no library() call needed once enabled
		const { df } = await analyze(ts, 'Reduce(f, xs)', await buildDb(dir), linkBaseRConfig());
		expect(hasBuiltIn(df, 'base', 'Reduce')).toBe(true);
		expect(callResolvesTo(df, 'Reduce', 'base', 'Reduce')).toBe(true);
	});

	test(label('pinning an older assumedRVersion selects that R release\'s exports', ['library-loading', 'search-path'], ['dataflow']), async() => {
		const dir = sigTmpDir('link-sigdb-');
		const db = await buildDb(dir);
		const pinned = FlowrConfig.amend(FlowrConfig.default(), c => {
			c.solver.sigdb.assumedRVersion = '4.4.0';
		});
		const { df, analyzer } = await analyze(ts, 'library(stats)\narima()\nnewfn()', db, pinned);
		expect(analyzer.inspectContext().resolvedRVersion).toBe('4.4.0');
		expect(callResolvesTo(df, 'arima', 'stats', 'arima')).toBe(true);   // arima shipped in R 4.4
		expect(hasBuiltIn(df, 'stats', 'newfn')).toBe(false);               // newfn only appeared in R 4.5
		expect(namespaceEnv(df, 'stats')?.memory.has('newfn')).toBe(false);

		// and the default (auto -> tree-sitter reports none -> DefaultAssumedRVersion) does pick up newfn
		const latest = await analyze(ts, 'library(stats)\nnewfn()', db);
		expect(latest.analyzer.inspectContext().resolvedRVersion).toBe(DefaultAssumedRVersion);
		expect(callResolvesTo(latest.df, 'newfn', 'stats', 'newfn')).toBe(true);
	});

	test(label('a name that is a registered built-in (paste) is not shadowed by a base export', ['library-loading', 'search-path'], ['dataflow']), async() => {
		const dir = sigTmpDir('link-sigdb-');
		const { df } = await analyze(ts, 'paste("a", "b")\nReduce(f, xs)', await buildDb(dir), linkBaseRConfig());
		// Reduce (no built-in) is attached from base; paste (a built-in) is skipped, so it stays the built-in
		expect(namespaceEnv(df, 'base')?.memory.has('Reduce')).toBe(true);
		expect(namespaceEnv(df, 'base')?.memory.has('paste')).toBe(false);
		expect(hasBuiltIn(df, 'base', 'paste')).toBe(false);
		expect(callResolvesTo(df, 'paste', 'base', 'paste')).toBe(false);
	});

	test(label('a plain CRAN package resolves at its latest version', ['library-loading', 'search-path'], ['dataflow']), async() => {
		const dir = sigTmpDir('link-sigdb-');
		const { df } = await analyze(ts, 'library(cranpkg)\ncranfn()', await buildDb(dir));
		expect(hasBuiltIn(df, 'cranpkg', 'cranfn')).toBe(true);
		expect(callResolvesTo(df, 'cranfn', 'cranpkg', 'cranfn')).toBe(true);
	});

	test(label('the resolved (assumed) R version is reported for analysis', ['library-loading'], ['dataflow']), async() => {
		const dir = sigTmpDir('link-sigdb-');
		const pinned = FlowrConfig.amend(FlowrConfig.default(), c => {
			c.solver.sigdb.assumedRVersion = '4.3.2';
		});
		const { analyzer } = await analyze(ts, 'x <- 1', await buildDb(dir), pinned);
		expect(analyzer.inspectContext().resolvedRVersion).toBe('4.3.2');
	});
}));

describe('edge-free base-R qualification (linkBaseR off: no namespaces, no dataflow edges)', withTreeSitter(ts => {
	test(label('baseRExportOwner maps base exports to their owner (from the precomputed store, not the loaded db)', ['library-loading'], ['dataflow']), () => {
		expect(baseRExportOwner('arima')).toBe('stats');   // a stats export
		expect(baseRExportOwner('sd')).toBe('stats');
		expect(baseRExportOwner('paste')).toBe('base');    // a base export (even though also a built-in)
		expect(baseRExportOwner('install.packages')).toBe('utils');
		expect(baseRExportOwner('cranfn')).toBeUndefined();          // not a base-R export
		expect(baseRExportOwner('does_not_exist')).toBeUndefined();
	});

	test(label('a bare base call is qualified by name without attaching a namespace or adding an edge', ['library-loading'], ['dataflow']), async() => {
		const dir = sigTmpDir('link-sigdb-');
		const res = await analyze(ts, 'arima(x)', await buildDb(dir));   // no library(), linkBaseR off
		expect(qualifiedName(res, 'arima')).toBe('stats::arima');        // qualified purely by lookup
		// ...and NOTHING was attached: no namespace env, no built-in vertex, no Calls edge
		expect(namespaceEnv(res.df, 'stats')).toBeUndefined();
		expect(hasBuiltIn(res.df, 'stats', 'arima')).toBe(false);
		expect(callResolvesTo(res.df, 'arima', 'stats', 'arima')).toBe(false);
	});

	test(label('a locally defined function shadowing a base name is NOT mistaken for the base export', ['library-loading'], ['dataflow']), async() => {
		const dir = sigTmpDir('link-sigdb-');
		const res = await analyze(ts, 'arima <- function(v) 1\narima(x)', await buildDb(dir));
		expect(qualifiedName(res, 'arima')).toBeUndefined();   // resolves to the user definition, so no base qualification
	});

	test(label('R call-position semantics: a non-function binding is skipped, a function binding shadows', ['library-loading', 'call-normal'], ['dataflow']), async() => {
		const dir = sigTmpDir('link-sigdb-');
		const db = await buildDb(dir);
		// `acf <- 3; acf(x <- 2)` -- R skips the non-function `acf` in call position and calls stats::acf, so we qualify
		const value = await analyze(ts, 'acf <- 3\nacf(x <- 2)', db);
		expect(qualifiedName(value, 'acf')).toBe('stats::acf');
		// `acf <- function(...)` IS callable, so (like R) it shadows the base function and we do NOT qualify
		const fn = await analyze(ts, 'acf <- function(z) z\nacf(x <- 2)', db);
		expect(qualifiedName(fn, 'acf')).toBeUndefined();
	});

	test(label('an explicitly namespaced call is left as written (not re-qualified)', ['library-loading'], ['dataflow']), async() => {
		const dir = sigTmpDir('link-sigdb-');
		const res = await analyze(ts, 'utils::arima(x)', await buildDb(dir));
		expect(qualifiedName(res, 'arima')).toBeUndefined();   // toQualified yields nothing; the caller keeps utils::arima
	});

	test(label('a call-context query with callTargetNamespace finds a bare base call (its real consumer)', ['library-loading'], ['dataflow']), async() => {
		const dir = sigTmpDir('link-sigdb-');
		const { analyzer } = await analyze(ts, 'arima(x)\ncranfn()', await buildDb(dir));   // no library(), linkBaseR off
		// `callTargetNamespace: 'stats'` resolves the bare base call `arima()` to stats (documented query semantics)
		expect(await callTargets(analyzer, 'arima', 'stats')).toHaveLength(1);
		expect(await callTargets(analyzer, 'arima', 'graphics')).toHaveLength(0);   // not that namespace
		expect(await callTargets(analyzer, 'cranfn', 'stats')).toHaveLength(0);     // a non-base call is not base-qualified
	});
}));

describe('base-R origin: correct with linkBaseR off (edge-free) and on (real edge)', withTreeSitter(ts => {
	// `arima` is a real `stats` export in the generated base-package store *and* in our tiny db, so both the
	// edge-free lookup (off) and the eager-attach edge (on) have something to resolve to.
	test(label('a bare base call qualifies to the same package with the option off and on', ['library-loading', 'search-path'], ['dataflow']), async() => {
		const dir = sigTmpDir('link-sigdb-');
		const db = await buildDb(dir);

		// OFF (default): nothing is attached, there is NO Calls edge and NO built-in:stats:arima origin,
		// yet the call is still qualified to stats::arima purely from the precomputed base-export index
		const off = await analyze(ts, 'arima(x)', db);
		expect(qualifiedName(off, 'arima')).toBe('stats::arima');
		expect(callResolvesTo(off.df, 'arima', 'stats', 'arima')).toBe(false);
		expect(originProcs(off, 'arima')).not.toContain('built-in:stats:arima');   // truly edge-free

		// ON: the same call now resolves through a real dataflow edge whose origin carries the built-in id,
		// and toQualified reports the identical name -- this time *from the origin*, not the fallback
		const on = await analyze(ts, 'arima(x)', db, linkBaseRConfig());
		expect(qualifiedName(on, 'arima')).toBe('stats::arima');
		expect(callResolvesTo(on.df, 'arima', 'stats', 'arima')).toBe(true);
		expect(originProcs(on, 'arima')).toContain('built-in:stats:arima');         // the link option wired the origin
	});
}));

describe('sigdb system: real base exports from the generated list qualify end-to-end', withTreeSitter(ts => {
	// a system-level check that drives the *generated* base-export list through a full analysis: none of these
	// names are in a loaded db (linkBaseR off), so every qualification comes from `baseRExportOwner`
	test(label('a mix of real base calls each resolve to their true owning package', ['library-loading', 'search-path'], ['dataflow']), async() => {
		const dir = sigTmpDir('link-sigdb-');
		const db = await buildDb(dir);   // db only knows cranpkg/base/stats fixtures -- these names are NOT in it
		const cases: readonly [call: string, owner: string][] = [
			['sd', 'stats'], ['glm', 'stats'],           // stats
			['Reduce', 'base'], ['qr', 'base'],          // base
			['install.packages', 'utils'],               // utils
		];
		const code = cases.map(([c]) => `${c}(x)`).join('\n');
		const res = await analyze(ts, code, db);
		for(const [call, owner] of cases) {
			expect(baseRExportOwner(call), `${call} is a generated base export`).toBe(owner);   // the source of truth
			expect(qualifiedName(res, call), `${call} qualifies end-to-end`).toBe(`${owner}::${call}`);
			expect(callResolvesTo(res.df, call, owner, call)).toBe(false);   // still nothing attached (linkBaseR off)
		}
	});
}));

describe('plugin robustness: a throwing version plugin does not abort the analysis', withTreeSitter(ts => {
	test(label('a plugin that throws is isolated; the other plugins still resolve the library', ['library-loading'], ['dataflow']), async() => {
		const dir = sigTmpDir('link-sigdb-');
		const db = await buildDb(dir);
		// register a plugin that always throws ALONGSIDE the working sigdb plugin
		const analyzer = await new FlowrAnalyzerBuilder().setParser(ts)
			.unregisterPlugins(SigDbPluginName)
			.registerPlugins(new ThrowingVersionsPlugin(), new FlowrAnalyzerPackageVersionsSigDbPlugin(db))
			.build();
		analyzer.addRequest('library(stats)\narima()');
		// the whole analysis still completes and stats still resolves -- the throw was contained to its plugin
		const df = await analyzer.dataflow();
		expect(callResolvesTo(df, 'arima', 'stats', 'arima')).toBe(true);
	});
}));

describe('sigdb source mounting: preload survives re-registration', withTreeSitter(ts => {
	test(label('a preloaded .br bundle is not lost when the plugin is re-registered (process)', ['library-loading'], ['dataflow']), async() => {
		const dir = sigTmpDir('link-sigdb-');
		const b = new SigDbBuilder();
		b.addPackage('cranpkg', { latest: '1.0.0', downloads: 5 });
		b.addVersion('cranpkg', '1.0.0', ver([expFn('cranfn')]));
		await writeSignatureDb(path.join(dir, 'db'), b.build({ date: '2026-05-23', generated: 0 }));
		const brPath = path.join(dir, `db${SigDbExt}.br`);   // only preload() can open a `.br` shard (loadSync cannot)

		// control: WITHOUT preload the .br cannot be mounted synchronously, so cranpkg does not resolve
		const noPreload = await analyze(ts, 'library(cranpkg)\ncranfn()', brPath as unknown as PackageSignatureSource);
		expect(hasBuiltIn(noPreload.df, 'cranpkg', 'cranfn')).toBe(false);

		// with preload the .br is mounted; re-registering the SAME instance (build -> process()) must keep it
		const plugin = new FlowrAnalyzerPackageVersionsSigDbPlugin(brPath);
		await plugin.preload();
		const analyzer = await new FlowrAnalyzerBuilder().setParser(ts)
			.unregisterPlugins(SigDbPluginName).registerPlugins(plugin).build();
		analyzer.addRequest('library(cranpkg)\ncranfn()');
		const df = await analyzer.dataflow();
		expect(hasBuiltIn(df, 'cranpkg', 'cranfn')).toBe(true);   // preloaded bundle survived process()
	});
}));

describe('sigdb system: the assumed R version gates which base packages are attached', withTreeSitter(ts => {
	/** a db whose base package `parallel` mirrors reality: it only became R-core in R 2.14.0 (per the base-package store) */
	async function dbWithParallel(dir: string): Promise<SigDatabase> {
		const b = new SigDbBuilder();
		b.addPackage('parallel', { latest: '4.5.0', core: true });
		b.addVersion('parallel', '4.5.0', ver([expFn('mclapply')]));
		return writeAndOpen(dir, b.build({ date: '2026-05-23', generated: 0 }));
	}

	function linkBaseAt(rVersion: string): FlowrConfig {
		return FlowrConfig.amend(FlowrConfig.default(), c => {
			c.solver.sigdb.linkBaseR = true;
			c.solver.sigdb.assumedRVersion = rVersion;
		});
	}

	test(label('parallel attaches for R 4.5 but not for R 2.10 (it predates the package in core)', ['library-loading', 'search-path'], ['dataflow']), async() => {
		const dir = sigTmpDir('link-sigdb-');
		const db = await dbWithParallel(dir);
		// R 4.5.0: `parallel` is a base package -> its export is attached and the bare call resolves
		const modern = await analyze(ts, 'mclapply(x)', db, linkBaseAt('4.5.0'));
		expect(modern.analyzer.inspectContext().resolvedRVersion).toBe('4.5.0');
		expect(hasBuiltIn(modern.df, 'parallel', 'mclapply')).toBe(true);
		// R 2.10.0: `parallel` was not yet part of R core, so the base-package list excludes it -> nothing attached
		const ancient = await analyze(ts, 'mclapply(x)', db, linkBaseAt('2.10.0'));
		expect(ancient.analyzer.inspectContext().resolvedRVersion).toBe('2.10.0');
		expect(hasBuiltIn(ancient.df, 'parallel', 'mclapply')).toBe(false);
	});
}));

describe('assumed-R fallback when the version predates every recorded core release', withTreeSitter(ts => {
	test(label('falls back to the closest supported version and logs it once as info', ['library-loading', 'search-path'], ['dataflow']), async() => {
		const dir = sigTmpDir('link-sigdb-');
		const db = await buildDb(dir);   // stats shipped in R 4.4.0 and 4.5.0
		const ancient = FlowrConfig.amend(FlowrConfig.default(), c => {
			c.solver.sigdb.assumedRVersion = '3.0.0';   // older than the earliest recorded (4.4.0)
		});
		const infoSpy = vi.spyOn(sigDbLog, 'info');
		const { df, analyzer } = await analyze(ts, 'library(stats)\narima()', db, ancient);
		expect(analyzer.inspectContext().resolvedRVersion).toBe('3.0.0');
		// arima is present in the closest (earliest, 4.4.0) release, so resolution still succeeds
		expect(callResolvesTo(df, 'arima', 'stats', 'arima')).toBe(true);
		expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining('predates the earliest recorded core release of stats'));
		infoSpy.mockRestore();
	});
}));

describe('sigdb system: rich package information is available end-to-end', withTreeSitter(ts => {
	/** a database whose single package carries exports, per-function signatures, call graphs AND declared dependencies */
	async function richDb(dir: string): Promise<SigDatabase> {
		const b = new SigDbBuilder();
		b.addPackage('richpkg', { latest: '1.2.3', downloads: 9 });
		b.addVersion('richpkg', '1.2.3', {
			cran:      true,
			functions: [
				{ name:   'greet', props:  FnProp.Exported, params: [
					{ name: 'name', missing: true, forced: true },
					{ name: 'greeting', default: '"hi"' },
					{ name: '...' }
				], callees: ['cat', 'paste'], file: 'R/greet.R', line: 1 },
				{ name: 'helper', props: 0, params: [{ name: 'x' }], callees: [], file: 'R/util.R', line: 3 }
			],
			dependencies: [
				{ name: 'utils', type: DepType.Imports, constraint: '>= 2.0' },
				{ name: 'methods', type: DepType.Depends }
			]
		});
		return writeAndOpen(dir, b.build({ date: '2026-05-23', generated: 0 }));
	}

	test(label('the analyzer resolves library() from the database, which also exposes signatures, call graphs and dependencies', ['library-loading', 'search-path'], ['dataflow']), async() => {
		const dir = sigTmpDir('link-sigdb-');
		const db = await richDb(dir);

		// (1) end-to-end through the analyzer: library(richpkg) attaches the exported function, not the internal helper
		const { df, analyzer } = await analyze(ts, 'library(richpkg)\ngreet()\nhelper()', db);
		expect(hasBuiltIn(df, 'richpkg', 'greet')).toBe(true);
		expect(callResolvesTo(df, 'greet', 'richpkg', 'greet')).toBe(true);
		expect(hasBuiltIn(df, 'richpkg', 'helper')).toBe(false);   // internal (not exported) -> not attached

		// (2) the analyzer's dependency view surfaces the resolved exports + version
		const dep = analyzer.inspectContext().deps.getDependency('richpkg');
		expect(dep?.namespaceInfo?.exportedSymbols).toContain('greet');
		expect(dep?.resolvedVersion).toBe('1.2.3');

		// (3) the mounted database exposes the rich per-function view: signature (forced/optional/default) + call graph
		const greet = (db.functions('richpkg') ?? []).find(f => f.name === 'greet');
		expect(greet?.exported).toBe(true);
		expect(greet?.signature.map(p => p.name)).toEqual(['name', 'greeting', '...']);
		expect(greet?.signature[0]).toMatchObject({ name: 'name', forced: true, optional: false });
		expect(greet?.signature[1]).toMatchObject({ name: 'greeting', optional: true, default: '"hi"' });
		expect(greet?.callees).toEqual(['cat', 'paste']);

		// (4) ...and the declared DESCRIPTION dependencies with their version qualifiers (order-independent)
		expect([...(db.dependencies('richpkg') ?? [])].sort((a, b) => a.name.localeCompare(b.name))).toEqual([
			{ name: 'methods', type: DepType.Depends },
			{ name: 'utils', type: DepType.Imports, constraint: '>= 2.0' }
		]);
		db.close();
	});
}));
