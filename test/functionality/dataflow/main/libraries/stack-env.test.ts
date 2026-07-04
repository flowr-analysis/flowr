import { describe, expect, test } from 'vitest';
import { assertDataflow, withTreeSitter } from '../../../_helper/shell';
import { FlowrAnalyzerBuilder } from '../../../../../src/project/flowr-analyzer-builder';
import { Package } from '../../../../../src/project/plugins/package-version-plugins/package';
import { emptyGraph } from '../../../../../src/dataflow/graph/dataflowgraph-builder';
import { EdgeType } from '../../../../../src/dataflow/graph/edge';
import { VertexType } from '../../../../../src/dataflow/graph/vertex';
import { NodeId } from '../../../../../src/r-bridge/lang-4.x/ast/model/processing/node-id';
import { label } from '../../../_helper/label';

/** The Reads targets of the (single) `$` access when analyzing `code` with package `pkg` (exporting `fa`) registered. */
async function dollarReadTargets(ts: Parameters<Parameters<typeof withTreeSitter>[0]>[0], code: string, pkg: string): Promise<string[]> {
	const analyzer = await new FlowrAnalyzerBuilder().setParser(ts).build();
	analyzer.context().deps.addDependency(Package.fromConstants(pkg, 'export(fa)', ['fa']));
	analyzer.addRequest(code);
	const df = await analyzer.dataflow();
	for(const [id, v] of df.graph.vertices(true)) {
		if(v.tag === VertexType.FunctionCall && String(v.name) === '$') {
			return [...(df.graph.outgoingEdges(id) ?? [])].filter(([, e]) => (e.types & EdgeType.Reads) !== 0).map(([t]) => String(t));
		}
	}
	return [];
}

// The env-returning builtins (globalenv/baseenv/emptyenv) point into the current search-path stack via `envState`,
// so `e$x` and `get("x", envir=e)` resolve into that environment (the latter shares the same resolveSymbolToEnvir
// bridge). Behaviour verified against real R.
describe('Env builtins point into the search-path stack', withTreeSitter(ts => {
	// g <- globalenv(); g$x resolves to the global x (real R: g$x == 1)
	assertDataflow(label('globalenv() lets $ resolve into the global env', ['search-path', 'dynamic-environment-resolution']), ts,
		'x <- 1\ng <- globalenv()\ng$x',
		emptyGraph().addEdge('3@$', '1@x', EdgeType.Reads),
		{ expectIsSubgraph: true, resolveIdsAsCriterion: true });

	// e <- emptyenv() is empty, so e$x resolves to nothing (real R: emptyenv()$x is NULL) - it must NOT read the global x
	assertDataflow(label('emptyenv() is empty and does not resolve', ['search-path', 'dynamic-environment-resolution']), ts,
		'x <- 1\ne <- emptyenv()\ne$x',
		emptyGraph(),
		{ expectIsSubgraph: true, resolveIdsAsCriterion: true, mustNotHaveEdges: [['3@$', '1@x']] });

	// direct forms (no intermediate variable): globalenv()$x and .GlobalEnv$x resolve into the global (real R: both == 1)
	assertDataflow(label('globalenv() direct $ resolves into the global env', ['search-path', 'dynamic-environment-resolution']), ts,
		'x <- 1\nglobalenv()$x',
		emptyGraph().addEdge('2@$', '1@x', EdgeType.Reads),
		{ expectIsSubgraph: true, resolveIdsAsCriterion: true });

	assertDataflow(label('.GlobalEnv direct $ resolves into the global env', ['search-path', 'dynamic-environment-resolution']), ts,
		'x <- 1\n.GlobalEnv$x',
		emptyGraph().addEdge('2@$', '1@x', EdgeType.Reads),
		{ expectIsSubgraph: true, resolveIdsAsCriterion: true });

	// writing to globalenv() is a real global assignment (falls through, not a private snapshot) - real R: x == 42 afterwards
	assertDataflow(label('assign to globalenv() falls through to the global scope', ['search-path', 'dynamic-environment-resolution']), ts,
		'assign("x", 42, envir = globalenv())\nx',
		emptyGraph().defineVariable('1@"x"', '"x"').use('2@x').reads('2@x', '1@"x"'),
		{ expectIsSubgraph: true, resolveIdsAsCriterion: true });

	// a write through a globalenv() variable also reaches the real global (real R: x == 42)
	assertDataflow(label('assign through a globalenv() variable reaches the global', ['search-path', 'dynamic-environment-resolution']), ts,
		'g <- globalenv()\nassign("x", 42, envir = g)\nx',
		emptyGraph().addEdge('3@x', '2@"x"', EdgeType.Reads),
		{ expectIsSubgraph: true, resolveIdsAsCriterion: true });

	// writing to globalenv() from inside a function reaches the real global, not the local scope (real R: x == 42)
	assertDataflow(label('assign to globalenv() inside a function reaches the global', ['search-path', 'dynamic-environment-resolution']), ts,
		'f <- function() assign("x", 42, envir = globalenv())\nf()\nx',
		emptyGraph().addEdge('3@x', '1@"x"', EdgeType.Reads),
		{ expectIsSubgraph: true, resolveIdsAsCriterion: true });

	// get() (which inherits) reaches the global definition through a direct globalenv() call - real R: get("x", envir=globalenv()) == 1
	test('get(envir = globalenv()) reaches the global definition', async() => {
		const analyzer = await new FlowrAnalyzerBuilder().setParser(ts).build();
		analyzer.addRequest('x <- 1\nget("x", envir = globalenv())');
		const df = await analyzer.dataflow();
		let xDef: NodeId | undefined;
		let getCall: NodeId | undefined;
		for(const [id, v] of df.graph.vertices(true)) {
			if(v.tag === VertexType.VariableDefinition) {
				xDef = id; // the sole variable definition in the program is x
			}
			if(v.tag === VertexType.FunctionCall && String(v.name) === 'get') {
				getCall = id;
			}
		}
		expect(xDef).toBeDefined();
		expect(getCall).toBeDefined();
		const seen = new Set<NodeId>();
		const queue: NodeId[] = [getCall as NodeId];
		while(queue.length > 0) {
			const node = queue.pop() as NodeId;
			if(seen.has(node)) {
				continue;
			}
			seen.add(node);
			for(const [target, edge] of df.graph.outgoingEdges(node) ?? []) {
				if((edge.types & (EdgeType.Reads | EdgeType.Argument)) !== 0) {
					queue.push(target);
				}
			}
		}
		expect(seen.has(xDef as NodeId)).toBe(true);
	});

	// environment() (no args) is the current environment - at top level that is the global (real R: environment()$x == 1)
	assertDataflow(label('environment() resolves $ into the current (global) env', ['search-path', 'dynamic-environment-resolution']), ts,
		'x <- 1\nenvironment()$x',
		emptyGraph().addEdge('2@$', '1@x', EdgeType.Reads),
		{ expectIsSubgraph: true, resolveIdsAsCriterion: true });

	// as.environment("package:pkgA") is the attached package's namespace, so $fa resolves to its export
	test('as.environment("package:pkgA")$fa resolves to the package export', async() => {
		const targets = await dollarReadTargets(ts, 'library(pkgA)\nas.environment("package:pkgA")$fa', 'pkgA');
		expect(targets).toContain(String(NodeId.toBuiltIn(Package.funcIdentif('pkgA', 'fa'))));
	});

	// parent.env(globalenv()) is the first attached package below global, so $fa reaches its export
	test('parent.env(globalenv())$fa reaches the attached package export', async() => {
		const targets = await dollarReadTargets(ts, 'library(pkgA)\nparent.env(globalenv())$fa', 'pkgA');
		expect(targets).toContain(String(NodeId.toBuiltIn(Package.funcIdentif('pkgA', 'fa'))));
	});
}));
