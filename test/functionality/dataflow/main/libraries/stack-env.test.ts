import { describe } from 'vitest';
import { assertDataflow, withTreeSitter } from '../../../_helper/shell';
import type { FlowrAnalyzer } from '../../../../../src/project/flowr-analyzer';
import { Package } from '../../../../../src/project/plugins/package-version-plugins/package';
import { emptyGraph } from '../../../../../src/dataflow/graph/dataflowgraph-builder';
import { EdgeType } from '../../../../../src/dataflow/graph/edge';
import { NodeId } from '../../../../../src/r-bridge/lang-4.x/ast/model/processing/node-id';
import { label } from '../../../_helper/label';

// Env-returning builtins (globalenv/baseenv/emptyenv/...) point into the search-path stack, so `e$x` and
// `get("x", envir=e)` resolve into that environment. Expectations verified against real R.
describe('Env builtins point into the search-path stack', withTreeSitter(ts => {
	const opts = { expectIsSubgraph: true, resolveIdsAsCriterion: true } as const;
	const registerPkgA = (a: FlowrAnalyzer): void => {
		a.context().deps.addDependency(Package.fromConstants('pkgA', 'export(fa)', ['fa']));
	};
	const withPkgA = { ...opts, modifyAnalyzer: registerPkgA } as const;

	assertDataflow(label('globalenv() lets $ resolve into the global env', ['search-path', 'dynamic-environment-resolution']), ts,
		'x <- 1\ng <- globalenv()\ng$x',
		emptyGraph().addEdge('3@$', '1@x', EdgeType.Reads),
		opts);

	assertDataflow(label('emptyenv() is empty and does not resolve', ['search-path', 'dynamic-environment-resolution']), ts,
		'x <- 1\ne <- emptyenv()\ne$x',
		emptyGraph(),
		{ ...opts, mustNotHaveEdges: [['3@$', '1@x']] });

	assertDataflow(label('globalenv() direct $ resolves into the global env', ['search-path', 'dynamic-environment-resolution']), ts,
		'x <- 1\nglobalenv()$x',
		emptyGraph().addEdge('2@$', '1@x', EdgeType.Reads),
		opts);

	assertDataflow(label('.GlobalEnv direct $ resolves into the global env', ['search-path', 'dynamic-environment-resolution']), ts,
		'x <- 1\n.GlobalEnv$x',
		emptyGraph().addEdge('2@$', '1@x', EdgeType.Reads),
		opts);

	assertDataflow(label('assign to globalenv() falls through to the global scope', ['search-path', 'dynamic-environment-resolution']), ts,
		'assign("x", 42, envir = globalenv())\nx',
		emptyGraph().defineVariable('1@"x"', '"x"').use('2@x').reads('2@x', '1@"x"'),
		opts);

	assertDataflow(label('assign through a globalenv() variable reaches the global', ['search-path', 'dynamic-environment-resolution']), ts,
		'g <- globalenv()\nassign("x", 42, envir = g)\nx',
		emptyGraph().addEdge('3@x', '2@"x"', EdgeType.Reads),
		opts);

	assertDataflow(label('assign to globalenv() inside a function reaches the global', ['search-path', 'dynamic-environment-resolution']), ts,
		'f <- function() assign("x", 42, envir = globalenv())\nf()\nx',
		emptyGraph().addEdge('3@x', '1@"x"', EdgeType.Reads),
		opts);

	assertDataflow(label('get(envir = globalenv()) reaches the global definition', ['search-path', 'dynamic-environment-resolution']), ts,
		'x <- 1\nget("x", envir = globalenv())',
		emptyGraph().addEdge('2@"x"', '1@x', EdgeType.Reads),
		opts);

	assertDataflow(label('environment() resolves $ into the current (global) env', ['search-path', 'dynamic-environment-resolution']), ts,
		'x <- 1\nenvironment()$x',
		emptyGraph().addEdge('2@$', '1@x', EdgeType.Reads),
		opts);

	assertDataflow(label('as.environment("package:pkgA")$fa resolves to the package export', ['search-path', 'dynamic-environment-resolution']), ts,
		'library(pkgA)\nas.environment("package:pkgA")$fa',
		emptyGraph().addEdge('2@$', NodeId.toBuiltIn(Package.funcIdentif('pkgA', 'fa')), EdgeType.Reads),
		withPkgA);

	assertDataflow(label('parent.env(globalenv())$fa reaches the attached package export', ['search-path', 'dynamic-environment-resolution']), ts,
		'library(pkgA)\nparent.env(globalenv())$fa',
		emptyGraph().addEdge('2@$', NodeId.toBuiltIn(Package.funcIdentif('pkgA', 'fa')), EdgeType.Reads),
		withPkgA);
}));
