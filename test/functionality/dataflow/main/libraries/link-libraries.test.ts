import { describe, expect, test } from 'vitest';
import { assertDataflow, withTreeSitter } from '../../../_helper/shell';
import { FlowrAnalyzerBuilder } from '../../../../../src/project/flowr-analyzer-builder';
import type { FlowrAnalyzer } from '../../../../../src/project/flowr-analyzer';
import { Package } from '../../../../../src/project/plugins/package-version-plugins/package';
import { FlowrNamespaceFile, setCallable } from '../../../../../src/project/plugins/file-plugins/files/flowr-namespace-file';
import { FlowrInlineTextFile } from '../../../../../src/project/context/flowr-file';
import { EdgeType } from '../../../../../src/dataflow/graph/edge';
import { emptyGraph } from '../../../../../src/dataflow/graph/dataflowgraph-builder';
import { NodeId } from '../../../../../src/r-bridge/lang-4.x/ast/model/processing/node-id';
import { label } from '../../../_helper/label';
import { EnvType, REnvironment, builtInEnvJsonReplacer } from '../../../../../src/dataflow/environments/environment';
import type { TreeSitterExecutor } from '../../../../../src/r-bridge/lang-4.x/tree-sitter/tree-sitter-executor';

const ggplot2Callable = ['+', 'ggplot', 'aes', 'geom_point', 'geom_line', 'theme_bw', 'coord_cartesian', 'ggsave', 'fortify', 'scale_type'];
const namespaceContent = `S3method(fortify,data.frame)
	S3method(fortify,lm)
	S3method(fortify,default)
	S3method(fortify,map)
	S3method(scale_type,Date)
	S3method(scale_type,POSIXt)
	S3method(scale_type,character)
	S3method(scale_type,numeric)
	S3method(scale_type,factor)
	S3method(scale_type,default)
	S3method(ggplot,default)
	S3method(print,ggproto)
	S3method(print,rel)
	export("+")
	export(ggplot)
	export(aes)
	export(geom_point)
	export(geom_line)
	export(theme_bw)
	export(coord_cartesian)
	export(ggsave)
	export(fortify)
	export(scale_type)
	exportPattern("^[^\\\\.]\\\\.*$")
	import(grid)
	import(rlang)
	importFrom(scales,alpha)
	importFrom(stats,setNames)`;

const namespaceInfo = setCallable(FlowrNamespaceFile.from(new FlowrInlineTextFile('NAMESPACE', namespaceContent)).content().current, ggplot2Callable);

describe('Link libraries', withTreeSitter(ts => {
	assertDataflow(label('ggplot links to ggplot2', ['library-loading', 'search-path']), ts, 'library(ggplot2)\nggplot()\nggplot()',
		emptyGraph()
			.addEdge('2@ggplot', NodeId.fromPkgFn('ggplot2', 'ggplot'), EdgeType.Reads | EdgeType.Calls)
			.addEdge('3@ggplot', NodeId.fromPkgFn('ggplot2', 'ggplot'), EdgeType.Reads | EdgeType.Calls)
			.addEdge(NodeId.fromPkgFn('ggplot2', 'ggplot'), '1@library', EdgeType.Reads | EdgeType.Calls),
		{
			modifyAnalyzer: a => {
				a.context().deps.addDependency(new Package({
					name:          'ggplot2',
					namespaceInfo: namespaceInfo
				}));
			},
			expectIsSubgraph:      true,
			resolveIdsAsCriterion: true
		}
	);

	assertDataflow(label('No dependencies set', ['library-loading', 'search-path']), ts, 'library(ggplot2)\nggplot()',
		emptyGraph()
			.addEdge('2@ggplot', NodeId.toBuiltIn('ggplot'), EdgeType.Reads | EdgeType.Calls),
		{
			expectIsSubgraph:      true,
			resolveIdsAsCriterion: true,
			mustNotHaveEdges:      [[NodeId.fromPkgFn('ggplot2', 'ggplot'), 3], [NodeId.toBuiltIn('ggplot'), 3]]
		});

	assertDataflow(label('Several methods of same library', ['library-loading', 'search-path']), ts, 'library(ggplot2)\nggplot(data = NULL, mapping = aes())',
		emptyGraph()
			.addEdge('2@ggplot', NodeId.fromPkgFn('ggplot2', 'ggplot'), EdgeType.Reads | EdgeType.Calls)
			.addEdge(NodeId.fromPkgFn('ggplot2', 'ggplot'), '1@library', EdgeType.Reads | EdgeType.Calls)
			.addEdge('2@aes', NodeId.fromPkgFn('ggplot2', 'aes'), EdgeType.Reads | EdgeType.Calls)
			.addEdge(NodeId.fromPkgFn('ggplot2', 'aes'), '1@library', EdgeType.Reads | EdgeType.Calls),
		{
			modifyAnalyzer: a => {
				a.context().deps.addDependency(new Package({
					name:          'ggplot2',
					namespaceInfo: namespaceInfo
				}));
			},
			expectIsSubgraph:      true,
			resolveIdsAsCriterion: true
		}
	);

	assertDataflow(label('Links to several libraries', ['library-loading', 'search-path']), ts, 'library(ggplot2)\nlibrary(dplyr)\nggplot(data = NULL, mapping = aes())\nacross()',
		emptyGraph()
			.addEdge('3@ggplot', NodeId.fromPkgFn('ggplot2', 'ggplot'), EdgeType.Reads | EdgeType.Calls)
			.addEdge(NodeId.fromPkgFn('ggplot2', 'ggplot'), '1@library', EdgeType.Reads | EdgeType.Calls)
			.addEdge('1@library', '1@ggplot2', EdgeType.Argument)
			.addEdge('4@across', NodeId.fromPkgFn('dplyr', 'across'), EdgeType.Reads | EdgeType.Calls)
			.addEdge(NodeId.fromPkgFn('dplyr', 'across'), '2@library', EdgeType.Reads | EdgeType.Calls)
			.addEdge('2@library', '2@dplyr', EdgeType.Argument),
		{
			modifyAnalyzer: a => {
				a.context().deps.addDependency(new Package({
					name:          'ggplot2',
					namespaceInfo: namespaceInfo
				}));
				a.context().deps.addDependency(new Package({
					name:          'dplyr',
					namespaceInfo: setCallable(FlowrNamespaceFile.from(new FlowrInlineTextFile('NAMESPACE', 'export(across)')).content().current, ['across'])
				}));;
			},
			expectIsSubgraph:      true,
			resolveIdsAsCriterion: true
		}
	);

	assertDataflow(label('pkgB overwrites bindings of pkgA', ['library-loading', 'search-path']), ts, 'library(pkgA)\nlibrary(pkgB)\nx()\npkgA::x()\ny()',
		emptyGraph()
			.addEdge('3@x', NodeId.fromPkgFn('pkgB', 'x'), EdgeType.Reads | EdgeType.Calls)
			.addEdge(NodeId.fromPkgFn('pkgB', 'x'), '2@library', EdgeType.Reads | EdgeType.Calls)
			.addEdge('2@library', '2@pkgB', EdgeType.Argument)
			.addEdge('5@y', NodeId.fromPkgFn('pkgB', 'y'), EdgeType.Reads | EdgeType.Calls)
			.addEdge(NodeId.fromPkgFn('pkgB', 'y'), '2@library', EdgeType.Reads | EdgeType.Calls)
			.addEdge('4@pkgA::x', NodeId.fromPkgFn('pkgA', 'x'), EdgeType.Reads | EdgeType.Calls)
			.addEdge(NodeId.fromPkgFn('pkgA', 'x'), '1@library', EdgeType.Reads | EdgeType.Calls)
			.addEdge('1@library', '1@pkgA', EdgeType.Argument),
		{
			modifyAnalyzer: a => {
				a.context().deps.addDependency(new Package({
					name:          'pkgA',
					namespaceInfo: setCallable(FlowrNamespaceFile.from(new FlowrInlineTextFile('NAMESPACE', 'export(x)\nexport(a)\nexport(b)\nexport(y)')).content().current, ['x', 'a', 'b', 'y'])
				}));
				a.context().deps.addDependency(new Package({
					name:          'pkgB',
					namespaceInfo: setCallable(FlowrNamespaceFile.from(new FlowrInlineTextFile('NAMESPACE', 'export(x)\nexport(y)\nexport(c)\nexport(d)\nexport(e)')).content().current, ['x', 'y', 'c', 'd', 'e'])
				}));;
			},
			expectIsSubgraph:      true,
			resolveIdsAsCriterion: true
		}
	);

	test('Simple import, check env structure', async() => {
		const analyzer = await new FlowrAnalyzerBuilder()
			.setParser(ts)
			.build();
		analyzer.context().deps.addDependency(new Package({
			name:          'ggplot2',
			namespaceInfo: namespaceInfo
		}));
		analyzer.addRequest('library(ggplot2)\nggplot()');
		const df = await analyzer.dataflow();
		let env = REnvironment.findGlobal(df.environment.current).parent;
		expect(env.n === 'ggplot2' && env.t === EnvType.Namespace).toBeTruthy();
		const exportedSymbols = ['+', 'ggplot', 'aes', 'geom_point', 'geom_line', 'theme_bw', 'coord_cartesian', 'ggsave', 'fortify', 'scale_type'];
		expect(compare(new Set(exportedSymbols), new Set(env.memory.keys()))).toBeTruthy();
		env = env.parent;
		expect(env.n === 'ggplot2' && env.t === EnvType.Imports).toBeTruthy();
		expect(new Set(env.memory.keys()).size === 0).toBeTruthy();
	});

	test('Not all exported functions are callable', async() => {
		const analyzer = await new FlowrAnalyzerBuilder()
			.setParser(ts)
			.build();
		analyzer.context().deps.addDependency(new Package({
			name:          'ggplot2',
			namespaceInfo: setCallable(FlowrNamespaceFile.from(new FlowrInlineTextFile('NAMESPACE', namespaceContent)).content().current, ['ggplot', 'aes', 'geom_point', 'print.rel'])
		}));
		analyzer.addRequest('library(ggplot2)\nggplot()');
		const df = await analyzer.dataflow();
		let env = REnvironment.findGlobal(df.environment.current).parent;
		expect(env.n === 'ggplot2' && env.t === EnvType.Namespace).toBeTruthy();
		const exportedSymbols = ['ggplot', 'aes', 'geom_point', 'print.rel'];
		expect(compare(new Set(exportedSymbols), new Set(env.memory.keys()))).toBeTruthy();
		env = env.parent;
		expect(env.n === 'ggplot2' && env.t === EnvType.Imports).toBeTruthy();
		expect(new Set(env.memory.keys()).size === 0).toBeTruthy();
	});

	test('Several libraries, check env structure', async() => {
		const analyzer = await new FlowrAnalyzerBuilder()
			.setParser(ts)
			.build();
		analyzer.context().deps.addDependency(new Package({
			name:          'ggplot2',
			namespaceInfo: namespaceInfo
		}));
		analyzer.context().deps.addDependency(new Package({
			name:          'random1',
			namespaceInfo: setCallable(FlowrNamespaceFile.from(new FlowrInlineTextFile('NAMESPACE', 'export(test1)\nexport(test2)')).content().current, ['test1', 'test2'])
		}));
		analyzer.addRequest('library(ggplot2)\nlibrary(random1)');
		const df = await analyzer.dataflow();
		let env = REnvironment.findGlobal(df.environment.current).parent;
		expect(env.n === 'random1' && env.t === EnvType.Namespace).toBeTruthy();
		expect(compare(new Set(['test1', 'test2']), new Set(env.memory.keys()))).toBeTruthy();
		env = env.parent;
		expect(env.n === 'random1' && env.t === EnvType.Imports).toBeTruthy();
		expect(new Set(env.memory.keys()).size === 0).toBeTruthy();
		env = env.parent;
		expect(env.n === 'ggplot2' && env.t === EnvType.Namespace).toBeTruthy();
		const exportedSymbols = ['+', 'ggplot', 'aes', 'geom_point', 'geom_line', 'theme_bw', 'coord_cartesian', 'ggsave', 'fortify', 'scale_type'];
		expect(compare(new Set(exportedSymbols), new Set(env.memory.keys()))).toBeTruthy();
		env = env.parent;
		expect(env.n === 'ggplot2' && env.t === EnvType.Imports).toBeTruthy();
		expect(new Set(env.memory.keys()).size === 0).toBeTruthy();
	});

	test('Multiple options for library keep every branch\'s layers', async() => {
		const layers = await loadedLayers(ts, 'if(u){ library(a) } else { library(b) }');
		expect(new Set(layers.map(l => `${l[0]}:${l[1]}`))).toEqual(new Set([
			`a:${EnvType.Namespace}`, `a:${EnvType.Imports}`, `b:${EnvType.Namespace}`, `b:${EnvType.Imports}`
		]));
	});

	test('Straight-line loading keeps R\'s attach order', async() => {
		expect(await loadedPackages(ts, 'library(a)\nlibrary(b)')).toEqual(['b', 'a']);
	});

	test('Re-loading an already attached package is a no-op', async() => {
		expect(await loadedPackages(ts, 'library(a)\nlibrary(b)\nlibrary(a)')).toEqual(['b', 'a']);
		expect(await loadedPackages(ts, 'library(a)\nlibrary(b)\nlibrary(c)\nlibrary(b)')).toEqual(['c', 'b', 'a']);
	});

	test('require attaches like library', async() => {
		expect(await loadedPackages(ts, 'require(a)\nrequire(b)')).toEqual(['b', 'a']);
	});

	assertDataflow(label('Exports resolve without an explicit callable list', ['library-loading', 'search-path']), ts, 'library(prod)\nfa()',
		emptyGraph().addEdge('2@fa', NodeId.fromPkgFn('prod', 'fa'), EdgeType.Reads | EdgeType.Calls),
		{
			modifyAnalyzer: (a: FlowrAnalyzer) => {
				a.context().deps.addDependency(new Package({
					name:          'prod',
					namespaceInfo: FlowrNamespaceFile.from(new FlowrInlineTextFile('NAMESPACE', 'export(fa)')).content().current
				}));
			},
			expectIsSubgraph: true, resolveIdsAsCriterion: true
		});

	test('Branch merge keeps every possibly attached package, deduplicated', async() => {
		const overlap = await loadedPackages(ts, 'if(u){ library(a); library(b) } else { library(b); library(c) }');
		expect(new Set(overlap)).toEqual(new Set(['a', 'b', 'c']));
		expect(overlap.filter(l => l === 'b')).toHaveLength(1);
		// unequal number of libraries per branch still keeps all of them
		expect(new Set(await loadedPackages(ts, 'if(u){ library(a); library(c) } else { library(b) }'))).toEqual(new Set(['a', 'b', 'c']));
	});

	assertDataflow(label('Transitive super-assignment marks the outer call', ['library-loading', 'search-path']), ts,
		'h <- function() { x <<- 1 }\ng <- function() h()\ng()',
		emptyGraph().addEdge('1@x', '3@g', EdgeType.SideEffectOnCall),
		{ expectIsSubgraph: true, resolveIdsAsCriterion: true });

	assertDataflow(label('Transitive super-assignment resolves at a top-level read', ['library-loading', 'search-path']), ts,
		'f <- function() { x <<- 1 }\ng <- function() { f() }\ng()\nprint(x)',
		emptyGraph().addEdge('4@x', '1@x', EdgeType.Reads),
		{ expectIsSubgraph: true, resolveIdsAsCriterion: true });

	assertDataflow(label('Global definition shadows a package export', ['library-loading', 'search-path']), ts,
		'fa <- function() 1\nlibrary(pkgA)\nfa()',
		emptyGraph().addEdge('3@fa', '1@fa', EdgeType.Reads),
		{
			modifyAnalyzer: (a: FlowrAnalyzer) => {
				a.context().deps.addDependency(Package.fromConstants('pkgA', 'export(fa)', ['fa']));
			},
			expectIsSubgraph:      true,
			resolveIdsAsCriterion: true
		});

	const registerAbc = (a: FlowrAnalyzer): void => {
		a.context().deps
			.addDependency(Package.fromConstants('pkgA', 'export(fa)', ['fa']))
			.addDependency(Package.fromConstants('pkgB', 'export(fb)', ['fb']))
			.addDependency(Package.fromConstants('pkgC', 'export(fc)', ['fc']));
	};

	/** Builds the expected subgraph for calls that resolve to a package export and back to its `library()` call. */
	const resolvesTo = (...links: { call: string, pkg: string, fn: string, lib: string, callEdge?: number }[]) => {
		let g = emptyGraph();
		for(const { call, pkg, fn, lib, callEdge } of links) {
			const builtIn = NodeId.fromPkgFn(pkg, fn);
			g = g.addEdge(call, builtIn, callEdge ?? (EdgeType.Reads | EdgeType.Calls))
				.addEdge(builtIn, lib, EdgeType.Reads | EdgeType.Calls);
		}
		return g;
	};
	const abc = { modifyAnalyzer: registerAbc, expectIsSubgraph: true, resolveIdsAsCriterion: true } as const;

	assertDataflow(label('Nested if-else links each call to its package', ['library-loading', 'search-path']), ts,
		'if(u) {\n  if(v) {\n    library(pkgA)\n  } else {\n    library(pkgB)\n  }\n} else {\n  library(pkgC)\n}\nfa()\nfb()\nfc()',
		resolvesTo(
			{ call: '10@fa', pkg: 'pkgA', fn: 'fa', lib: '3@library' },
			{ call: '11@fb', pkg: 'pkgB', fn: 'fb', lib: '5@library' },
			{ call: '12@fc', pkg: 'pkgC', fn: 'fc', lib: '8@library' }),
		abc);

	assertDataflow(label('Library loaded in a while loop survives the loop', ['library-loading', 'search-path']), ts,
		'while(cond) {\n  library(pkgA)\n}\nfa()',
		resolvesTo({ call: '4@fa', pkg: 'pkgA', fn: 'fa', lib: '2@library' }),
		abc);

	assertDataflow(label('For loop keeps both the pre-loop and in-loop library', ['library-loading', 'search-path']), ts,
		'library(pkgA)\nfor(i in 1:10) {\n  library(pkgB)\n}\nfa()\nfb()',
		resolvesTo(
			{ call: '5@fa', pkg: 'pkgA', fn: 'fa', lib: '1@library' },
			{ call: '6@fb', pkg: 'pkgB', fn: 'fb', lib: '3@library' }),
		abc);

	// inside a function body the call is resolved lazily, so only the `calls` edge is present
	assertDataflow(label('Library is visible inside the function that loads it', ['library-loading', 'search-path']), ts,
		'library(pkgA)\nh <- function() {\n  fa()\n}\nh()',
		resolvesTo({ call: '3@fa', pkg: 'pkgA', fn: 'fa', lib: '1@library', callEdge: EdgeType.Calls }),
		abc);

	assertDataflow(label('Transitively loaded library resolves at the call site', ['library-loading', 'search-path']), ts,
		'g <- function() library(pkgA)\nf <- function() g()\nf()\nfa()',
		resolvesTo({ call: '4@fa', pkg: 'pkgA', fn: 'fa', lib: '1@library', callEdge: EdgeType.Calls }),
		abc);

	assertDataflow(label('Recursive library loader terminates and resolves', ['library-loading', 'search-path']), ts,
		'f <- function() { library(pkgA); f() }\nf()\nfa()',
		resolvesTo({ call: '3@fa', pkg: 'pkgA', fn: 'fa', lib: '1@library' }),
		abc);

	assertDataflow(label('Diamond of helpers attaches every package', ['library-loading', 'search-path']), ts,
		'a <- function() library(pkgA)\nb <- function() library(pkgB)\nf <- function() { a(); b() }\nf()\nfa()\nfb()',
		resolvesTo(
			{ call: '5@fa', pkg: 'pkgA', fn: 'fa', lib: '1@library', callEdge: EdgeType.Calls },
			{ call: '6@fb', pkg: 'pkgB', fn: 'fb', lib: '2@library', callEdge: EdgeType.Calls }),
		abc);

	assertDataflow(label('Higher-order library loader propagates', ['library-loading', 'search-path']), ts,
		'ap <- function(fn) fn()\nap(function() library(pkgA))\nfa()',
		resolvesTo({ call: '3@fa', pkg: 'pkgA', fn: 'fa', lib: '2@library', callEdge: EdgeType.Calls }),
		abc);

	// transitive propagation through control flow in/around helpers, kept even when the branch/loop is only maybe-taken

	assertDataflow(label('Conditional library in a helper propagates', ['library-loading', 'search-path']), ts,
		'g <- function(c) { if(c) library(pkgA) }\nf <- function() g(u)\nf()\nfa()',
		resolvesTo({ call: '4@fa', pkg: 'pkgA', fn: 'fa', lib: '1@library', callEdge: EdgeType.Calls }),
		abc);

	assertDataflow(label('Branch over library-loading helpers keeps both', ['library-loading', 'search-path']), ts,
		'a <- function() library(pkgA)\nb <- function() library(pkgB)\nf <- function() if(u) a() else b()\nf()\nfa()\nfb()',
		resolvesTo(
			{ call: '5@fa', pkg: 'pkgA', fn: 'fa', lib: '1@library', callEdge: EdgeType.Calls },
			{ call: '6@fb', pkg: 'pkgB', fn: 'fb', lib: '2@library', callEdge: EdgeType.Calls }),
		abc);

	assertDataflow(label('Library in a helper called from a loop propagates', ['library-loading', 'search-path']), ts,
		'h <- function() library(pkgA)\nf <- function() for(i in 1:3) h()\nf()\nfa()',
		resolvesTo({ call: '4@fa', pkg: 'pkgA', fn: 'fa', lib: '1@library', callEdge: EdgeType.Calls }),
		abc);

	assertDataflow(label('Conditional recursion loader terminates and resolves', ['library-loading', 'search-path']), ts,
		'f <- function(n) { if(n > 0) { library(pkgA); f(n - 1) } }\nf(2)\nfa()',
		resolvesTo({ call: '3@fa', pkg: 'pkgA', fn: 'fa', lib: '1@library' }),
		abc);

	assertDataflow(label('Conditional library attaches (definite, over-approximation)', ['library-loading', 'search-path']), ts,
		'if(u) library(pkgA)\nfa()',
		resolvesTo({ call: '2@fa', pkg: 'pkgA', fn: 'fa', lib: '1@library' }),
		abc);

	// the call node itself reads the library() load, in addition to the export -> library link
	assertDataflow(label('A package call reads its library() load directly', ['library-loading', 'search-path']), ts,
		'library(pkgA)\nfa()',
		emptyGraph()
			.addEdge('2@fa', NodeId.fromPkgFn('pkgA', 'fa'), EdgeType.Reads | EdgeType.Calls)
			.addEdge('2@fa', '1@library', EdgeType.Reads),
		abc);

	// with no database, the load is still known syntactically, so an explicit pkgA::fa links back to it
	assertDataflow(label('An explicit pkg::fn links to library() without a database', ['library-loading', 'search-path']), ts,
		'library(pkgA)\npkgA::fa(x)',
		emptyGraph().addEdge('2@pkgA::fa', '1@library', EdgeType.Reads),
		{ expectIsSubgraph: true, resolveIdsAsCriterion: true });

	// regression: below-global markers must survive JSON serialization
	test('serialization preserves the global marker and attached-package layers', async() => {
		const analyzer = await new FlowrAnalyzerBuilder().setParser(ts).build();
		analyzer.context().deps.addDependency(Package.fromConstants('pkgA', 'export(fa)', ['fa']));
		analyzer.addRequest('library(pkgA)\nfa()');
		const df = await analyzer.dataflow();
		interface EnvJson { globalEnv?: boolean, n?: string, t?: string, parent: EnvJson }
		const json = JSON.parse(JSON.stringify(df.environment.current, builtInEnvJsonReplacer)) as EnvJson;
		expect(json.globalEnv).toBe(true);
		expect(json.parent.n).toBe('pkgA');
		expect(json.parent.t).toBe(EnvType.Namespace);
		expect(json.parent.parent.t).toBe(EnvType.Imports);
	});

	assertDataflow(label('library loaded in an uncalled function is not attached', ['library-loading', 'search-path']), ts,
		'f <- function() library(pkgA)\nfa()',
		emptyGraph(),
		{
			modifyAnalyzer: a => {
				a.context().deps.addDependency(Package.fromConstants('pkgA', 'export(fa)', ['fa']));
			},
			expectIsSubgraph:      true,
			resolveIdsAsCriterion: true,
			mustNotHaveEdges:      [['2@fa', NodeId.fromPkgFn('pkgA', 'fa')]]
		});

	test('package with no exports attaches without spurious edges', async() => {
		const analyzer = await new FlowrAnalyzerBuilder().setParser(ts).build();
		analyzer.context().deps.addDependency(Package.fromConstants('pkgEmpty', 'import(grid)', []));
		analyzer.addRequest('library(pkgEmpty)\nfoo()');
		const df = await analyzer.dataflow();
		expect(REnvironment.findGlobal(df.environment.current).parent.n).toBe('pkgEmpty');
		for(const [id] of df.graph.vertices(true)) {
			expect(String(id)).not.toContain('pkgEmpty:');
		}
	});
}));

/** Loads the given `code` (with dummy packages `a`, `b`, `c` registered) and returns its leading library layers as `[name, type]`, nearest first. */
async function loadedLayers(ts: TreeSitterExecutor, code: string): Promise<[string | undefined, EnvType | undefined][]> {
	const analyzer = await new FlowrAnalyzerBuilder().setParser(ts).build();
	for(const n of ['a', 'b', 'c']) {
		analyzer.context().deps.addDependency(Package.fromConstants(n, 'export(test1)\nexport(test2)', ['test1', 'test2']));
	}
	analyzer.addRequest(code);
	const df = await analyzer.dataflow();
	const layers: [string | undefined, EnvType | undefined][] = [];
	// attached packages sit below the global env
	for(let env = REnvironment.findGlobal(df.environment.current).parent; env.t !== undefined; env = env.parent){
		layers.push([env.n, env.t]);
	}
	return layers;
}

/** The attached package names, nearest (most recently loaded) first. */
async function loadedPackages(ts: TreeSitterExecutor, code: string): Promise<(string | undefined)[]> {
	return (await loadedLayers(ts, code)).filter(l => l[1] === EnvType.Namespace).map(l => l[0]);
}

function compare<T>(s1: Set<T>, s2: Set<T>){
	return s1.difference(s2).size === 0 && s2.difference(s1).size === 0;
}