import { assert, test } from 'vitest';
import { createDataflowPipeline } from '../../../src/core/steps/pipeline/default-pipelines';
import { requestFromInput } from '../../../src/r-bridge/retriever';
import { cfgToMermaidUrl } from '../../../src/util/mermaid/cfg';
import type { KnownParser } from '../../../src/r-bridge/parser';
import type { NodeId } from '../../../src/r-bridge/lang-4.x/ast/model/processing/node-id';
import { normalizeIdToNumberIfPossible } from '../../../src/r-bridge/lang-4.x/ast/model/processing/node-id';
import { diffOfControlFlowGraphs } from '../../../src/control-flow/diff-cfg';
import type { GraphDifferenceReport } from '../../../src/util/diff-graph';
import type { ControlFlowInformation } from '../../../src/control-flow/control-flow-graph';
import { emptyControlFlowInformation } from '../../../src/control-flow/control-flow-graph';
import { extractCFG } from '../../../src/control-flow/extract-cfg';

function normAllIds(ids: readonly NodeId[]): NodeId[] {
	return ids.map(normalizeIdToNumberIfPossible);
}

export interface AssertCfgOptions {
	expectIsSubgraph: boolean
}

/**
 * Assert that the given code produces the expected CFG
 */
export function assertCfg(parser: KnownParser, code: string, partialExpected: Partial<ControlFlowInformation>, config?: Partial<AssertCfgOptions>) {
	// shallow copy is important to avoid killing the CFG :c
	const expected: ControlFlowInformation = { ...emptyControlFlowInformation(), ...partialExpected };
	return test(code, async()=> {
		const result = await createDataflowPipeline(parser, {
			request: requestFromInput(code)
		}).allRemainingSteps();
		const cfg = extractCFG(result.normalize, result.dataflow?.graph);

		let diff: GraphDifferenceReport | undefined;
		try {
			assert.deepStrictEqual(normAllIds(cfg.entryPoints), normAllIds(expected.entryPoints), 'entry points differ');
			assert.deepStrictEqual(normAllIds(cfg.exitPoints),  normAllIds(expected.exitPoints), 'exit points differ');
			assert.deepStrictEqual(normAllIds(cfg.breaks),      normAllIds(expected.breaks), 'breaks differ');
			assert.deepStrictEqual(normAllIds(cfg.nexts),       normAllIds(expected.nexts), 'nexts differ');
			assert.deepStrictEqual(normAllIds(cfg.returns),     normAllIds(expected.returns), 'returns differ');
			diff = diffOfControlFlowGraphs({ graph: expected.graph, name: 'expected' }, { graph: cfg.graph, name: 'got' }, {
				leftIsSubgraph: config?.expectIsSubgraph
			});
			assert.isTrue(diff.isEqual(), 'graphs differ:' + (diff?.comments() ?? []).join('\n'));
		} /* v8 ignore next 7 */ catch(e: unknown) {
			if(diff) {
				console.error(diff.comments());
			}
			console.error(`expected: ${cfgToMermaidUrl(expected, result.normalize)}`);
			console.error(`actual: ${cfgToMermaidUrl(cfg, result.normalize)}`);
			throw e;
		}
	});
}