import { describe, expect, test } from 'vitest';
import { withTreeSitter } from '../../../_helper/shell';
import { FlowrAnalyzerBuilder } from '../../../../../src/project/flowr-analyzer-builder';
import { Package } from '../../../../../src/project/plugins/package-version-plugins/package';
import { FlowrNamespaceFile } from '../../../../../src/project/plugins/file-plugins/files/flowr-namespace-file';
import { FlowrInlineTextFile } from '../../../../../src/project/context/flowr-file';
import { Dataflow } from '../../../../../src/dataflow/graph/df-helper';
import { EdgeType } from '../../../../../src/dataflow/graph/edge';

describe('Link libraries', withTreeSitter(ts => {
	test('No dependencies set', async() => {
		const analyzer = await new FlowrAnalyzerBuilder()
			.setParser(ts)
			.build();
		analyzer.addRequest('library(ggplot2)\nggplot()');
		const df = await analyzer.dataflow();
		expect(df.graph.outgoingEdges('built-in:ggplot')?.get(3)).toBeUndefined();
		expect(df.graph.outgoingEdges(5)?.get('built-in:ggplot')?.types === EdgeType.Reads + EdgeType.Calls).toBeTruthy();
	});
	test('ggplot links to ggplot2', async() => {
		const analyzer = await new FlowrAnalyzerBuilder()
			.setParser(ts)
			.build();
		analyzer.context().deps.addDependency(new Package({
			name:          'ggplot2',
			namespaceInfo: FlowrNamespaceFile.from(new FlowrInlineTextFile('NAMESPACE', `S3method(fortify,data.frame)
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
importFrom(stats,setNames)`)).content().current
		}));
		analyzer.addRequest('library(ggplot2)\nggplot()\nggplot()');
		const df = await analyzer.dataflow();
		console.log(Dataflow.visualize.mermaid.url(df.graph));
		expect(df.graph.outgoingEdges(5)?.get('built-in:ggplot')?.types === EdgeType.Reads + EdgeType.Calls).toBeTruthy();
		expect(df.graph.outgoingEdges(7)?.get('built-in:ggplot')?.types === EdgeType.Reads + EdgeType.Calls).toBeTruthy();
		expect(df.graph.outgoingEdges('built-in:ggplot')?.get(3)?.types === EdgeType.Reads + EdgeType.Calls).toBeTruthy();
	});
	test('Several methods of same library', async() => {
		const analyzer = await new FlowrAnalyzerBuilder()
			.setParser(ts)
			.build();
		analyzer.context().deps.addDependency(new Package({
			name:          'ggplot2',
			namespaceInfo: FlowrNamespaceFile.from(new FlowrInlineTextFile('NAMESPACE', `S3method(fortify,data.frame)
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
importFrom(stats,setNames)`)).content().current
		}));
		analyzer.addRequest('library(ggplot2)\nggplot(data = NULL, mapping = aes())');
		const df = await analyzer.dataflow();
		expect(df.graph.outgoingEdges(12)?.get('built-in:ggplot')?.types === EdgeType.Reads + EdgeType.Calls).toBeTruthy();
		expect(df.graph.outgoingEdges('built-in:ggplot')?.get(3)?.types === EdgeType.Calls + EdgeType.Reads).toBeTruthy();
		expect(df.graph.outgoingEdges(10)?.get('built-in:aes')?.types === EdgeType.Reads + EdgeType.Calls).toBeTruthy();
		expect(df.graph.outgoingEdges('built-in:aes')?.get(3)?.types === EdgeType.Calls + EdgeType.Reads).toBeTruthy();
	});
	test('Links to several libraries', async() => {
		const analyzer = await new FlowrAnalyzerBuilder()
			.setParser(ts)
			.build();
		analyzer.context().deps.addDependency(new Package({
			name:          'ggplot2',
			namespaceInfo: FlowrNamespaceFile.from(new FlowrInlineTextFile('NAMESPACE', `S3method(fortify,data.frame)
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
importFrom(stats,setNames)`)).content().current
		}));
		analyzer.context().deps.addDependency(new Package({
			name:          'dplyr',
			namespaceInfo: FlowrNamespaceFile.from(new FlowrInlineTextFile('NAMESPACE', 'export(across)')).content().current
		}));
		analyzer.addRequest('library(ggplot2)\nlibrary(dplyr)\nggplot(data = NULL, mapping = aes())\nacross()');
		const df = await analyzer.dataflow();
		console.log(Dataflow.visualize.mermaid.url(df.graph));
		expect(df.graph.outgoingEdges(16)?.get('built-in:ggplot')?.types === EdgeType.Reads + EdgeType.Calls).toBeTruthy();
		expect(df.graph.outgoingEdges('built-in:ggplot')?.get(3)?.types === EdgeType.Reads + EdgeType.Calls).toBeTruthy();
		expect(df.graph.outgoingEdges(3)?.get(1)?.types === EdgeType.Argument).toBeTruthy();
		expect(df.graph.outgoingEdges(18)?.get('built-in:across')?.types === EdgeType.Reads + EdgeType.Calls).toBeTruthy();
		expect(df.graph.outgoingEdges('built-in:across')?.get(7)?.types === EdgeType.Reads + EdgeType.Calls).toBeTruthy();
		expect(df.graph.outgoingEdges(7)?.get(5)?.types === EdgeType.Argument).toBeTruthy();
	});
}));

describe('Linked library imports libraries', withTreeSitter(ts => {
	test('Linked library loads imported (already imported) library', async() => {
		const analyzer = await new FlowrAnalyzerBuilder()
			.setParser(ts)
			.build();
		analyzer.context().deps.addDependency(new Package({
			name:          'ggplot2',
			namespaceInfo: FlowrNamespaceFile.from(new FlowrInlineTextFile('NAMESPACE', `S3method(fortify,data.frame)
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
importFrom(stats,setNames)
import(random_placeholder)`)).content().current
		}));
		analyzer.context().deps.addDependency(new Package({
			name:          'random_placeholder',
			namespaceInfo: FlowrNamespaceFile.from(new FlowrInlineTextFile('NAMESPACE', 'export(test1)\nexport(test2)\nimport(ggplot2)\nimportFrom(random_placeholder3, a)')).content().current
		}));
		analyzer.context().deps.addDependency(new Package({
			name:          'random_placeholder2',
			namespaceInfo: FlowrNamespaceFile.from(new FlowrInlineTextFile('NAMESPACE', 'export(test1)\nexport(test2)\nexport(test3)\nimport(random_placeholder)')).content().current
		}));
		analyzer.context().deps.addDependency(new Package({
			name:          'random_placeholder3',
			namespaceInfo: FlowrNamespaceFile.from(new FlowrInlineTextFile('NAMESPACE', 'export(a)\nexport(b)\nimportFrom(random_placeholder2, test3)')).content().current
		}));
		analyzer.addRequest('library(ggplot2)\nggplot()');

		const df = await analyzer.dataflow();
		let env = df.environment.current;
		console.log(env);
		const ggplotSymbols = ['+', 'ggplot', 'aes', 'geom_point', 'geom_line', 'theme_bw', 'coord_cartesian', 'ggsave', 'fortify', 'scale_type'];
		const rPSsymbols = ['test1', 'test2'];
		//const rP2Symbols = ['test1', 'test2', 'test3'];
		//const rP3Symbols = ['a', 'b'];
		//namespace:ggplot -> imports:ggplot -> globalEnv -> package:ggplot -> ...
		//ggplot namespace
		expect(env.n === 'ggplot2' && env.t === 'namespace' && compare(new Set(ggplotSymbols), new Set(env.memory.keys()))).toBeTruthy();
		//ggplot imports
		env = env.parent;
		const imported = rPSsymbols.map(v => 'random_placeholder:' + v).concat(ggplotSymbols.map(v => 'ggplot2:' + v)).concat(['random_placeholder3:a', 'random_placeholder2:test3']);
		expect(env.n === 'ggplot2' && env.t === 'imports' && compare(new Set(imported), new Set(env.memory.keys()))).toBeTruthy();
		/*analyzer.addRequest('library(random_placeholder2)');
		df = await analyzer.dataflow();
		env = df.environment.current;
		console.log(env);
		expect(env.n === 'random_placeholder2' && env.t === 'namespace' && compare(new Set(r_p2_symbols), new Set(env.memory.keys()))).toBeTruthy();
		env = env.parent;
		expect(env.n === 'random_placeholder' && env.t === 'imports' && compare(new Set(imported), new Set(env.memory.keys()))).toBeTruthy();

		analyzer.addRequest('library(random_placeholder3)');
		df = await analyzer.dataflow();
		env = df.environment.current;
		expect(env.n === 'random_placeholder3' && env.t === 'namespace' && compare(new Set(r_p3_symbols), new Set(env.memory.keys()))).toBeTruthy();
		imported = ['random_placeholder2:test3'].concat(r_p_symbols.map(v => 'random_placeholder:' + v)).concat(ggplotSymbols.map(v => 'ggplot2:' + v));
		expect(env.n === 'random_placeholder3' && env.t === 'imports' && compare(new Set(imported), new Set(env.memory.keys()))).toBeTruthy();
		//ggplot package*/
		env = env.parent.parent;/*
		expect(env.n === 'random_placeholder3' && env.t === 'package' && compare(new Set(r_p3_symbols), new Set(env.memory.keys()))).toBeTruthy();
		env = env.parent;
		expect(env.n === 'random_placeholder2' && env.t === 'package' && compare(new Set(r_p2_symbols), new Set(env.memory.keys()))).toBeTruthy();
		env = env.parent;*/
		expect(env.n === 'ggplot2' && env.t === 'package' && compare(new Set(ggplotSymbols), new Set(env.memory.keys()))).toBeTruthy();
	});
	test('Linked library loads imported (unloaded) library', async() => {
		const analyzer = await new FlowrAnalyzerBuilder()
			.setParser(ts)
			.build();
		analyzer.context().deps.addDependency(new Package({
			name:          'ggplot2',
			namespaceInfo: FlowrNamespaceFile.from(new FlowrInlineTextFile('NAMESPACE', `S3method(fortify,data.frame)
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
importFrom(stats,setNames)
import(random_placeholder)`)).content().current
		}));
		analyzer.context().deps.addDependency(new Package({
			name:          'random_placeholder',
			namespaceInfo: FlowrNamespaceFile.from(new FlowrInlineTextFile('NAMESPACE', 'export(test1)\nexport(test2)')).content().current
		}));
		analyzer.addRequest('library(ggplot2)\nggplot()');
		const df = await analyzer.dataflow();
		let env = df.environment.current;
		const exportedSymbols = ['+', 'ggplot', 'aes', 'geom_point', 'geom_line', 'theme_bw', 'coord_cartesian', 'ggsave', 'fortify', 'scale_type'];
		//namespace:ggplot -> imports:ggplot -> globalEnv -> package:ggplot -> ...
		//ggplot namespace
		expect(env.n === 'ggplot2' && env.t === 'namespace' && compare(new Set(exportedSymbols), new Set(env.memory.keys()))).toBeTruthy();
		//ggplot imports
		env = env.parent;
		const imported = ['random_placeholder:test1', 'random_placeholder:test2'];
		console.log(env);
		expect(env.n === 'ggplot2' && env.t === 'imports' && compare(new Set(imported), new Set(env.memory.keys()))).toBeTruthy();
		//ggplot package
		env = env.parent.parent;
		expect(env.n === 'ggplot2' && env.t === 'package' && compare(new Set(exportedSymbols), new Set(env.memory.keys()))).toBeTruthy();
	});
	test('Linked library only partly imports another library', async() => {
		const analyzer = await new FlowrAnalyzerBuilder()
			.setParser(ts)
			.build();
		analyzer.context().deps.addDependency(new Package({
			name:          'ggplot2',
			namespaceInfo: FlowrNamespaceFile.from(new FlowrInlineTextFile('NAMESPACE', `S3method(fortify,data.frame)
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
importFrom(stats,setNames)
importFrom(random_placeholder, test1)`)).content().current
		}));
		analyzer.context().deps.addDependency(new Package({
			name:          'random_placeholder',
			namespaceInfo: FlowrNamespaceFile.from(new FlowrInlineTextFile('NAMESPACE', 'export(test1)\nexport(test2)')).content().current
		}));
		analyzer.addRequest('library(ggplot2)\nggplot()');
		const df = await analyzer.dataflow();
		let env = df.environment.current;
		const exportedSymbols = ['+', 'ggplot', 'aes', 'geom_point', 'geom_line', 'theme_bw', 'coord_cartesian', 'ggsave', 'fortify', 'scale_type'];
		//namespace:ggplot -> imports:ggplot -> globalEnv -> package:ggplot -> ...
		//ggplot namespace
		expect(env.n === 'ggplot2' && env.t === 'namespace' && compare(new Set(exportedSymbols), new Set(env.memory.keys()))).toBeTruthy();
		//ggplot imports
		env = env.parent;
		const imported = ['random_placeholder:test1'];
		console.log(env);
		expect(env.n === 'ggplot2' && env.t === 'imports' && compare(new Set(imported), new Set(env.memory.keys()))).toBeTruthy();
		//ggplot package
		env = env.parent.parent;
		expect(env.n === 'ggplot2' && env.t === 'package' && compare(new Set(exportedSymbols), new Set(env.memory.keys()))).toBeTruthy();
	});
}));

function compare<T>(s1: Set<T>, s2: Set<T>){
	return s1.difference(s2).size === 0 && s2.difference(s1).size === 0;
}
