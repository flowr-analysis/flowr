import { describe, expect, test } from 'vitest';
import { withTreeSitter } from '../../../_helper/shell';
import { FlowrAnalyzerBuilder } from '../../../../../src/project/flowr-analyzer-builder';
import { Package } from '../../../../../src/project/plugins/package-version-plugins/package';
import { FlowrNamespaceFile } from '../../../../../src/project/plugins/file-plugins/files/flowr-namespace-file';
import { FlowrInlineTextFile } from '../../../../../src/project/context/flowr-file';

describe('Linked library imports libraries', withTreeSitter(ts => {
	test('Linked library loads circular imports 1', async() => {
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
		//should be global env
		let env = df.environment.current;
		env = env.parent;
		const ggplotSymbols = ['+', 'ggplot', 'aes', 'geom_point', 'geom_line', 'theme_bw', 'coord_cartesian', 'ggsave', 'fortify', 'scale_type'];
		const rPSsymbols = ['test1', 'test2'];
		//globalEnv -> package:ggplot2 -> imports:ggplot2 -> ...
		//ggplot2 package
		expect(env.n === 'ggplot2' && env.t === 'package' && compare(new Set(ggplotSymbols), new Set(env.memory.keys()))).toBeTruthy();
		//ggplot2 imports
		env = env.parent;
		const imported = rPSsymbols.map(v => 'random_placeholder:' + v).concat(ggplotSymbols.map(v => 'ggplot2:' + v)).concat(['random_placeholder3:a']);
		expect(env.n === 'ggplot2' && env.t === 'imports' && compare(new Set(imported), new Set(env.memory.keys()))).toBeTruthy();
	});

	test('Linked library loads circular imports 2', async() => {
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
		analyzer.addRequest('library(ggplot2)\nlibrary(random_placeholder2)\nlibrary(random_placeholder3)\nggplot()');

		const df = await analyzer.dataflow();
		//should be global env
		let env = df.environment.current;
		env = env.parent;
		const ggplotSymbols = ['+', 'ggplot', 'aes', 'geom_point', 'geom_line', 'theme_bw', 'coord_cartesian', 'ggsave', 'fortify', 'scale_type'];
		const rP1symbols = ['test1', 'test2'];
		const rP2Symbols = ['test1', 'test2', 'test3'];
		const rP3Symbols = ['a', 'b'];
		//global environment -> random_placeholder3 package -> random_placeholder3 imports -> random_placeholder2 package -> random_placeholder2 imports -> ggplot2 package -> ggplot2 imports
		const imp3 = ['random_placeholder2:test3'];
		const imp2 = ['random_placeholder3:a'].concat(ggplotSymbols.map(v => 'ggplot2:' + v)).concat(rP1symbols.map(v => 'random_placeholder:' + v));
		const impggplot = rP1symbols.map(v => 'random_placeholder:' + v).concat(ggplotSymbols.map(v => 'ggplot2:' + v)).concat(['random_placeholder3:a']);
		expect(env.n === 'random_placeholder3' && env.t === 'package' && compare(new Set(rP3Symbols), new Set(env.memory.keys()))).toBeTruthy();
		env = env.parent;
		expect(env.n === 'random_placeholder3' && env.t === 'imports' && compare(new Set(imp3), new Set(env.memory.keys()))).toBeTruthy();
		env = env.parent;
		expect(env.n === 'random_placeholder2' && env.t === 'package' && compare(new Set(rP2Symbols), new Set(env.memory.keys()))).toBeTruthy();
		env = env.parent;
		expect(env.n === 'random_placeholder2' && env.t === 'imports' && compare(new Set(imp2), new Set(env.memory.keys()))).toBeTruthy();
		env = env.parent;
		expect(env.n === 'ggplot2' && env.t === 'package' && compare(new Set(ggplotSymbols), new Set(env.memory.keys()))).toBeTruthy();
		env = env.parent;
		expect(env.n === 'ggplot2' && env.t === 'imports' && compare(new Set(impggplot), new Set(env.memory.keys()))).toBeTruthy();
	});

	test('Linked library only partly imports another library (only importFrom)', async() => {
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
		//should be globalEnv
		let env = df.environment.current;
		env = env.parent;
		const exportedSymbols = ['+', 'ggplot', 'aes', 'geom_point', 'geom_line', 'theme_bw', 'coord_cartesian', 'ggsave', 'fortify', 'scale_type'];
		//globalEnv -> package:ggplot2 -> imports: ggplot2...
		//ggplot package
		expect(env.n === 'ggplot2' && env.t === 'package' && compare(new Set(exportedSymbols), new Set(env.memory.keys()))).toBeTruthy();
		//ggplot imports
		env = env.parent;
		const imported = ['random_placeholder:test1'];
		expect(env.n === 'ggplot2' && env.t === 'imports' && compare(new Set(imported), new Set(env.memory.keys()))).toBeTruthy();
	});

	test('Linked library imports another library', async() => {
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
		//should be globalEnv
		let env = df.environment.current;
		env = env.parent;
		const exportedSymbols = ['+', 'ggplot', 'aes', 'geom_point', 'geom_line', 'theme_bw', 'coord_cartesian', 'ggsave', 'fortify', 'scale_type'];
		//namespace:ggplot -> imports:ggplot -> globalEnv -> package:ggplot -> ...
		//ggplot package
		expect(env.n === 'ggplot2' && env.t === 'package' && compare(new Set(exportedSymbols), new Set(env.memory.keys()))).toBeTruthy();
		//ggplot imports
		env = env.parent;
		const imported = ['random_placeholder:test1', 'random_placeholder:test2'];
		expect(env.n === 'ggplot2' && env.t === 'imports' && compare(new Set(imported), new Set(env.memory.keys()))).toBeTruthy();
	});
}));

function compare<T>(s1: Set<T>, s2: Set<T>){
	return s1.difference(s2).size === 0 && s2.difference(s1).size === 0;
}