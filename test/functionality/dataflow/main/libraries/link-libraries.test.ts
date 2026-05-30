import { describe, expect, test } from 'vitest';
import { assertDataflow, withTreeSitter } from '../../../_helper/shell';
import { FlowrAnalyzerBuilder } from '../../../../../src/project/flowr-analyzer-builder';
import { Package } from '../../../../../src/project/plugins/package-version-plugins/package';
import { FlowrNamespaceFile } from '../../../../../src/project/plugins/file-plugins/files/flowr-namespace-file';
import { FlowrInlineTextFile } from '../../../../../src/project/context/flowr-file';
import { Dataflow } from '../../../../../src/dataflow/graph/df-helper';
import { EdgeType } from '../../../../../src/dataflow/graph/edge';
import { compare } from 'semver';
import { emptyGraph } from '../../../../../src/dataflow/graph/dataflowgraph-builder';
import { NodeId } from '../../../../../src/r-bridge/lang-4.x/ast/model/processing/node-id';
import { label } from '../../../_helper/label';

describe('Link libraries', withTreeSitter(ts => {
	assertDataflow(label('ggplot links to ggplot2'), ts, 'library(ggplot2)\nggplot()\nggplot()',
        emptyGraph()
		.addEdge(5, NodeId.toBuiltIn('ggplot'), EdgeType.Reads | EdgeType.Calls)
		.addEdge(7, NodeId.toBuiltIn('ggplot'), EdgeType.Reads | EdgeType.Calls)
		.addEdge(NodeId.toBuiltIn('ggplot'), 3, EdgeType.Reads | EdgeType.Calls),
            {
                modifyAnalyzer: a => {
                    a.context().deps.addDependency(new Package({
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
                },
                expectIsSubgraph:      true,
                resolveIdsAsCriterion: true
            }
        );
	assertDataflow(label('No dependencies set'), ts, 'library(ggplot2)\nggplot()', 
				emptyGraph()
				.addEdge(5, NodeId.toBuiltIn('ggplot'), EdgeType.Reads | EdgeType.Calls),
			{
				expectIsSubgraph:      true,
				resolveIdsAsCriterion: true,
				mustNotHaveEdges:      [[NodeId.toBuiltIn('ggplot'), 3]]
			});
	/*test('No dependencies set', async() => {
		const analyzer = await new FlowrAnalyzerBuilder()
			.setParser(ts)
			.build();
		analyzer.addRequest('library(ggplot2)\nggplot()');
		const df = await analyzer.dataflow();
		console.log(Dataflow.visualize.mermaid.url(df.graph))
		expect(df.graph.outgoingEdges('built-in:ggplot')?.get(3)).toBeUndefined();
		expect(df.graph.outgoingEdges(5)?.get('built-in:ggplot')?.types === EdgeType.Reads + EdgeType.Calls).toBeTruthy();
	});*/
	/*test('ggplot links to ggplot2', async() => {
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
	});*/
	assertDataflow(label('Several methods of same library'), ts, 'library(ggplot2)\nggplot(data = NULL, mapping = aes())',
        emptyGraph()
		.addEdge(12, NodeId.toBuiltIn('ggplot'), EdgeType.Reads | EdgeType.Calls)
		.addEdge(NodeId.toBuiltIn('ggplot'), 3, EdgeType.Reads | EdgeType.Calls)
		.addEdge(10, NodeId.toBuiltIn('aes'), EdgeType.Reads | EdgeType.Calls)
		.addEdge(NodeId.toBuiltIn('aes'), 3, EdgeType.Reads | EdgeType.Calls),
            {
                modifyAnalyzer: a => {
                    a.context().deps.addDependency(new Package({
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
                },
                expectIsSubgraph:      true,
                resolveIdsAsCriterion: true
            }
        );
	/*test('Several methods of same library', async() => {
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
		console.log(Dataflow.visualize.mermaid.url(df.graph));
		expect(df.graph.outgoingEdges(12)?.get('built-in:ggplot')?.types === EdgeType.Reads + EdgeType.Calls).toBeTruthy();
		expect(df.graph.outgoingEdges('built-in:ggplot')?.get(3)?.types === EdgeType.Calls + EdgeType.Reads).toBeTruthy();
		expect(df.graph.outgoingEdges(10)?.get('built-in:aes')?.types === EdgeType.Reads + EdgeType.Calls).toBeTruthy();
		expect(df.graph.outgoingEdges('built-in:aes')?.get(3)?.types === EdgeType.Calls + EdgeType.Reads).toBeTruthy();
	});*/
assertDataflow(label('Links to several libraries'), ts, 'library(ggplot2)\nlibrary(dplyr)\nggplot(data = NULL, mapping = aes())\nacross()',
        emptyGraph()
		.addEdge(16, NodeId.toBuiltIn('ggplot'), EdgeType.Reads | EdgeType.Calls)
		.addEdge(NodeId.toBuiltIn('ggplot'), 3, EdgeType.Reads | EdgeType.Calls)
		.addEdge(3, 1, EdgeType.Argument)
		.addEdge(18, NodeId.toBuiltIn('across'), EdgeType.Reads | EdgeType.Calls)
		.addEdge(NodeId.toBuiltIn('across'), 7, EdgeType.Reads | EdgeType.Calls)
		.addEdge(7, 5, EdgeType.Argument),
            {
                modifyAnalyzer: a => {
                    a.context().deps.addDependency(new Package({
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
			a.context().deps.addDependency(new Package({
			name:          'dplyr',
			namespaceInfo: FlowrNamespaceFile.from(new FlowrInlineTextFile('NAMESPACE', 'export(across)')).content().current
		}));;
                },
                expectIsSubgraph:      true,
                resolveIdsAsCriterion: true
            }
        );
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
	test('Simple env structure', async() => {
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
		analyzer.addRequest('library(ggplot2)\nggplot()');
		const df = await analyzer.dataflow();
		let env = df.environment.current;
		expect(env.n === 'ggplot2' && env.t === 'namespace').toBeTruthy();
		env = env.parent;
		expect(env.n === 'ggplot2' && env.t === 'imports').toBeTruthy();
		env = env.parent.parent;
		expect(env.n === 'ggplot2' && env.t === 'package').toBeTruthy();
	});
	test('Several libraries structure', async() => {
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
			name:          'random1',
			namespaceInfo: FlowrNamespaceFile.from(new FlowrInlineTextFile('NAMESPACE', 'export(test1)\nexport(test2)')).content().current
		}));
		analyzer.addRequest('library(ggplot2)\nlibrary(random1)');
		const df = await analyzer.dataflow();
		let env = df.environment.current;
		expect(env.n === 'random1' && env.t === 'namespace').toBeTruthy();
		env = env.parent;
		expect(env.n === 'random1' && env.t === 'imports').toBeTruthy();
		env = env.parent.parent;
		expect(env.n === 'random1' && env.t === 'package').toBeTruthy();
		env = env.parent;
		expect(env.n === 'ggplot2' && env.t === 'package').toBeTruthy();
	});
}));