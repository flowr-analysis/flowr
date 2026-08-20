import { assert, describe, test } from 'vitest';
import { withTreeSitter } from '../_helper/shell';
import { createDataflowPipeline } from '../../../src/core/steps/pipeline/default-pipelines';
import { contextFromInput } from '../../../src/project/context/flowr-analyzer-context';
import { CfgEdge, CfgVertex, ControlFlowGraph, extractCfg } from '../../../src/control-flow/control-flow-graph';
import { visitCfgInOrder } from '../../../src/control-flow/simple-visitor';
import { FlowrConfig } from '../../../src/config';
import { jsonReplacer } from '../../../src/util/json';
import type { DataflowInformation } from '../../../src/dataflow/info';
import type { KnownParser } from '../../../src/r-bridge/parser';
import type { NodeId } from '../../../src/r-bridge/lang-4.x/ast/model/processing/node-id';

const programs = [
	'x <- 1\nprint(x)',
	'if(u) 1 else 2\nafter',
	'for(i in 1:3) { if(i > 2) break\nprint(i) }',
	'f <- function(a, b = 2) { a + b }\nf(1)',
	'y <- switch(k, a = 1, b = 2, 3)',
	'while(u) { next }\nafter'
];

async function analyze(parser: KnownParser, code: string): Promise<DataflowInformation> {
	const context = contextFromInput(code, FlowrConfig.default());
	return (await createDataflowPipeline(parser, { context }).allRemainingSteps()).dataflow;
}

describe.sequential('Control Flow Graph', withTreeSitter(parser => {
	describe('reads the same before and after it is projected', () => {
		test.each(programs)('%s', async code => {
			const dataflow = await analyze(parser, code);
			const view = extractCfg(dataflow).graph;
			const copy = extractCfg(dataflow).graph;
			/* asking for everything at once is what turns a view into a graph of its own */
			copy.vertices(true);

			assert.deepStrictEqual([...view.rootIds()].sort(), [...copy.rootIds()].sort(), 'root ids differ');
			assert.deepStrictEqual([...view.vertices(true).keys()].sort(), [...copy.vertices(true).keys()].sort(), 'vertices differ');

			for(const [id] of copy.vertices(true)) {
				assert.isTrue(view.hasVertex(id), `${id} is missing from the view`);
				assert.deepStrictEqual(view.getVertex(id), copy.getVertex(id), `vertex ${id} differs`);
				assert.deepStrictEqual([...view.successors(id)].sort(), [...copy.successors(id)].sort(), `successors of ${id} differ`);
				assert.deepStrictEqual([...view.predecessors(id)].sort(), [...copy.predecessors(id)].sort(), `predecessors of ${id} differ`);
				assert.deepStrictEqual(view.childrenOf(id), copy.childrenOf(id), `children of ${id} differ`);
				assert.deepStrictEqual(view.outgoingEdges(id), copy.outgoingEdges(id), `outgoing edges of ${id} differ`);
				assert.deepStrictEqual(view.ingoingEdges(id), copy.ingoingEdges(id), `ingoing edges of ${id} differ`);
			}
			assert.equal(JSON.stringify(view, jsonReplacer), JSON.stringify(copy, jsonReplacer), 'serializing differs');
		});
	});

	describe('names where a construct starts and ends', () => {
		test('an if starts at its condition and ends on itself', async() => {
			const dataflow = await analyze(parser, 'if(u) 1 else 2');
			const cfg = extractCfg(dataflow);
			const graph = cfg.graph;
			const [ifId] = [...graph.vertices(true).keys()].filter(id => dataflow.graph.idMap?.get(id)?.lexeme?.startsWith('if'));

			assert.equal(graph.exitOf(ifId), ifId, 'a construct is over on its own vertex');
			assert.equal(dataflow.graph.idMap?.get(graph.entryOf(ifId) as never)?.lexeme, 'u', 'an if starts at its condition');
			const branches = [...graph.successors(graph.entryOf(ifId) as never)];
			assert.lengthOf(branches, 2, 'the condition leads to one branch or the other');
			for(const branch of branches) {
				assert.include([...graph.successors(branch)], ifId, 'every branch joins on the if');
			}
		});

		test('a condition names the construct it decides', async() => {
			const dataflow = await analyze(parser, 'if(u) 3 else 2\nwhile(v) b');
			const cfg = extractCfg(dataflow);
			const graph = cfg.graph;
			const lexemeOf = (id: NodeId) => dataflow.graph.idMap?.get(id)?.lexeme;
			const idOf = (lexeme: string) => [...graph.vertices(true).keys()].find(id => lexemeOf(id) === lexeme) as NodeId;

			assert.deepStrictEqual(graph.decides(idOf('u')).map(lexemeOf), ['if'], 'standing on the condition names the if');
			assert.deepStrictEqual(graph.decides(idOf('v')).map(lexemeOf), ['while'], 'and the loop it belongs to');
			assert.isEmpty(graph.decides(idOf('3')), 'a branch decides nothing');
			assert.equal(lexemeOf(graph.entryOf(idOf('if')) as NodeId), 'u', 'and the way back lands on the condition again');
		});

		test('an expression ends on its operator', async() => {
			const dataflow = await analyze(parser, '2 * 3');
			const graph = extractCfg(dataflow).graph;
			const [mulId] = [...graph.vertices(true).keys()].filter(id => dataflow.graph.idMap?.get(id)?.lexeme === '*');

			assert.equal(graph.exitOf(mulId), mulId);
			assert.equal(dataflow.graph.idMap?.get(graph.entryOf(mulId) as never)?.lexeme, '2', 'it starts at the left operand');
		});
	});

	test('a graph of its own still works without a dataflow graph behind it', () => {
		const graph = new ControlFlowGraph()
			.addVertex(CfgVertex.makeExpression(0))
			.addVertex(CfgVertex.makeStatement(1))
			.addEdge(0, 1, CfgEdge.makeFd());

		assert.deepStrictEqual([...graph.successors(0)], [1], 'an edge points the way execution goes');
		assert.deepStrictEqual([...graph.predecessors(1)], [0]);
		assert.deepStrictEqual([...visitCfgInOrder(graph, [0], () => {})], [0, 1], 'visiting follows that direction');
	});
}));
