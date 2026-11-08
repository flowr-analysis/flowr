import { assert, describe, test } from 'vitest';
import { withTreeSitter } from '../../_helper/shell';
import { FlowrAnalyzerBuilder } from '../../../../src/project/flowr-analyzer-builder';
import { requestFromInput } from '../../../../src/r-bridge/retriever';
import { DataflowGraph, type DataflowGraphJson } from '../../../../src/dataflow/graph/graph';
import { Dataflow } from '../../../../src/dataflow/graph/df-helper';

describe('Diffing graphs', withTreeSitter(ts => {
	test('equal namespaced names do not differ', async() => {
		const analyzer = await new FlowrAnalyzerBuilder().setParser(ts).build();
		analyzer.addRequest(requestFromInput('utils::read.csv("x")'));
		const { graph } = await analyzer.dataflow();
		const again = DataflowGraph.fromJson(JSON.parse(JSON.stringify(graph.toJSON())) as DataflowGraphJson);
		assert.isTrue(Dataflow.diffGraphs({ name: 'left', graph }, { name: 'right', graph: again }).isEqual());
	});
}));
