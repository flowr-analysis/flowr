import { describe, expect, test } from 'vitest';
import { assertDataflow, withTreeSitter } from '../../../_helper/shell';
import { FlowrAnalyzerBuilder } from '../../../../../src/project/flowr-analyzer-builder';
import type { FlowrAnalyzer } from '../../../../../src/project/flowr-analyzer';
import { Package } from '../../../../../src/project/plugins/package-version-plugins/package';
import { EdgeType } from '../../../../../src/dataflow/graph/edge';
import { emptyGraph } from '../../../../../src/dataflow/graph/dataflowgraph-builder';
import { NodeId } from '../../../../../src/r-bridge/lang-4.x/ast/model/processing/node-id';
import { label } from '../../../_helper/label';
import { EnvType, REnvironment } from '../../../../../src/dataflow/environments/environment';

describe('Namespace loading, import::from and box::use', withTreeSitter(ts => {
	const twoExports = (a: FlowrAnalyzer): void => {
		a.context().deps.addDependency(Package.fromConstants('pkgA', 'export(fa)\nexport(fb)', ['fa', 'fb']));
	};
	const withPkg = { modifyAnalyzer: twoExports, expectIsSubgraph: true, resolveIdsAsCriterion: true } as const;
	const faBuiltIn = NodeId.toBuiltIn(Package.funcIdentif('pkgA', 'fa'));
	const fbBuiltIn = NodeId.toBuiltIn(Package.funcIdentif('pkgA', 'fb'));

	assertDataflow(label('requireNamespace resolves :: but not bare names', ['library-loading', 'search-path']), ts,
		'requireNamespace("pkgA")\npkgA::fa()\nfa()',
		emptyGraph().addEdge('2@pkgA::fa', faBuiltIn, EdgeType.Reads | EdgeType.Calls),
		{ ...withPkg, mustNotHaveEdges: [['3@fa', faBuiltIn]] });

	assertDataflow(label('attachNamespace attaches exports as bare names', ['library-loading', 'search-path']), ts,
		'attachNamespace("pkgA")\nfa()',
		emptyGraph().addEdge('2@fa', faBuiltIn, EdgeType.Reads | EdgeType.Calls),
		withPkg);

	assertDataflow(label('import::from attaches only the named symbol', ['library-loading', 'search-path']), ts,
		'import::from(pkgA, fa)\nfa()\nfb()',
		emptyGraph().addEdge('2@fa', faBuiltIn, EdgeType.Reads | EdgeType.Calls),
		{ ...withPkg, mustNotHaveEdges: [[fbBuiltIn, '3@fb']] });

	assertDataflow(label('import::from alias binds under the new name', ['library-loading', 'search-path']), ts,
		'import::from(pkgA, keep = fa)\nkeep()',
		emptyGraph().addEdge('2@keep', faBuiltIn, EdgeType.Reads | EdgeType.Calls),
		withPkg);

	assertDataflow(label('bare use(pkg, a) attaches only the named symbol (extra-args form)', ['library-loading', 'search-path']), ts,
		'use(pkgA, fa)\nfa()\nfb()',
		emptyGraph().addEdge('2@fa', faBuiltIn, EdgeType.Reads | EdgeType.Calls),
		{ ...withPkg, mustNotHaveEdges: [[fbBuiltIn, '3@fb']] });

	assertDataflow(label('bare use(pkg) attaches every export (extra-args form)', ['library-loading', 'search-path']), ts,
		'use(pkgA)\nfa()\nfb()',
		emptyGraph()
			.addEdge('2@fa', faBuiltIn, EdgeType.Reads | EdgeType.Calls)
			.addEdge('3@fb', fbBuiltIn, EdgeType.Reads | EdgeType.Calls),
		withPkg);

	assertDataflow(label('box::use[a] attaches only the bracketed symbol', ['library-loading', 'search-path']), ts,
		'box::use(pkgA[fa])\nfa()\nfb()',
		emptyGraph().addEdge('2@fa', faBuiltIn, EdgeType.Reads | EdgeType.Calls),
		{ ...withPkg, mustNotHaveEdges: [[fbBuiltIn, '3@fb']] });

	assertDataflow(label('box::use[...] attaches every export', ['library-loading', 'search-path']), ts,
		'box::use(pkgA[...])\nfa()\nfb()',
		emptyGraph()
			.addEdge('2@fa', faBuiltIn, EdgeType.Reads | EdgeType.Calls)
			.addEdge('3@fb', fbBuiltIn, EdgeType.Reads | EdgeType.Calls),
		withPkg);

	// library-sensitive: box::use(pkg) is member access (namespace-only); the same bare use(pkg) without box attaches all
	assertDataflow(label('box::use(pkg) is namespace-only member access', ['library-loading', 'search-path']), ts,
		'box::use(pkgA)\npkgA::fa()\nfa()',
		emptyGraph().addEdge('2@pkgA::fa', faBuiltIn, EdgeType.Reads | EdgeType.Calls),
		{ ...withPkg, mustNotHaveEdges: [['3@fa', faBuiltIn]] });

	const withBoxAndPkg = (a: FlowrAnalyzer): void => {
		twoExports(a);
		a.context().deps.addDependency(Package.fromConstants('box', 'export(use)', ['use']));
	};
	// with box among the loaded dependencies, bare use(pkg) follows box (member access), not the extra-args form
	assertDataflow(label('use(pkg) is namespace-only when box is a loaded dependency', ['library-loading', 'search-path']), ts,
		'use(pkgA)\npkgA::fa()\nfa()',
		emptyGraph().addEdge('2@pkgA::fa', faBuiltIn, EdgeType.Reads | EdgeType.Calls),
		{ modifyAnalyzer: withBoxAndPkg, expectIsSubgraph: true, resolveIdsAsCriterion: true, mustNotHaveEdges: [['3@fa', faBuiltIn]] });

	test('requireNamespace produces a LoadedNamespace layer', async() => {
		const analyzer = await new FlowrAnalyzerBuilder().setParser(ts).build();
		twoExports(analyzer);
		analyzer.addRequest('requireNamespace("pkgA")');
		const df = await analyzer.dataflow();
		const layer = REnvironment.findGlobal(df.environment.current).parent;
		expect(layer.n).toBe('pkgA');
		expect(layer.t).toBe(EnvType.LoadedNamespace);
	});

	test('attachNamespace produces an attached Namespace layer', async() => {
		const analyzer = await new FlowrAnalyzerBuilder().setParser(ts).build();
		twoExports(analyzer);
		analyzer.addRequest('attachNamespace("pkgA")');
		const df = await analyzer.dataflow();
		const layer = REnvironment.findGlobal(df.environment.current).parent;
		expect(layer.n).toBe('pkgA');
		expect(layer.t).toBe(EnvType.Namespace);
	});
}));
