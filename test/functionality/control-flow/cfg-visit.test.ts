import { assert, describe, it } from 'vitest';
import type {
	BasicCfgGuidedVisitorConfiguration
} from '../../../src/control-flow/basic-cfg-guided-visitor';
import {
	BasicCfgGuidedVisitor
} from '../../../src/control-flow/basic-cfg-guided-visitor';
import type { NodeId } from '../../../src/r-bridge/lang-4.x/ast/model/processing/node-id';
import { createDataflowPipeline } from '../../../src/core/steps/pipeline/default-pipelines';
import { requestFromInput } from '../../../src/r-bridge/retriever';
import { extractCfg } from '../../../src/control-flow/extract-cfg';
import { withTreeSitter } from '../_helper/shell';
import { simplifyControlFlowInformation } from '../../../src/control-flow/cfg-simplification';

describe('Control Flow Graph', withTreeSitter(parser => {
	function assertOrderBasic(
		label: string,
		code: string,
		expectedForward: readonly NodeId[],
		expectedBackward: readonly NodeId[] = expectedForward.toReversed(),
		useBasicBlocks = false,
		config?: Omit<BasicCfgGuidedVisitorConfiguration, 'controlFlow' | 'defaultVisitingOrder'>
	): void {
		describe(label, () => {
			it.each(['forward', 'backward'] as const)('%s', async(dir) => {
				const order: NodeId[] = [];
				class TestVisitor extends BasicCfgGuidedVisitor {
					override onVisitNode(node: NodeId): void {
						order.push(node);
						super.onVisitNode(node);
					}
				}

				const result = await createDataflowPipeline(parser, {
					request: requestFromInput(code)
				}).allRemainingSteps();
				let cfg = extractCfg(result.normalize, result.dataflow?.graph);
				if(useBasicBlocks) {
					cfg = simplifyControlFlowInformation(cfg, { ast: result.normalize, dfg: result.dataflow.graph }, ['to-basic-blocks', 'remove-dead-code']);
				}

				const configuration: BasicCfgGuidedVisitorConfiguration = {
					...config,
					defaultVisitingOrder: dir,
					controlFlow:          cfg
				};
				const visitor = new TestVisitor(configuration);
				visitor.start();
				assert.deepEqual(order, dir === 'forward' ? expectedForward : expectedBackward, `visiting order ${dir} is not as expected`);
			});
		});
	}

	assertOrderBasic('simple assignment', 'a <- 1', [3, 2, 0, 1, '2-exit', '3-exit']);
	assertOrderBasic('simple assignment (basic blocks)', 'a <- 1', ['bb-3-exit', 3, 2, 0, 1, '2-exit', '3-exit'], ['bb-3-exit', '3-exit', '2-exit', 1, 0, 2, 3], true);
	assertOrderBasic('sequence', 'a;b', [2, 0, 1, '2-exit']);
	assertOrderBasic('while-loop', 'while(TRUE) a + b',
		[6, 5, 0, '5-condition', '5-exit', '6-exit', 4, 3, 1, 2, '3-exit', '4-exit'],
		['6-exit', '5-exit', '5-condition', 0, 5, '4-exit', '3-exit', 2, 1, 3, 4, 6]
	);

}));