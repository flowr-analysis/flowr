import { assert, describe, test } from 'vitest';
import { FlowrAnalyzerBuilder } from '../../../../src/project/flowr-analyzer-builder';
import { diffOfDataflowGraphs } from '../../../../src/dataflow/graph/diff-dataflow-graph';
import { graphToMermaidUrl } from '../../../../src/util/mermaid/dfg';
import { advancedSideEffectTests, builtinRedefinitionDataflowTests, closureAndSideEffectTests, complexDataflowTests, redefinitionAndClosureInteractionTests, simpleDataflowTests, sourceBasedDataflowTests, type NamedTestCase, type TestSuite } from './test-data/test-suites';
import { someTest } from './test-data/standard-cases';


async function checkGraphEquality(testCase: NamedTestCase) {
	console.log(`\n► Running test case: ${testCase.name}`);

	const parallelAnalyzer = testCase.setup(await new FlowrAnalyzerBuilder()
		.enableFileParallelization().build()
	);
	const analyzer = testCase.setup(await new FlowrAnalyzerBuilder().build());

	try {
		const df = await parallelAnalyzer.dataflow();
		const syncDf = await analyzer.dataflow();

		const graphdiff = diffOfDataflowGraphs(
			{ name: 'Parallel graph', graph: df.graph }, { name: 'Sync graph', graph: syncDf.graph }
		);

		console.log(graphdiff.comments());
		console.log(graphdiff.problematic());

		console.log('sequential graph: ', graphToMermaidUrl(syncDf.graph, false));
		console.log('parallel graph: ', graphToMermaidUrl(df.graph, false));
		assert.isTrue(graphdiff.isEqual(), `Dataflow graphs should be equal for testCase ${testCase.name}`);

		// Check re-analysis trigger state if expectReanalysisTrigger is defined
		if(testCase.expectReanalysisTriggered !== undefined) {
			console.log(`Checking re-analysis trigger state for test case ${testCase.name}...`);
			console.log('reanalysisTriggered:', df.reanalysisTriggered);
			console.log('reanalysisIteration:', df.reanalysisIteration);
			console.log('reanalysisFileIndex:', df.reanalysisFileIndex);
			assert.strictEqual(
				df.reanalysisTriggered,
				testCase.expectReanalysisTriggered,
				`Re-analysis trigger mismatch for test case ${testCase.name}: expected ${testCase.expectReanalysisTriggered}, got ${df.reanalysisTriggered}`
			);

			// Check expected trigger file index if defined
			if(testCase.expectReanalysisTriggered && testCase.expectedTriggerFileIndex !== undefined) {
				assert.strictEqual(
					df.reanalysisFileIndex,
					testCase.expectedTriggerFileIndex,
					`Trigger file index mismatch for test case ${testCase.name}: expected ${testCase.expectedTriggerFileIndex}, got ${df.reanalysisFileIndex}`
				);
			}
		}
	} finally {
		await parallelAnalyzer.close(true);
		await analyzer.close(true);
	}
}

function registerClusterTests(testCluster: TestSuite) {
	for(const testCase of testCluster) {
		test(`${testCase.name}`, async() => {
			await checkGraphEquality(testCase);
		});
	}
}

describe.sequential('Parallel Dataflow test', () => {

	test('someTest', async() => {
		await checkGraphEquality({ name: 'someTest', setup: someTest });
	});

	describe('Simple File Analysis', () => {
		registerClusterTests(simpleDataflowTests);
	});

	describe('Complex File Analysis', () => {
		registerClusterTests(complexDataflowTests);
	});

	describe('Source Based File Analysis', () => {
		registerClusterTests(sourceBasedDataflowTests);
	});

	describe('Builtin Redefinition Re-analysis', () => {
		registerClusterTests(builtinRedefinitionDataflowTests);
	});

	describe('Closure and Side-Effect Re-analysis', () => {
		registerClusterTests(closureAndSideEffectTests);
	});

	describe('Closure and Side-Effect Re-analysis', () => {
		registerClusterTests(redefinitionAndClosureInteractionTests);
	});

	describe('Closure and Side-Effect Re-analysis', () => {
		registerClusterTests(advancedSideEffectTests);
	});

});