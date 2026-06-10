import { describe, expect, test } from 'vitest';
import { assertDataflow, withTreeSitter } from '../../../_helper/shell';
import { FlowrAnalyzerBuilder } from '../../../../../src/project/flowr-analyzer-builder';
import { Package } from '../../../../../src/project/plugins/package-version-plugins/package';
import { FlowrNamespaceFile, setCallable } from '../../../../../src/project/plugins/file-plugins/files/flowr-namespace-file';
import { FlowrInlineTextFile } from '../../../../../src/project/context/flowr-file';
import { EdgeType } from '../../../../../src/dataflow/graph/edge';
import { emptyGraph } from '../../../../../src/dataflow/graph/dataflowgraph-builder';
import { NodeId } from '../../../../../src/r-bridge/lang-4.x/ast/model/processing/node-id';
import { label } from '../../../_helper/label';

const ggplot2Callable = ['+', 'ggplot', 'aes', 'geom_point', 'geom_line', 'theme_bw', 'coord_cartesian', 'ggsave', 'fortify', 'scale_type'];

describe('Link libraries', withTreeSitter(ts => {
	assertDataflow(label('ggplot links to ggplot2'), ts, 'library(ggplot2)\nggplot()\nggplot()',
		emptyGraph()
			.addEdge(5, NodeId.toBuiltIn('ggplot'), EdgeType.Reads |EdgeType.Calls)
			.addEdge(7, NodeId.toBuiltIn('ggplot'), EdgeType.Reads |EdgeType.Calls)
			.addEdge(NodeId.toBuiltIn('ggplot'), 3, EdgeType.Reads | EdgeType.Calls),
		{
			modifyAnalyzer: a => {
				a.context().deps.addDependency(new Package({
					name:          'ggplot2',
					namespaceInfo: setCallable(FlowrNamespaceFile.from(new FlowrInlineTextFile('NAMESPACE', `S3method(fortify,data.frame)
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
	importFrom(stats,setNames)`)).content().current, ggplot2Callable)
				}));
			},
			expectIsSubgraph:      true,
			resolveIdsAsCriterion: true
		}
	);

	assertDataflow(label('No dependencies set'), ts, 'library(ggplot2)\nggplot()',
		emptyGraph()
			.addEdge(5, NodeId.toBuiltIn('ggplot'), EdgeType.Reads |EdgeType.Calls),
		{
			expectIsSubgraph:      true,
			resolveIdsAsCriterion: true,
			mustNotHaveEdges:      [[NodeId.toBuiltIn('ggplot'), 3]]
		});

	assertDataflow(label('Several methods of same library'), ts, 'library(ggplot2)\nggplot(data = NULL, mapping = aes())',
		emptyGraph()
			.addEdge(12, NodeId.toBuiltIn('ggplot'), EdgeType.Reads |EdgeType.Calls)
			.addEdge(NodeId.toBuiltIn('ggplot'), 3, EdgeType.Reads |EdgeType.Calls)
			.addEdge(10, NodeId.toBuiltIn('aes'), EdgeType.Reads |EdgeType.Calls)
			.addEdge(NodeId.toBuiltIn('aes'), 3, EdgeType.Reads | EdgeType.Calls),
		{
			modifyAnalyzer: a => {
				a.context().deps.addDependency(new Package({
					name:          'ggplot2',
					namespaceInfo: setCallable(FlowrNamespaceFile.from(new FlowrInlineTextFile('NAMESPACE', `S3method(fortify,data.frame)
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
	importFrom(stats,setNames)`)).content().current, ggplot2Callable)
				}));
			},
			expectIsSubgraph:      true,
			resolveIdsAsCriterion: true
		}
	);

	assertDataflow(label('Links to several libraries'), ts, 'library(ggplot2)\nlibrary(dplyr)\nggplot(data = NULL, mapping = aes())\nacross()',
		emptyGraph()
			.addEdge(16, NodeId.toBuiltIn('ggplot'), EdgeType.Reads |EdgeType.Calls)
			.addEdge(NodeId.toBuiltIn('ggplot'), 3, EdgeType.Reads |EdgeType.Calls)
			.addEdge(3, 1, EdgeType.Argument)
			.addEdge(18, NodeId.toBuiltIn('across'), EdgeType.Reads |EdgeType.Calls)
			.addEdge(NodeId.toBuiltIn('across'), 7, EdgeType.Reads | EdgeType.Calls)
			.addEdge(7, 5, EdgeType.Argument),
		{
			modifyAnalyzer: a => {
				a.context().deps.addDependency(new Package({
					name:          'ggplot2',
					namespaceInfo: setCallable(FlowrNamespaceFile.from(new FlowrInlineTextFile('NAMESPACE', `S3method(fortify,data.frame)
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
	importFrom(stats,setNames)`)).content().current, ggplot2Callable)
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

	test('Simple import, check env structure', async() => {
		const analyzer = await new FlowrAnalyzerBuilder()
			.setParser(ts)
			.build();
		analyzer.context().deps.addDependency(new Package({
			name:          'ggplot2',
			namespaceInfo: setCallable(FlowrNamespaceFile.from(new FlowrInlineTextFile('NAMESPACE', `S3method(fortify,data.frame)
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
importFrom(stats,setNames)`)).content().current, ggplot2Callable)
		}));
		analyzer.addRequest('library(ggplot2)\nggplot()');
		const df = await analyzer.dataflow();
		let env = df.environment.current;
		expect(env.n === 'ggplot2' && env.t === 'namespace').toBeTruthy();
		const exportedSymbols = ['+', 'ggplot', 'aes', 'geom_point', 'geom_line', 'theme_bw', 'coord_cartesian', 'ggsave', 'fortify', 'scale_type'];
		expect(compare(new Set(exportedSymbols), new Set(env.memory.keys()))).toBeTruthy();
		env = env.parent;
		expect(env.n === 'ggplot2' && env.t === 'imports').toBeTruthy();
		expect(new Set(env.memory.keys()).size === 0).toBeTruthy();
	});

	test('Not all exported functions are callable', async() => {
		const analyzer = await new FlowrAnalyzerBuilder()
			.setParser(ts)
			.build();
		analyzer.context().deps.addDependency(new Package({
			name:          'ggplot2',
			namespaceInfo: setCallable(FlowrNamespaceFile.from(new FlowrInlineTextFile('NAMESPACE', `S3method(fortify,data.frame)
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
importFrom(stats,setNames)`)).content().current, ['ggplot', 'aes', 'geom_point'])
		}));
		analyzer.addRequest('library(ggplot2)\nggplot()');
		const df = await analyzer.dataflow();
		let env = df.environment.current;
		expect(env.n === 'ggplot2' && env.t === 'namespace').toBeTruthy();
		const exportedSymbols = ['ggplot', 'aes', 'geom_point'];
		expect(compare(new Set(exportedSymbols), new Set(env.memory.keys()))).toBeTruthy();
		env = env.parent;
		expect(env.n === 'ggplot2' && env.t === 'imports').toBeTruthy();
		expect(new Set(env.memory.keys()).size === 0).toBeTruthy();
	});

	test('Several libraries, check env structure', async() => {
		const analyzer = await new FlowrAnalyzerBuilder()
			.setParser(ts)
			.build();
		analyzer.context().deps.addDependency(new Package({
			name:          'ggplot2',
			namespaceInfo: setCallable(FlowrNamespaceFile.from(new FlowrInlineTextFile('NAMESPACE', `S3method(fortify,data.frame)
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
importFrom(stats,setNames)`)).content().current, ggplot2Callable)
		}));
		analyzer.context().deps.addDependency(new Package({
			name:          'random1',
			namespaceInfo: setCallable(FlowrNamespaceFile.from(new FlowrInlineTextFile('NAMESPACE', 'export(test1)\nexport(test2)')).content().current, ['test1', 'test2'])
		}));
		analyzer.addRequest('library(ggplot2)\nlibrary(random1)');
		const df = await analyzer.dataflow();
		let env = df.environment.current;
		expect(env.n === 'random1' && env.t === 'namespace').toBeTruthy();
		expect(compare(new Set(['test1', 'test2']), new Set(env.memory.keys()))).toBeTruthy();
		env = env.parent;
		expect(env.n === 'random1' && env.t === 'imports').toBeTruthy();
		expect(new Set(env.memory.keys()).size === 0).toBeTruthy();
		env = env.parent;
		expect(env.n === 'ggplot2' && env.t === 'namespace').toBeTruthy();
		const exportedSymbols = ['+', 'ggplot', 'aes', 'geom_point', 'geom_line', 'theme_bw', 'coord_cartesian', 'ggsave', 'fortify', 'scale_type'];
		expect(compare(new Set(exportedSymbols), new Set(env.memory.keys()))).toBeTruthy();
		env = env.parent;
		expect(env.n === 'ggplot2' && env.t === 'imports').toBeTruthy();
		expect(new Set(env.memory.keys()).size === 0).toBeTruthy();
	});
}));

function compare<T>(s1: Set<T>, s2: Set<T>){
	return s1.difference(s2).size === 0 && s2.difference(s1).size === 0;
}