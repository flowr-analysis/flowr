import { describe, expect, test } from 'vitest';
import { withTreeSitter } from '../../../_helper/shell';
import { FlowrAnalyzerBuilder } from '../../../../../src/project/flowr-analyzer-builder';
import { Package } from '../../../../../src/project/plugins/package-version-plugins/package';
import { Dataflow } from '../../../../../src/dataflow/graph/df-helper';
import { EdgeType } from '../../../../../src/dataflow/graph/edge';
import { FlowrNamespaceFile } from '../../../../../src/project/plugins/file-plugins/files/flowr-namespace-file';
import { FlowrInlineTextFile } from '../../../../../src/project/context/flowr-file';

describe('Link libraries with character.only', withTreeSitter(ts => {
	test.only('link with variable', async() => {
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
		analyzer.addRequest('x <- "ggplot2"\nlibrary(x, character.only = TRUE)\nggplot()\nggplot()');
		const df = await analyzer.dataflow();
		console.log(Dataflow.visualize.mermaid.url(df.graph));
		//correctly reads character.only
		/*expect(df.graph.outgoingEdges(9)?.get(8)?.types === EdgeType.Argument).toBeTruthy();
		expect(df.graph.outgoingEdges(8)?.get(7)?.types === EdgeType.Reads).toBeTruthy();
		expect(df.graph.idMap?.get(7)?.lexeme).toBeTruthy();*/
		//ggplot links to library
		expect(df.graph.outgoingEdges(11)?.get('built-in:ggplot')?.types === EdgeType.Reads + EdgeType.Calls).toBeTruthy();
		expect(df.graph.outgoingEdges(13)?.get('built-in:ggplot')?.types === EdgeType.Reads + EdgeType.Calls).toBeTruthy();
		expect(df.graph.outgoingEdges('built-in:ggplot')?.get(9)?.types === EdgeType.Reads + EdgeType.Calls).toBeTruthy();
	});
	test('link usually', async() => {
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
		analyzer.addRequest('library(ggplot2, character.only = FALSE)\nggplot()\nggplot()');
		const df = await analyzer.dataflow();
		console.log(Dataflow.visualize.mermaid.url(df.graph));
		console.log(df.graph);
		//graph has not character.only?
		expect(df.graph.outgoingEdges(8)?.get('built-in:ggplot')?.types === EdgeType.Reads + EdgeType.Calls).toBeTruthy();
		expect(df.graph.outgoingEdges(10)?.get('built-in:ggplot')?.types === EdgeType.Reads + EdgeType.Calls).toBeTruthy();
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
		/*expect(df.graph.outgoingEdges(6)?.get(5)?.types === EdgeType.Argument).toBeTruthy();
		expect(df.graph.outgoingEdges(5)?.get(4)?.types === EdgeType.Reads).toBeTruthy();
		expect(df.graph.idMap?.get(4)?.lexeme).toBeTruthy();*/
		//ggplot2 links to library
		expect(df.graph.outgoingEdges(8)?.get('built-in:ggplot')?.types === EdgeType.Reads + EdgeType.Calls).toBeTruthy();
		expect(df.graph.outgoingEdges(10)?.get('built-in:ggplot')?.types === EdgeType.Reads + EdgeType.Calls).toBeTruthy();
		expect(df.graph.outgoingEdges('built-in:ggplot')?.get(6)?.types === EdgeType.Reads + EdgeType.Calls).toBeTruthy();
	});
}));

