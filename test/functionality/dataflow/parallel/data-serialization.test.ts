import { assert, describe, test } from "vitest";
import { toSerializedREnvironmentInformation, fromSerializedREnvironmentInformation, diffEnvironments } from "../../../../src/dataflow/environments/environment";
import { diffOfDataflowGraphs } from "../../../../src/dataflow/graph/diff-dataflow-graph";
import { DataflowGraph } from "../../../../src/dataflow/graph/graph";
import { FlowrAnalyzerBuilder } from "../../../../src/project/flowr-analyzer-builder";
import { BuiltInMemory } from "../../../../src/dataflow/environments/built-in";

describe('Serialization tests', () => {
    test('DataflowGraph Serilization', async () => {
        const analyzer = await new FlowrAnalyzerBuilder().build();
        analyzer.addRequest({ request: 'text', content: 'x <- 1 \n y <- x + 2 \n print(y)' });

        const df = await analyzer.dataflow();
        await analyzer.close();

        // parse and reparse
        const byteData = df.graph.toSerializable();
        const parsedGraph = DataflowGraph.fromSerializable(byteData);

        assert.isTrue(diffOfDataflowGraphs(
            { name: 'Normal graph', graph: df.graph }, { name: 'Reparsed graph', graph: parsedGraph }
        ).isEqual(), 'Dataflow graphs should be equal after parsing');
    });

    test('Environment Serilization', async () => {
        const analyzer = await new FlowrAnalyzerBuilder().build();
        analyzer.addRequest({ request: 'text', content: 'x <- 1 \n y <- x + 2 \n print(y)' });

        const df = await analyzer.dataflow();
        await analyzer.close();

        // parse and reparse
        const byteData = toSerializedREnvironmentInformation(df.environment);
        const parsedEnv = fromSerializedREnvironmentInformation(byteData, analyzer.context());
        const diff = diffEnvironments(df.environment.current, parsedEnv.current);

        assert.isTrue(diff.isEqual);
        if (!diff.isEqual) {
            console.warn(diff.issues);
        }
    });
});