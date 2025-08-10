import { assert, describe, test } from 'vitest';
import { withTreeSitter } from '../_helper/shell';
import { createDataflowPipeline } from '../../../src/core/steps/pipeline/default-pipelines';
import { requestFromInput } from '../../../src/r-bridge/retriever';
import { defaultConfigOptions } from '../../../src/config';
import { extractCfg } from '../../../src/control-flow/extract-cfg';
import { onlyLoopsOnce } from '../../../src/control-flow/useless-loop';
import type { SingleSlicingCriterion } from '../../../src/slicing/criterion/parse';
import { slicingCriterionToId } from '../../../src/slicing/criterion/parse';


describe('One Iteration Loop Detection', withTreeSitter(shell => {
	function checkLoop(name: string, code: string, node: SingleSlicingCriterion, expectedLoopsOnlyOnce: boolean) {
		test(name, async() => {
			const result = await createDataflowPipeline(shell, { 
				request: requestFromInput(code.trim()) 
			}, defaultConfigOptions).allRemainingSteps();
			const cfg = extractCfg(result.normalize, defaultConfigOptions, result.dataflow.graph);

			const actual = onlyLoopsOnce(slicingCriterionToId(node, result.normalize.idMap), result.dataflow.graph, cfg);
			assert(actual === expectedLoopsOnlyOnce, `Expected to ${expectedLoopsOnlyOnce ? 'loop only once' : 'loop multiple times'}`);
		});
	}


	checkLoop('Simple For', 'for(i in c(1)) { print(i) }', '1@for', true);
}));