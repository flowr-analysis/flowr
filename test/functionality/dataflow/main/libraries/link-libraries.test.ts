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
importFrom(stats,setNames)`)).content().current
		}));
		analyzer.context().deps.addDependency(new Package({
			name:          'dplyr',
			namespaceInfo: FlowrNamespaceFile.from(new FlowrInlineTextFile('NAMESPACE', 'export(across)\nexport(test)')).content().current
		}));
		analyzer.addRequest('library(ggplot2)\nlibrary(dplyr)\nggplot(data = NULL, mapping = aes())');
		const df = await analyzer.dataflow();
		//console.log(analyzer.context().env);
		console.log(df.environment.current);

	});
}));


describe('Link libraries with character.only', withTreeSitter(ts => {
	test('link with variable', async() => {
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
		analyzer.addRequest('x <- "ggplot2"; library(x, character.only = TRUE)\nggplot()\nggplot()');
		const df = await analyzer.dataflow();
		console.log(Dataflow.visualize.mermaid.url(df.graph));
		//correctly reads character.only
		expect(df.graph.outgoingEdges(9)?.get(8)?.types === EdgeType.Argument).toBeTruthy();
		expect(df.graph.outgoingEdges(8)?.get(7)?.types === EdgeType.Reads).toBeTruthy();
		expect(df.graph.idMap?.get(7)?.lexeme).toBeTruthy();
		//ggplot links to library
		expect(df.graph.outgoingEdges(11)?.get('built-in:ggplot')?.types === EdgeType.Reads + EdgeType.Calls).toBeTruthy();
		expect(df.graph.outgoingEdges(13)?.get('built-in:ggplot')?.types === EdgeType.Reads + EdgeType.Calls).toBeTruthy();
		expect(df.graph.outgoingEdges('built-in:ggplot')?.get(6)?.types === EdgeType.Reads + EdgeType.Calls).toBeTruthy();
	});
	test('link with string value', async() => {
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
		analyzer.addRequest('library("ggplot2", character.only = TRUE)\nggplot()\nggplot()');
		const df = await analyzer.dataflow();
		console.log(Dataflow.visualize.mermaid.url(df.graph));
		//correctly reads character.only
		console.log(df.graph);
		expect(df.graph.outgoingEdges(6)?.get(5)?.types === EdgeType.Argument).toBeTruthy();
		expect(df.graph.outgoingEdges(5)?.get(4)?.types === EdgeType.Reads).toBeTruthy();
		expect(df.graph.idMap?.get(4)?.lexeme).toBeTruthy();
		//ggplot2 links to library
		expect(df.graph.outgoingEdges(8)?.get('built-in:ggplot')?.types === EdgeType.Reads + EdgeType.Calls).toBeTruthy();
		expect(df.graph.outgoingEdges(10)?.get('built-in:ggplot')?.types === EdgeType.Reads + EdgeType.Calls).toBeTruthy();
		expect(df.graph.outgoingEdges('built-in:ggplot')?.get(6)?.types === EdgeType.Reads + EdgeType.Calls).toBeTruthy();
	});
}));

