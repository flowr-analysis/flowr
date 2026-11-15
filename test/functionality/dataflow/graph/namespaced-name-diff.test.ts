import { assert, describe, test } from 'vitest';
import { withTreeSitter } from '../../_helper/shell';
import { DataflowGraph, type DataflowGraphJson } from '../../../../src/dataflow/graph/graph';
import { Dataflow } from '../../../../src/dataflow/graph/df-helper';
import { diffIdentifierReferences } from '../../../../src/dataflow/environments/diff';
import { initDiffContext } from '../../../../src/util/diff-graph';
import { Identifier, ReferenceType } from '../../../../src/dataflow/environments/identifier';
import { analyze } from '../../_helper/analyzer';

describe('Diffing graphs', withTreeSitter(ts => {
	test('equal namespaced names do not differ', async() => {
		const analyzer = await analyze(ts, 'utils::read.csv("x")');
		const { graph } = await analyzer.dataflow();
		const again = DataflowGraph.fromJson(JSON.parse(JSON.stringify(graph.toJSON())) as DataflowGraphJson);
		assert.isTrue(Dataflow.diffGraphs({ name: 'left', graph }, { name: 'right', graph: again }).isEqual());
	});
	test('equal namespaced references in separate tuples do not differ', () => {
		const ref = () => ({ nodeId: 1, name: Identifier.make('is.numeric', 'base'), type: ReferenceType.Function, cds: undefined });
		const ctx = initDiffContext({ name: 'left', graph: undefined }, { name: 'right', graph: undefined });
		diffIdentifierReferences(ref(), ref(), ctx);
		assert.isTrue(ctx.report.isEqual(), ctx.report.comments()?.join('\n'));
	});
}));
