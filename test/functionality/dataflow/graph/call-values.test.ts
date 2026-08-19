import { describe, assert, test, beforeAll } from 'vitest';
import { FlowrAnalyzerBuilder } from '../../../../src/project/flowr-analyzer-builder';
import { TreeSitterExecutor } from '../../../../src/r-bridge/lang-4.x/tree-sitter/tree-sitter-executor';
import { Dataflow } from '../../../../src/dataflow/graph/df-helper';
import { VertexType } from '../../../../src/dataflow/graph/vertex';
import type { NodeId } from '../../../../src/r-bridge/lang-4.x/ast/model/processing/node-id';
import type { DataflowGraph } from '../../../../src/dataflow/graph/graph';

/** every call of `code`, grouped by the called name, answered with `ask` */
async function callsBy(code: string, ask: (id: NodeId, graph: DataflowGraph) => boolean): Promise<Record<string, boolean[]>> {
	const analyzer = await new FlowrAnalyzerBuilder().setParser(new TreeSitterExecutor()).build();
	analyzer.addRequest(code);
	const graph = (await analyzer.dataflow()).graph;
	const out: Record<string, boolean[]> = {};
	for(const [id, vertex] of graph.verticesOfType(VertexType.FunctionCall)) {
		(out[String(vertex.name)] ??= []).push(ask(id, graph));
	}
	return out;
}

describe('What a call does with, and gets as, values', () => {
	beforeAll(async() => {
		await TreeSitterExecutor.initTreeSitter();
	});

	// a bare call reports its result by auto-printing, an assigned one does not
	test('valueIsUsed separates an auto-printed result from a consumed one', async() => {
		const res = await callsBy('m <- 1\nanova(m)\nx <- summary(m)\nprint(quantile(m))\n',
			(id, graph) => Dataflow.valueIsUsed(id, graph));
		assert.deepStrictEqual(res['anova'], [false], 'a bare call auto-prints, nothing consumes it');
		assert.deepStrictEqual(res['summary'], [true], 'the assignment consumes it');
		assert.deepStrictEqual(res['quantile'], [true], 'being an argument consumes it');
		assert.deepStrictEqual(res['print'], [false], 'the print itself is not consumed');
	});

	/*
	 * The calls sharing a graphics device are chained with plain `Reads` edges, which say the side effect is
	 * ordered, not that anyone took the value: none of these is consumed.
	 */
	test('the side-effect chain of a device does not count as consuming', async() => {
		const res = await callsBy('m <- 1\npdf("a.pdf")\nplot(m)\nlines(m)\ndev.off()\n',
			(id, graph) => Dataflow.valueIsUsed(id, graph));
		assert.deepStrictEqual(res['pdf'], [false]);
		assert.deepStrictEqual(res['plot'], [false]);
		assert.deepStrictEqual(res['lines'], [false]);
		assert.deepStrictEqual(res['dev.off'], [false]);
	});

	// `cat("starting\n")` is a log line, `cat("n =", length(m))` is a finding
	test('hasComputedArguments separates a literal from something the program worked out', async() => {
		const res = await callsBy('m <- 1\ncat("starting\\n")\ncat("n =", m)\ncat("n =", length(m))\ncat("a", "b")\n',
			(id, graph) => Dataflow.hasComputedArguments(id, graph));
		assert.deepStrictEqual(res['cat'], [false, true, true, false],
			'only the calls reading a definition or a call carry a computed value');
	});
});
