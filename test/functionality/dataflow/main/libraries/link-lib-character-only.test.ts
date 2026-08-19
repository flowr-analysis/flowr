import { describe, expect, test } from 'vitest';
import { assertDataflow, withTreeSitter } from '../../../_helper/shell';
import { Package } from '../../../../../src/project/plugins/package-version-plugins/package';
import { EdgeType } from '../../../../../src/dataflow/graph/edge';
import { FlowrNamespaceFile, setCallable } from '../../../../../src/project/plugins/file-plugins/files/flowr-namespace-file';
import { FlowrInlineTextFile } from '../../../../../src/project/context/flowr-file';
import { emptyGraph } from '../../../../../src/dataflow/graph/dataflowgraph-builder';
import { NodeId } from '../../../../../src/r-bridge/lang-4.x/ast/model/processing/node-id';
import { label } from '../../../_helper/label';
import { EnvType, REnvironment } from '../../../../../src/dataflow/environments/environment';
import { FlowrAnalyzerBuilder } from '../../../../../src/project/flowr-analyzer-builder';

const ggplot2Callable = ['+', 'ggplot', 'aes', 'geom_point', 'geom_line', 'theme_bw', 'coord_cartesian', 'ggsave', 'fortify', 'scale_type'];
const namespaceInfo = setCallable(FlowrNamespaceFile.from(new FlowrInlineTextFile('NAMESPACE', `S3method(fortify,data.frame)
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
importFrom(stats,setNames)`)).content().current, ggplot2Callable);

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
				a.context().deps.addDependency(new Package({
					name:          'ggplot2',
					namespaceInfo: namespaceInfo
				}));
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
				a.context().deps.addDependency(new Package({
					name:          'ggplot2',
					namespaceInfo: namespaceInfo
				}));
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
				a.context().deps.addDependency(new Package({
					name:          'ggplot2',
					namespaceInfo: namespaceInfo
				}));
			},
			expectIsSubgraph:      true,
			resolveIdsAsCriterion: true
		}
	);
	test('Variable can resolve to multiple options', async() => {
		const analyzer = await new FlowrAnalyzerBuilder()
			.setParser(ts)
			.build();
		analyzer.context().deps.addDependency(new Package({
			name:          'a',
			namespaceInfo: setCallable(FlowrNamespaceFile.from(new FlowrInlineTextFile('NAMESPACE', 'export(test1)\nexport(test2)')).content().current, ['test1', 'test2'])
		}));
		analyzer.context().deps.addDependency(new Package({
			name:          'b',
			namespaceInfo: setCallable(FlowrNamespaceFile.from(new FlowrInlineTextFile('NAMESPACE', 'export(test1)\nexport(test2)')).content().current, ['test1', 'test2'])
		}));
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
		for(let i = 0; i < 3; i++){
			env = env.parent;
			environments.push([env.n, env.t]);
		}
		const expected = [['b', EnvType.Namespace], ['b', EnvType.Imports], ['a', EnvType.Namespace], ['a', EnvType.Imports]];
		environments.sort();
		expected.sort();
		let match = environments.length === expected.length;
		for(let i = 0; i < Math.min(expected.length, environments.length); i++){
			match = match && expected[i][0] === environments[i][0] && environments[i][1] === expected[i][1];
		}
		expect(match).toBeTruthy();
	});
	test('Variable', async() => {
		const analyzer = await new FlowrAnalyzerBuilder()
			.setParser(ts)
			.build();
		analyzer.context().deps.addDependency(new Package({
			name:          'x',
			namespaceInfo: setCallable(FlowrNamespaceFile.from(new FlowrInlineTextFile('NAMESPACE', 'export(test1)\nexport(test2)')).content().current, ['test1', 'test2'])
		}));
		analyzer.context().deps.addDependency(new Package({
			name:          'foo',
			namespaceInfo: setCallable(FlowrNamespaceFile.from(new FlowrInlineTextFile('NAMESPACE', 'export(test1)\nexport(test2)')).content().current, ['test1', 'test2'])
		}));
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
		for(let i = 0; i < 3; i++){
			env = env.parent;
			environments.push([env.n, env.t]);
		}
		const expected = [['x', EnvType.Namespace], ['x', EnvType.Imports], ['foo', EnvType.Namespace], ['foo', EnvType.Imports]];
		environments.sort();
		expected.sort();
		let match = environments.length === expected.length;
		for(let i = 0; i < Math.min(expected.length, environments.length); i++){
			match = match && expected[i][0] === environments[i][0] && environments[i][1] === expected[i][1];
		}
		expect(match).toBeTruthy();
	});
}));