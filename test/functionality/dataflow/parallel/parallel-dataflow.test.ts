import { assert, describe, test } from 'vitest';
import type { FlowrAnalyzer } from '../../../../src/project/flowr-analyzer';
import { FlowrAnalyzerBuilder } from '../../../../src/project/flowr-analyzer-builder';
import { diffOfDataflowGraphs } from '../../../../src/dataflow/graph/diff-dataflow-graph';
import { DataflowGraph } from '../../../../src/dataflow/graph/graph';
import { diffEnvironments, fromSerializedREnvironmentInformation, toSerializedREnvironmentInformation } from '../../../../src/dataflow/environments/environment';
import { AnalyzerSetupCluster, AnalyzerSetupFunction, complexDataflowTests, MultiDef, MultiFile, simpleDataflowTests, SingleFile, sourceBasedDataflowTests } from './analyzer-test-data';

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
    assert.isTrue(graphdiff.isEqual(), `Dataflow graphs should be equal for testCase ${testCaseName}`);
}

async function checkGraphEqualityForCluster(clusterName: string, testCluster: AnalyzerSetupCluster) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Testing Cluster: ${clusterName} (${testCluster.length} test cases)`);
    console.log(`${'='.repeat(60)}`);
    
    for (const testCase of testCluster) {
        await checkGraphEquality(testCase.name, testCase.setup);
    }
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`✓ All ${testCluster.length} test cases in "${clusterName}" completed`);
    console.log(`${'='.repeat(60)}\n`);
}

describe.sequential('Parallel Dataflow test', () => {

    test('Simple File Analysis', async () => {
        await checkGraphEqualityForCluster('Simple File Analysis', simpleDataflowTests);
    });

    test('Complex File Analysis', async () => {
        await checkGraphEqualityForCluster('Complex File Analysis', complexDataflowTests);
    });

    test('Source Based File Analysis', async () => {
        await checkGraphEqualityForCluster('Source Based File Analysis', sourceBasedDataflowTests);
    });

});