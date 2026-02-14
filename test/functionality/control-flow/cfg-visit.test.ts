import { assert, describe, it } from 'vitest';
import { type BasicCfgGuidedVisitorConfiguration, BasicCfgGuidedVisitor } from '../../../src/control-flow/basic-cfg-guided-visitor';
import type { NodeId } from '../../../src/r-bridge/lang-4.x/ast/model/processing/node-id';
import { createDataflowPipeline } from '../../../src/core/steps/pipeline/default-pipelines';
import { extractCfg } from '../../../src/control-flow/extract-cfg';
import { withTreeSitter } from '../_helper/shell';
import { simplifyControlFlowInformation } from '../../../src/control-flow/cfg-simplification';
import { defaultConfigOptions } from '../../../src/config';
import { contextFromInput } from '../../../src/project/context/flowr-analyzer-context';
import { CfgVertex } from '../../../src/control-flow/control-flow-graph';

describe('Control Flow Graph', withTreeSitter(parser => {
	function assertOrderBasic(
		label: string,
		code: string,
		expectedForward: readonly NodeId[],
		expectedBackward: readonly NodeId[] = expectedForward.toReversed(),
		useBasicBlocks = false,
		options?: Omit<BasicCfgGuidedVisitorConfiguration, 'controlFlow' | 'defaultVisitingOrder'>
	): void {
		describe(label, () => {
			it.each(['forward', 'backward'] as const)('%s', async(dir) => {
				const config = defaultConfigOptions;
				const order: NodeId[] = [];
				class TestVisitor extends BasicCfgGuidedVisitor {
					override onVisitNode(node: NodeId): void {
						order.push(node);
						super.onVisitNode(node);
					}
				}

				const context = contextFromInput(code, config);
				const result = await createDataflowPipeline(parser, {
					context
				}).allRemainingSteps();
				let cfg = extractCfg(result.normalize, context, result.dataflow?.graph);
				if(useBasicBlocks) {
					cfg = simplifyControlFlowInformation(cfg, { ast: result.normalize, dfg: result.dataflow.graph, ctx: context }, ['to-basic-blocks', 'remove-dead-code']);
				}

				const configuration: BasicCfgGuidedVisitorConfiguration = {
					...options,
					defaultVisitingOrder: dir,
					controlFlow:          cfg
				};
				const visitor = new TestVisitor(configuration);
				visitor.start();
				assert.deepEqual(order, dir === 'forward' ? expectedForward : expectedBackward, `visiting order ${dir} is not as expected`);
			});
		});
	}

	assertOrderBasic('simple assignment', 'a <- 1', [3, 2, 0, 1, CfgVertex.toExitId(2), CfgVertex.toExitId(3)]);
	assertOrderBasic('simple assignment (basic blocks)', 'a <- 1', [CfgVertex.toBasicBlockId(CfgVertex.toExitId(3)), 3, 2, 0, 1, CfgVertex.toExitId(2), CfgVertex.toExitId(3)], [CfgVertex.toBasicBlockId(CfgVertex.toExitId(3)), CfgVertex.toExitId(3), CfgVertex.toExitId(2), 1, 0, 2, 3], true);
	assertOrderBasic('sequence', 'a;b', [2, 0, 1, CfgVertex.toExitId(2)]);
	assertOrderBasic('while-loop', 'while(TRUE) a + b',
		[6, 5, 0, 4, 3, 1, 2, CfgVertex.toExitId(3), CfgVertex.toExitId(4), CfgVertex.toExitId(5), CfgVertex.toExitId(6)],
		[CfgVertex.toExitId(6), CfgVertex.toExitId(5), 0, 5, CfgVertex.toExitId(4), CfgVertex.toExitId(3), 2, 1, 3, 4, 6]
	);

}));