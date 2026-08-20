import { assert, describe, it } from 'vitest';
import { type BasicCfgGuidedVisitorConfiguration, BasicCfgGuidedVisitor } from '../../../src/control-flow/basic-cfg-guided-visitor';
import type { NodeId } from '../../../src/r-bridge/lang-4.x/ast/model/processing/node-id';
import { createDataflowPipeline } from '../../../src/core/steps/pipeline/default-pipelines';
import { extractCfg, CfgVertex  } from '../../../src/control-flow/control-flow-graph';
import { withTreeSitter } from '../_helper/shell';
import { simplifyControlFlowInformation } from '../../../src/control-flow/cfg-simplification';
import { contextFromInput } from '../../../src/project/context/flowr-analyzer-context';
import { visitCfgInOrder } from '../../../src/control-flow/simple-visitor';
import { FlowrConfig } from '../../../src/config';

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
				const config = FlowrConfig.default();
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
				let cfg = extractCfg(result.dataflow);
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

	it('walking the control flow does not copy it out of the dataflow graph', async() => {
		const context = contextFromInput('x <- 1\nif(u) { y <- 2 } else { y <- 3 }\nprint(y)', FlowrConfig.default());
		const result = await createDataflowPipeline(parser, { context }).allRemainingSteps();
		const cfg = extractCfg(result.dataflow);
		const projection = cfg.graph as unknown as { projected: boolean };

		visitCfgInOrder(cfg.graph, cfg.entryPoints, () => { /* just walk it */ });
		assert.isFalse(projection.projected, 'a traversal is answered by the dataflow graph itself');

		cfg.graph.vertices(true);
		assert.isTrue(projection.projected, 'asking for every vertex at once is what projects the graph');
	});

	assertOrderBasic('simple assignment', 'a <- 1', [1, 0, 2]);
	assertOrderBasic('simple assignment (basic blocks)', 'a <- 1',
		[CfgVertex.toBasicBlockId(1), 1, 0, 2],
		[CfgVertex.toBasicBlockId(1), 2, 0, 1],
		true
	);
	assertOrderBasic('sequence', 'a;b', [0, 1]);
	assertOrderBasic('while-loop', 'while(TRUE) a + b',
		[0, 1, 2, 3, 5],
		[5, 0, 3, 2, 1]
	);

}));