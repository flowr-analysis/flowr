import { assert, describe, test } from 'vitest';
import { withTreeSitter } from '../../_helper/shell';
import { FlowrAnalyzerBuilder } from '../../../../src/project/flowr-analyzer-builder';
import { requestFromInput } from '../../../../src/r-bridge/retriever';
import { VertexType } from '../../../../src/dataflow/graph/vertex';

function getProgramWithInnerBody(body: string): string {
	return `
outer <- function(x) {
  inner <- function(y) {
    ${body}
  }
  inner(x)
}

outer(1)
`;
}

describe('function size timing', withTreeSitter(ts => {
	async function getOuterAndInnerFunctionSizes(code: string): Promise<{ outer: number; inner: number }> {
		const analyzer = new FlowrAnalyzerBuilder()
			.setParser(ts)
			.amendConfig(cfg => {
				cfg.optimizations.deferredFunctionEvaluation.enabled = false;
			})
			.buildSync();

		try {
			analyzer.addRequest(requestFromInput(code));
			const graph = (await analyzer.dataflow()).graph;
			const functionIds = graph.vertexIdsOfType(VertexType.FunctionDefinition);
			assert.isAtLeast(functionIds.length, 2, 'expected at least outer and inner function definitions');

			const functionIdSet = new Set(functionIds);
			let outerId: typeof functionIds[number] | undefined;

			for(const id of functionIds) {
				const vertex = graph.getVertex(id);
				if(vertex?.tag !== VertexType.FunctionDefinition) {
					continue;
				}
				const containsNestedFunction = [...vertex.subflow.graph].some(subId => subId !== id && functionIdSet.has(subId));
				if(containsNestedFunction) {
					outerId = id;
					break;
				}
			}

			assert.isDefined(outerId, 'failed to identify outer function definition');
			const outerVertex = graph.getVertex(outerId);
			assert.isDefined(outerVertex);
			assert.strictEqual(outerVertex.tag, VertexType.FunctionDefinition);
			if(outerVertex.tag !== VertexType.FunctionDefinition) {
				throw new Error('unexpected vertex type');
			}

			const innerId = [...outerVertex.subflow.graph].find(id => id !== outerId && functionIdSet.has(id));
			assert.isDefined(innerId, 'failed to identify inner function definition');

			const outerTiming = graph._timings[String(outerId)];
			const innerTiming = graph._timings[String(innerId)];
			assert.isDefined(outerTiming, 'missing timing for outer function');
			assert.isDefined(innerTiming, 'missing timing for inner function');

			return {
				outer: outerTiming.functionSizeAstNodes,
				inner: innerTiming.functionSizeAstNodes,
			};
		} finally {
			await analyzer.close(true);
		}
	}

	test('nested function body changes do not affect outer function size', async() => {
		const small = await getOuterAndInnerFunctionSizes(getProgramWithInnerBody('y + 1'));
		const large = await getOuterAndInnerFunctionSizes(getProgramWithInnerBody('y + 1 + 2 + 3 + 4 + 5 + 6 + 7 + 8 + 9'));

		assert.strictEqual(
			small.outer,
			large.outer,
			'outer function size should not include nested function body nodes'
		);
		assert.isAbove(
			large.inner,
			small.inner,
			'inner function size should increase when its body becomes larger'
		);
	});
}));
