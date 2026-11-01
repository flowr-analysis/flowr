import { describe, expect, test } from 'vitest';
import { withTreeSitter } from '../../../_helper/shell';
import { namespacePackage, ggplot2Package, addPackages } from '../../../_helper/sigdb';
import { FlowrAnalyzerBuilder } from '../../../../../src/project/flowr-analyzer-builder';
import { Package } from '../../../../../src/project/plugins/package-version-plugins/package';
import { EnvType, REnvironment } from '../../../../../src/dataflow/environments/environment';
import { VertexType } from '../../../../../src/dataflow/graph/vertex';
import { Dataflow } from '../../../../../src/dataflow/graph/df-helper';
import { Identifier } from '../../../../../src/dataflow/environments/identifier';

const randomPlaceholder1Callable = ['test1', 'test2'];
const randomPlaceholder2Callable = ['test1', 'test2', 'test3'];
const randomPlaceholder3Callable = ['a', 'b'];

describe('Linked library imports libraries', withTreeSitter(ts => {
	test('Linked library loads circular imports 1', async() => {
		const analyzer = await new FlowrAnalyzerBuilder()
			.setParser(ts)
			.build();
		addPackages(analyzer, ggplot2Package('\nimport(random_placeholder)'));
		addPackages(analyzer, namespacePackage('random_placeholder', 'export(test1)\nexport(test2)\nimport(ggplot2)\nimportFrom(random_placeholder3, a)', randomPlaceholder1Callable));
		addPackages(analyzer, namespacePackage('random_placeholder2', 'export(test1)\nexport(test2)\nexport(test3)\nimport(random_placeholder)', randomPlaceholder2Callable));
		addPackages(analyzer, namespacePackage('random_placeholder3', 'export(a)\nexport(b)\nimportFrom(random_placeholder2, test3)', randomPlaceholder3Callable));
		analyzer.addRequest('library(ggplot2)\nggplot()');

		const df = await analyzer.dataflow();
		let env = REnvironment.findGlobal(df.environment.current).parent;
		const ggplotSymbols = ['+', 'ggplot', 'aes', 'geom_point', 'geom_line', 'theme_bw', 'coord_cartesian', 'ggsave', 'fortify', 'scale_type'];
		const rPSsymbols = ['test1', 'test2'];
		//namespace:ggplot2 -> imports:ggplot2 -> globalEnv -> ...
		expect(env.n === 'ggplot2' && env.t === EnvType.Namespace && compare(new Set(ggplotSymbols), new Set(env.memory.keys()))).toBeTruthy();
		env = env.parent;
		const imported = createImportedFunctions([['random_placeholder', rPSsymbols], ['ggplot2', ggplotSymbols], ['random_placeholder3', ['a']]]);
		expect(env.n === 'ggplot2' && env.t === EnvType.Imports && compare(new Set(imported), new Set(env.memory.keys()))).toBeTruthy();
	});

	test('Linked library loads circular imports 2', async() => {
		const analyzer = await new FlowrAnalyzerBuilder()
			.setParser(ts)
			.build();
		addPackages(analyzer, ggplot2Package('\nimport(random_placeholder)'));
		addPackages(analyzer, namespacePackage('random_placeholder', 'export(test1)\nexport(test2)\nimport(ggplot2)\nimportFrom(random_placeholder3, a)', randomPlaceholder1Callable));
		addPackages(analyzer, namespacePackage('random_placeholder2', 'export(test1)\nexport(test2)\nexport(test3)\nimport(random_placeholder)', randomPlaceholder2Callable));
		addPackages(analyzer, namespacePackage('random_placeholder3', 'export(a)\nexport(b)\nimportFrom(random_placeholder2, test3)', randomPlaceholder3Callable));
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
		addPackages(analyzer, ggplot2Package('\nimportFrom(random_placeholder, test1)'));
		addPackages(analyzer, namespacePackage('random_placeholder', 'export(test1)\nexport(test2)', randomPlaceholder1Callable));
		analyzer.addRequest('library(ggplot2)\nggplot()');
		const df = await analyzer.dataflow();
		let env = REnvironment.findGlobal(df.environment.current).parent;
		const exportedSymbols = ['+', 'ggplot', 'aes', 'geom_point', 'geom_line', 'theme_bw', 'coord_cartesian', 'ggsave', 'fortify', 'scale_type'];
		//namespace:ggplot2 -> imports: ggplot2 -> globalEnv -> ...
		//ggplot namespace
		expect(env.n === 'ggplot2' && env.t === EnvType.Namespace && compare(new Set(exportedSymbols), new Set(env.memory.keys()))).toBeTruthy();
		//ggplot imports
		env = env.parent;
		const imported = [Package.functionIdentifier('random_placeholder', 'test1')];
		expect(env.n === 'ggplot2' && env.t === EnvType.Imports && compare(new Set(imported), new Set(env.memory.keys()))).toBeTruthy();
	});

	test('the analyzed package\'s own importFrom resolves a bare imported call to its source package', async() => {
		const analyzer = await new FlowrAnalyzerBuilder().setParser(ts).build();
		addPackages(analyzer, namespacePackage('current', 'importFrom(zoo, index)'));
		addPackages(analyzer, namespacePackage('zoo', 'export(index)', ['index']));
		analyzer.addRequest('index(x)');
		const df = await analyzer.dataflow();
		let resolved: string | undefined;
		for(const [id, vtx] of df.graph.verticesOfType(VertexType.FunctionCall)) {
			if(Identifier.getName(vtx.name) === 'index') {
				const qualified = Dataflow.qualify(id, df.graph, true);
				resolved = qualified === undefined ? undefined : Identifier.getNamespace(qualified);
			}
		}
		expect(resolved).toBe('zoo');
	});

	test('Linked library imports another library', async() => {
		const analyzer = await new FlowrAnalyzerBuilder()
			.setParser(ts)
			.build();
		addPackages(analyzer, ggplot2Package('\nimport(random_placeholder)'));
		addPackages(analyzer, namespacePackage('random_placeholder', 'export(test1)\nexport(test2)', randomPlaceholder1Callable));
		analyzer.addRequest('library(ggplot2)\nggplot()');
		const df = await analyzer.dataflow();
		let env = REnvironment.findGlobal(df.environment.current).parent;
		const exportedSymbols = ['+', 'ggplot', 'aes', 'geom_point', 'geom_line', 'theme_bw', 'coord_cartesian', 'ggsave', 'fortify', 'scale_type'];
		//namespace:ggplot -> imports:ggplot -> globalEnv
		expect(env.n === 'ggplot2' && env.t === EnvType.Namespace && compare(new Set(exportedSymbols), new Set(env.memory.keys()))).toBeTruthy();
		env = env.parent;
		const imported = createImportedFunctions([['random_placeholder', ['test1', 'test2']]]);
		expect(env.n === 'ggplot2' && env.t === EnvType.Imports && compare(new Set(imported), new Set(env.memory.keys()))).toBeTruthy();
	});
}));

function createImportedFunctions(a: [string, string[]][]): string[] {
	let res: string[] = [];
	for(const [dependency, functions] of a) {
		res = res.concat(functions.map(f => Package.functionIdentifier(dependency, f)));
	}
	return res;
}

function compare<T>(s1: Set<T>, s2: Set<T>) {
	return s1.difference(s2).size === 0 && s2.difference(s1).size === 0;
}