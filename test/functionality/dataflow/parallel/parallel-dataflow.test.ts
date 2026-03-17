import { assert, describe, test } from 'vitest';
import { FlowrAnalyzerBuilder } from '../../../../src/project/flowr-analyzer-builder';
import { diffOfDataflowGraphs } from '../../../../src/dataflow/graph/diff-dataflow-graph';
import type { AnalyzerSetupCluster, AnalyzerSetupFunction } from './analyzer-test-data';
import { complexDataflowTests, ComplexVariableChains, simpleDataflowTests, sourceBasedDataflowTests } from './analyzer-test-data';

async function checkGraphEquality(testCaseName: string, func: AnalyzerSetupFunction) {
	console.log(`\n► Running test case: ${testCaseName}`);

	const parallelAnalyzer = func(await new FlowrAnalyzerBuilder()
		.enableFileParallelization().build()
	);
	const analyzer = func(await new FlowrAnalyzerBuilder().build());

	const df = await parallelAnalyzer.dataflow();
	const syncDf = await analyzer.dataflow();

	// close analyzers
	await parallelAnalyzer.close(true);
	await analyzer.close(true);

	const graphdiff = diffOfDataflowGraphs(
		{ name: 'Parallel graph', graph: df.graph }, { name: 'Sync graph', graph: syncDf.graph }
	);

	console.log(graphdiff.comments());
	console.log(graphdiff.problematic());
	console.log('Sequential Graph: ', syncDf.graph);
	console.log('Parallel Graph: ', df.graph);
	assert.isTrue(graphdiff.isEqual(), `Dataflow graphs should be equal for testCase ${testCaseName}`);
}

function registerClusterTests(clusterName: string, testCluster: AnalyzerSetupCluster) {
	for(const testCase of testCluster) {
		test(`${clusterName} :: ${testCase.name}`, async() => {
			await checkGraphEquality(testCase.name, testCase.setup);
		});
	}
}

describe.sequential('Parallel Dataflow test', () => {

	test('ComplexVariableChains', async() => {
		await checkGraphEquality('LoopsWithCrossFile', ComplexVariableChains);
	});

	registerClusterTests('Simple File Analysis', simpleDataflowTests);
	registerClusterTests('Complex File Analysis', complexDataflowTests);
	registerClusterTests('Source Based File Analysis', sourceBasedDataflowTests);

});