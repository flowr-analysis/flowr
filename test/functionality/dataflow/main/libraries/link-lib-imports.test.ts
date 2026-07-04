import { describe, expect, test } from 'vitest';
import { withTreeSitter } from '../../../_helper/shell';
import { FlowrAnalyzerBuilder } from '../../../../../src/project/flowr-analyzer-builder';
import { Package } from '../../../../../src/project/plugins/package-version-plugins/package';
import { FlowrNamespaceFile, setCallable } from '../../../../../src/project/plugins/file-plugins/files/flowr-namespace-file';
import { FlowrInlineTextFile } from '../../../../../src/project/context/flowr-file';
import { EnvType, REnvironment } from '../../../../../src/dataflow/environments/environment';

const ggplot2Callable = ['+', 'ggplot', 'aes', 'geom_point', 'geom_line', 'theme_bw', 'coord_cartesian', 'ggsave', 'fortify', 'scale_type'];
const randomPlaceholder1Callable = ['test1', 'test2'];
const randomPlaceholder2Callable = ['test1', 'test2', 'test3'];
const randomPlaceholder3Callable = ['a', 'b'];
const namespaceContent = `S3method(fortify,data.frame)
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
importFrom(stats,setNames)`;

describe('Linked library imports libraries', withTreeSitter(ts => {
	test('Linked library loads circular imports 1', async() => {
		const analyzer = await new FlowrAnalyzerBuilder()
			.setParser(ts)
			.build();
		analyzer.context().deps.addDependency(new Package({
			name:          'ggplot2',
			namespaceInfo: setCallable(FlowrNamespaceFile.from(new FlowrInlineTextFile('NAMESPACE', namespaceContent + '\nimport(random_placeholder)')).content().current, ggplot2Callable)
		}));
		analyzer.context().deps.addDependency(new Package({
			name:          'random_placeholder',
			namespaceInfo: setCallable(FlowrNamespaceFile.from(new FlowrInlineTextFile('NAMESPACE', 'export(test1)\nexport(test2)\nimport(ggplot2)\nimportFrom(random_placeholder3, a)')).content().current, randomPlaceholder1Callable)
		}));
		analyzer.context().deps.addDependency(new Package({
			name:          'random_placeholder2',
			namespaceInfo: setCallable(FlowrNamespaceFile.from(new FlowrInlineTextFile('NAMESPACE', 'export(test1)\nexport(test2)\nexport(test3)\nimport(random_placeholder)')).content().current, randomPlaceholder2Callable)
		}));
		analyzer.context().deps.addDependency(new Package({
			name:          'random_placeholder3',
			namespaceInfo: setCallable(FlowrNamespaceFile.from(new FlowrInlineTextFile('NAMESPACE', 'export(a)\nexport(b)\nimportFrom(random_placeholder2, test3)')).content().current, randomPlaceholder3Callable)
		}));
		analyzer.addRequest('library(ggplot2)\nggplot()');

		const df = await analyzer.dataflow();
		let env = REnvironment.findGlobal(df.environment.current).parent;
		const ggplotSymbols = ['+', 'ggplot', 'aes', 'geom_point', 'geom_line', 'theme_bw', 'coord_cartesian', 'ggsave', 'fortify', 'scale_type'];
		const rPSsymbols = ['test1', 'test2'];
		//namespace:ggplot2 -> imports:ggplot2 -> globalEnv -> ...
		//ggplot2 namespace
		expect(env.n === 'ggplot2' && env.t === EnvType.Namespace && compare(new Set(ggplotSymbols), new Set(env.memory.keys()))).toBeTruthy();
		//ggplot2 imports
		env = env.parent;
		const imported = createImportedFunctions([['random_placeholder', rPSsymbols], ['ggplot2', ggplotSymbols], ['random_placeholder3', ['a']]]);
		expect(env.n === 'ggplot2' && env.t === EnvType.Imports && compare(new Set(imported), new Set(env.memory.keys()))).toBeTruthy();
	});

	test('Linked library loads circular imports 2', async() => {
		const analyzer = await new FlowrAnalyzerBuilder()
			.setParser(ts)
			.build();
		analyzer.context().deps.addDependency(new Package({
			name:          'ggplot2',
			namespaceInfo: setCallable(FlowrNamespaceFile.from(new FlowrInlineTextFile('NAMESPACE', namespaceContent + '\nimport(random_placeholder)')).content().current, ggplot2Callable)
		}));
		analyzer.context().deps.addDependency(new Package({
			name:          'random_placeholder',
			namespaceInfo: setCallable(FlowrNamespaceFile.from(new FlowrInlineTextFile('NAMESPACE', 'export(test1)\nexport(test2)\nimport(ggplot2)\nimportFrom(random_placeholder3, a)')).content().current, randomPlaceholder1Callable)
		}));
		analyzer.context().deps.addDependency(new Package({
			name:          'random_placeholder2',
			namespaceInfo: setCallable(FlowrNamespaceFile.from(new FlowrInlineTextFile('NAMESPACE', 'export(test1)\nexport(test2)\nexport(test3)\nimport(random_placeholder)')).content().current, randomPlaceholder2Callable)
		}));
		analyzer.context().deps.addDependency(new Package({
			name:          'random_placeholder3',
			namespaceInfo: setCallable(FlowrNamespaceFile.from(new FlowrInlineTextFile('NAMESPACE', 'export(a)\nexport(b)\nimportFrom(random_placeholder2, test3)')).content().current, randomPlaceholder3Callable)
		}));
		analyzer.addRequest('library(ggplot2)\nlibrary(random_placeholder2)\nlibrary(random_placeholder3)\nggplot()');

		const df = await analyzer.dataflow();
		let env = REnvironment.findGlobal(df.environment.current).parent;
		const ggplotSymbols = ['+', 'ggplot', 'aes', 'geom_point', 'geom_line', 'theme_bw', 'coord_cartesian', 'ggsave', 'fortify', 'scale_type'];
		const rP1symbols = ['test1', 'test2'];
		const rP2Symbols = ['test1', 'test2', 'test3'];
		const rP3Symbols = ['a', 'b'];
		// random_placeholder3 namespace -> random_placeholder3 imports -> random_placeholder2 namespace -> random_placeholder2 imports -> ggplot2 namespace -> ggplot2 imports -> global environment
		const imp3 = createImportedFunctions([['random_placeholder2', ['test3']]]);
		const imp2 = createImportedFunctions([['random_placeholder3', ['a']], ['ggplot2', ggplotSymbols], ['random_placeholder', rP1symbols]]);
		const impggplot = createImportedFunctions([['random_placeholder', rP1symbols], ['ggplot2', ggplotSymbols], ['random_placeholder3', ['a']]]);
		expect(env.n === 'random_placeholder3' && env.t === EnvType.Namespace && compare(new Set(rP3Symbols), new Set(env.memory.keys()))).toBeTruthy();
		env = env.parent;
		expect(env.n === 'random_placeholder3' && env.t === EnvType.Imports && compare(new Set(imp3), new Set(env.memory.keys()))).toBeTruthy();
		env = env.parent;
		expect(env.n === 'random_placeholder2' && env.t === EnvType.Namespace && compare(new Set(rP2Symbols), new Set(env.memory.keys()))).toBeTruthy();
		env = env.parent;
		expect(env.n === 'random_placeholder2' && env.t === EnvType.Imports && compare(new Set(imp2), new Set(env.memory.keys()))).toBeTruthy();
		env = env.parent;
		expect(env.n === 'ggplot2' && env.t === EnvType.Namespace && compare(new Set(ggplotSymbols), new Set(env.memory.keys()))).toBeTruthy();
		env = env.parent;
		expect(env.n === 'ggplot2' && env.t === EnvType.Imports && compare(new Set(impggplot), new Set(env.memory.keys()))).toBeTruthy();
	});

	test('Linked library only partly imports another library (only importFrom)', async() => {
		const analyzer = await new FlowrAnalyzerBuilder()
			.setParser(ts)
			.build();
		analyzer.context().deps.addDependency(new Package({
			name:          'ggplot2',
			namespaceInfo: setCallable(FlowrNamespaceFile.from(new FlowrInlineTextFile('NAMESPACE', namespaceContent + '\nimportFrom(random_placeholder, test1)')).content().current, ggplot2Callable)
		}));
		analyzer.context().deps.addDependency(new Package({
			name:          'random_placeholder',
			namespaceInfo: setCallable(FlowrNamespaceFile.from(new FlowrInlineTextFile('NAMESPACE', 'export(test1)\nexport(test2)')).content().current, randomPlaceholder1Callable)
		}));
		analyzer.addRequest('library(ggplot2)\nggplot()');
		const df = await analyzer.dataflow();
		let env = REnvironment.findGlobal(df.environment.current).parent;
		const exportedSymbols = ['+', 'ggplot', 'aes', 'geom_point', 'geom_line', 'theme_bw', 'coord_cartesian', 'ggsave', 'fortify', 'scale_type'];
		//namespace:ggplot2 -> imports: ggplot2 -> globalEnv -> ...
		//ggplot namespace
		expect(env.n === 'ggplot2' && env.t === EnvType.Namespace && compare(new Set(exportedSymbols), new Set(env.memory.keys()))).toBeTruthy();
		//ggplot imports
		env = env.parent;
		const imported = [Package.funcIdentif('random_placeholder', 'test1')];
		expect(env.n === 'ggplot2' && env.t === EnvType.Imports && compare(new Set(imported), new Set(env.memory.keys()))).toBeTruthy();
	});

	test('Linked library imports another library', async() => {
		const analyzer = await new FlowrAnalyzerBuilder()
			.setParser(ts)
			.build();
		analyzer.context().deps.addDependency(new Package({
			name:          'ggplot2',
			namespaceInfo: setCallable(FlowrNamespaceFile.from(new FlowrInlineTextFile('NAMESPACE', namespaceContent + '\nimport(random_placeholder)')).content().current, ggplot2Callable)
		}));
		analyzer.context().deps.addDependency(new Package({
			name:          'random_placeholder',
			namespaceInfo: setCallable(FlowrNamespaceFile.from(new FlowrInlineTextFile('NAMESPACE', 'export(test1)\nexport(test2)')).content().current, randomPlaceholder1Callable)
		}));
		analyzer.addRequest('library(ggplot2)\nggplot()');
		const df = await analyzer.dataflow();
		let env = REnvironment.findGlobal(df.environment.current).parent;
		const exportedSymbols = ['+', 'ggplot', 'aes', 'geom_point', 'geom_line', 'theme_bw', 'coord_cartesian', 'ggsave', 'fortify', 'scale_type'];
		//namespace:ggplot -> imports:ggplot -> globalEnv
		//ggplot package
		expect(env.n === 'ggplot2' && env.t === EnvType.Namespace && compare(new Set(exportedSymbols), new Set(env.memory.keys()))).toBeTruthy();
		//ggplot imports
		env = env.parent;
		const imported = createImportedFunctions([['random_placeholder', ['test1', 'test2']]]);
		expect(env.n === 'ggplot2' && env.t === EnvType.Imports && compare(new Set(imported), new Set(env.memory.keys()))).toBeTruthy();
	});
}));

function createImportedFunctions(a: [string, string[]][]): string[]{
	let res: string[] = [];
	for(const [dependency, functions] of a){
		res = res.concat(functions.map(f => Package.funcIdentif(dependency, f)));
	}
	return res;
}

function compare<T>(s1: Set<T>, s2: Set<T>){
	return s1.difference(s2).size === 0 && s2.difference(s1).size === 0;
}