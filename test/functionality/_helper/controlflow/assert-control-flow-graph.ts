import { assert, test } from 'vitest';
import { createDataflowPipeline } from '../../../../src/core/steps/pipeline/default-pipelines';
import { requestFromInput } from '../../../../src/r-bridge/retriever';
import { cfgToMermaidUrl } from '../../../../src/util/mermaid/cfg';
import type { KnownParser } from '../../../../src/r-bridge/parser';
import type { NodeId } from '../../../../src/r-bridge/lang-4.x/ast/model/processing/node-id';
import { normalizeIdToNumberIfPossible } from '../../../../src/r-bridge/lang-4.x/ast/model/processing/node-id';
import { diffOfControlFlowGraphs } from '../../../../src/control-flow/diff-cfg';
import type { GraphDifferenceReport } from '../../../../src/util/diff-graph';
import type { ControlFlowInformation } from '../../../../src/control-flow/control-flow-graph';
import { emptyControlFlowInformation } from '../../../../src/control-flow/control-flow-graph';
import { extractCfg } from '../../../../src/control-flow/extract-cfg';
import type { CfgProperty } from '../../../../src/control-flow/cfg-properties';
import { assertCfgSatisfiesProperties } from '../../../../src/control-flow/cfg-properties';
import { cloneConfig, defaultConfigOptions } from '../../../../src/config';
import type { CfgSimplificationPassName } from '../../../../src/control-flow/cfg-simplification';
import { simplifyControlFlowInformation } from '../../../../src/control-flow/cfg-simplification';
import type { DataflowInformation } from '../../../../src/dataflow/info';
import type { NormalizedAst } from '../../../../src/r-bridge/lang-4.x/ast/model/processing/decorate';

function normAllIds(ids: readonly NodeId[]): NodeId[] {
	return ids.map(normalizeIdToNumberIfPossible);
}

export interface AssertCfgOptions {
	expectIsSubgraph:      boolean
	withBasicBlocks:       boolean
	excludeProperties?:    readonly CfgProperty[]
	simplificationPasses?: readonly CfgSimplificationPassName[]
	additionalAsserts?:    (cfg: ControlFlowInformation, ast: NormalizedAst, dfg: DataflowInformation) => void
}

/**
 * Assert that the given code produces the expected CFG
 */
export function assertCfg(parser: KnownParser, code: string, partialExpected: Partial<ControlFlowInformation>, options?: Partial<AssertCfgOptions>) {
	// shallow copy is important to avoid killing the CFG :c
	const expected: ControlFlowInformation = { ...emptyControlFlowInformation(), ...partialExpected };
	return test(code, async()=> {
		const config = cloneConfig(defaultConfigOptions);
		const result = await createDataflowPipeline(parser, {
			request: requestFromInput(code)
		}, config).allRemainingSteps();
		let cfg = extractCfg(result.normalize, config, result.dataflow?.graph);

		if(options?.withBasicBlocks) {
			cfg = simplifyControlFlowInformation(cfg, { ast: result.normalize, dfg: result.dataflow.graph, config }, ['to-basic-blocks', 'remove-dead-code', ...options.simplificationPasses ?? []]);
		} else if(options?.simplificationPasses) {
			cfg = simplifyControlFlowInformation(cfg, { ast: result.normalize, dfg: result.dataflow.graph, config }, options.simplificationPasses);
		}

		let diff: GraphDifferenceReport | undefined;
		try {
			if(!options?.expectIsSubgraph) {
				assert.deepStrictEqual(normAllIds(cfg.entryPoints), normAllIds(expected.entryPoints), 'entry points differ');
				assert.deepStrictEqual(normAllIds(cfg.exitPoints), normAllIds(expected.exitPoints), 'exit points differ');
				assert.deepStrictEqual(normAllIds(cfg.breaks), normAllIds(expected.breaks), 'breaks differ');
				assert.deepStrictEqual(normAllIds(cfg.nexts), normAllIds(expected.nexts), 'nexts differ');
				assert.deepStrictEqual(normAllIds(cfg.returns), normAllIds(expected.returns), 'returns differ');
			}
			const check = assertCfgSatisfiesProperties(cfg, options?.excludeProperties);
			assert.isTrue(check, 'cfg fails properties: ' + check + ' is not satisfied');
			diff = diffOfControlFlowGraphs({ graph: expected.graph, name: 'expected' }, { graph: cfg.graph, name: 'got' }, {
				leftIsSubgraph: options?.expectIsSubgraph
			});
			assert.isTrue(diff.isEqual(), 'graphs differ:' + (diff?.comments() ?? []).join('\n'));
			if(options?.additionalAsserts) {
				options.additionalAsserts(cfg, result.normalize, result.dataflow);
			}
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
