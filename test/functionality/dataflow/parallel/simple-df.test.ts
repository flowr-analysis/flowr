import { assert, describe, test } from 'vitest';
import type { FlowrAnalyzer } from '../../../../src/project/flowr-analyzer';
import { FlowrAnalyzerBuilder } from '../../../../src/project/flowr-analyzer-builder';
import { diffOfDataflowGraphs } from '../../../../src/dataflow/graph/diff-dataflow-graph';
import { DataflowGraph } from '../../../../src/dataflow/graph/graph';
import { diffEnvironments, fromSerializedREnvironmentInformation, toSerializedREnvironmentInformation } from '../../../../src/dataflow/environments/environment';

type AnalyzerSetupFunction = (analyzer: FlowrAnalyzer) => FlowrAnalyzer;


async function checkGraphEquality(func: AnalyzerSetupFunction){
	const parallelAnalyzer = func(await new FlowrAnalyzerBuilder()
		.setFeature('paralleliseFiles').build()
	);
	const analyzer = func(await new FlowrAnalyzerBuilder().build());

	const df = await parallelAnalyzer.dataflow();
	const syncDf = await analyzer.dataflow();

	assert.isTrue(diffOfDataflowGraphs(
		{ name: 'Parallel graph', graph: df.graph }, { name: 'Sync graph', graph: syncDf.graph }
	).isEqual(), 'Dataflow graphs should be equal');
}

const SingleFile: AnalyzerSetupFunction = (analyzer) => {
	analyzer.addRequest({ request: 'text', content: 'x <- 3' });
	return analyzer;
};

const MultiFile: AnalyzerSetupFunction = (analyzer) => {
	analyzer.addRequest({ request: 'text', content: 'x <- 3' });
	analyzer.addRequest({ request: 'text', content: 'y <- 2\n print(y)' });
	return analyzer;
};

describe.sequential('Simple Parallel Dataflow test', () => {

	test('Single File Analysis', () => {
		void checkGraphEquality( SingleFile );
	});

	test('Multi File Analysis', () => {
		void checkGraphEquality( MultiFile );
	});

});

describe('Serialization tests', () => {
	test('DataflowGraph Serilization', async() => {
		const analyzer = await new FlowrAnalyzerBuilder().build();
		analyzer.addRequest({ request: 'text', content: 'x <- 1 \n y <- x + 2 \n print(y)' });

		const df = await analyzer.dataflow();

		// parse and reparse
		const byteData = df.graph.toSerializable();
		const parsedGraph = DataflowGraph.fromSerializable(byteData);

		assert.isTrue(diffOfDataflowGraphs(
			{ name: 'Normal graph', graph: df.graph }, { name: 'Reparsed graph', graph: parsedGraph }
		).isEqual(), 'Dataflow graphs should be equal after parsing');
	});

	test('DataflowInformation Serilization', async() => {
		const analyzer = await new FlowrAnalyzerBuilder().build();
		analyzer.addRequest({ request: 'text', content: 'x <- 1 \n y <- x + 2 \n print(y)' });

		const df = await analyzer.dataflow();

		// parse and reparse
		const byteData = toSerializedREnvironmentInformation(df.environment);
		const parsedEnv = fromSerializedREnvironmentInformation(byteData, analyzer.context());
		const diff = diffEnvironments(df.environment.current, parsedEnv.current);

		assert.isTrue(diff.isEqual);
		if(!diff.isEqual){
			console.warn(diff.issues);
		}
	});
});