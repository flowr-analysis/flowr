import { describe, expect, test } from 'vitest';
import { assertDataflow, withTreeSitter } from '../../../_helper/shell';
import { EdgeType } from '../../../../../src/dataflow/graph/edge';
import { emptyGraph } from '../../../../../src/dataflow/graph/dataflowgraph-builder';
import { NodeId } from '../../../../../src/r-bridge/lang-4.x/ast/model/processing/node-id';
import { namespacePackage, ggplot2Package, addPackages } from '../../../_helper/sigdb';
import { label } from '../../../_helper/label';
import { EnvType, REnvironment } from '../../../../../src/dataflow/environments/environment';
import { FlowrAnalyzerBuilder } from '../../../../../src/project/flowr-analyzer-builder';


describe('Link libraries with character.only', withTreeSitter(ts => {
	assertDataflow(label('Link with variable', ['library-loading', 'search-path']), ts, 'x <- "ggplot2"\nlibrary(x, character.only = TRUE)\nggplot()\nggplot()',
		emptyGraph()
		//reads character.only
			.addEdge('2@library', 8, EdgeType.Argument)
			.addEdge(8, '2@TRUE', EdgeType.Reads)
		//ggplot links to library
			.addEdge('3@ggplot', NodeId.fromPkgFn('ggplot2', 'ggplot'), EdgeType.Reads | EdgeType.Calls)
			.addEdge('4@ggplot', NodeId.fromPkgFn('ggplot2', 'ggplot'), EdgeType.Reads | EdgeType.Calls)
			.addEdge(NodeId.fromPkgFn('ggplot2', 'ggplot'), '2@library', EdgeType.Reads | EdgeType.Calls),
		{
			modifyAnalyzer: a => {
				addPackages(a, ggplot2Package());
			},
			expectIsSubgraph:      true,
			resolveIdsAsCriterion: true
		}
	);
	assertDataflow(label('Link usually', ['library-loading', 'search-path']), ts, 'library(ggplot2, character.only = FALSE)\nggplot()\nggplot()',
		emptyGraph()
		//reads character.only
			.addEdge('1@library', 5, EdgeType.Argument)
			.addEdge(5, '1@FALSE', EdgeType.Reads)
		//correctly links
			.addEdge('2@ggplot', NodeId.fromPkgFn('ggplot2', 'ggplot'), EdgeType.Reads | EdgeType.Calls)
			.addEdge('3@ggplot', NodeId.fromPkgFn('ggplot2', 'ggplot'), EdgeType.Reads | EdgeType.Calls)
			.addEdge(NodeId.fromPkgFn('ggplot2', 'ggplot'), '1@library', EdgeType.Reads | EdgeType.Calls),
		{
			modifyAnalyzer: a => {
				addPackages(a, ggplot2Package());
			},
			expectIsSubgraph:      true,
			resolveIdsAsCriterion: true
		}
	);
	assertDataflow(label('link with string value', ['library-loading', 'search-path']), ts, 'library("ggplot2", character.only = TRUE)\nggplot()\nggplot()',
		emptyGraph()
		//reads character.only
			.addEdge('1@library', 5, EdgeType.Argument)
			.addEdge(5, '1@TRUE', EdgeType.Reads)
		//correctly links
			.addEdge('2@ggplot', NodeId.fromPkgFn('ggplot2', 'ggplot'), EdgeType.Reads | EdgeType.Calls)
			.addEdge('3@ggplot', NodeId.fromPkgFn('ggplot2', 'ggplot'), EdgeType.Reads | EdgeType.Calls)
			.addEdge(NodeId.fromPkgFn('ggplot2', 'ggplot'), '1@library', EdgeType.Reads | EdgeType.Calls),
		{
			modifyAnalyzer: a => {
				addPackages(a, ggplot2Package());
			},
			expectIsSubgraph:      true,
			resolveIdsAsCriterion: true
		}
	);
	test('Variable can resolve to multiple options', async() => {
		const analyzer = await new FlowrAnalyzerBuilder()
			.setParser(ts)
			.build();
		addPackages(analyzer, namespacePackage('a', 'export(test1)\nexport(test2)', ['test1', 'test2']));
		addPackages(analyzer, namespacePackage('b', 'export(test1)\nexport(test2)', ['test1', 'test2']));
		analyzer.addRequest(`
			if(t) {
  				u <- TRUE
			} else {
  				u <- FALSE
			}
			if(u) {
  				x <- "a"
			} else {
  				x <- "b"
			}
			library(x, character.only=TRUE)
			`);
		const df = await analyzer.dataflow();
		let env = REnvironment.findGlobal(df.environment.current).parent;
		const environments = [[env.n, env.t]];
		for(let i = 0; i < 3; i++) {
			env = env.parent;
			environments.push([env.n, env.t]);
		}
		const expected = [['b', EnvType.Namespace], ['b', EnvType.Imports], ['a', EnvType.Namespace], ['a', EnvType.Imports]];
		environments.sort();
		expected.sort();
		let match = environments.length === expected.length;
		for(let i = 0; i < Math.min(expected.length, environments.length); i++) {
			match = match && expected[i][0] === environments[i][0] && environments[i][1] === expected[i][1];
		}
		expect(match).toBeTruthy();
	});
	test('Variable', async() => {
		const analyzer = await new FlowrAnalyzerBuilder()
			.setParser(ts)
			.build();
		addPackages(analyzer, namespacePackage('x', 'export(test1)\nexport(test2)', ['test1', 'test2']));
		addPackages(analyzer, namespacePackage('foo', 'export(test1)\nexport(test2)', ['test1', 'test2']));
		analyzer.addRequest(`
			if(t){
				u <- TRUE
			} else {
				u <- FALSE
			}
			x <- "foo"
			library(x, character.only=u)
			`);
		const df = await analyzer.dataflow();
		let env = REnvironment.findGlobal(df.environment.current).parent;
		const environments = [[env.n, env.t]];
		for(let i = 0; i < 3; i++) {
			env = env.parent;
			environments.push([env.n, env.t]);
		}
		const expected = [['x', EnvType.Namespace], ['x', EnvType.Imports], ['foo', EnvType.Namespace], ['foo', EnvType.Imports]];
		environments.sort();
		expected.sort();
		let match = environments.length === expected.length;
		for(let i = 0; i < Math.min(expected.length, environments.length); i++) {
			match = match && expected[i][0] === environments[i][0] && environments[i][1] === expected[i][1];
		}
		expect(match).toBeTruthy();
	});
}));