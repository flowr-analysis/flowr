import { bench, describe } from 'vitest';
import type { PipelineOutput } from '../../../../src/core/steps/pipeline/pipeline';
import type {
	TREE_SITTER_DATAFLOW_PIPELINE
} from '../../../../src/core/steps/pipeline/default-pipelines';
import {
	createDataflowPipeline
} from '../../../../src/core/steps/pipeline/default-pipelines';
import { TreeSitterExecutor } from '../../../../src/r-bridge/lang-4.x/tree-sitter/tree-sitter-executor';
import { requestFromInput } from '../../../../src/r-bridge/retriever';
import type { NodeId } from '../../../../src/r-bridge/lang-4.x/ast/model/processing/node-id';
import { runSearch } from '../../../../src/search/flowr-search-executor';
import { Q } from '../../../../src/search/flowr-search-builder';
import { staticBackwardSlice } from '../../../../src/slicing/static/static-slicer';
import { guard } from '../../../../src/util/assert';



describe('slicing', () => {
	let result: PipelineOutput<typeof TREE_SITTER_DATAFLOW_PIPELINE> | undefined = undefined;
	let ids: NodeId[] | undefined = undefined;

	for(const threshold of [1, 10, 100, 200]) {
		bench(`slice (threshold: ${threshold})`, async() => {
			if(!result) {
				await TreeSitterExecutor.initTreeSitter();
				const exec = new TreeSitterExecutor();
				result = await createDataflowPipeline(exec, {
					/* make it hurt! */
					request: requestFromInput(`
for(i in 1:5) {
	if(u) {
		x <- c(1, 2, 3)
		y <- x
		f <- function(a, b, x) {
			if(x) {
				return(x + y + y[2] + a + b(a)) 
			}
		}
	}
	f(1, function(i) x[[i]] + 2, 3)
	x[1] <- 4
	x[2] <- x[1] + x[3]
}
			`.trim().repeat(200) + '\nprint(x + f(1, function(i) x[[i]] + 2, 3))'),
				}).allRemainingSteps();
				ids = runSearch(Q.var('print').first(), result).map(n => n.node.info.id);
			}
			guard(result !== undefined && ids !== undefined, () => 'no result');
			staticBackwardSlice(result.dataflow.graph, result.normalize, [`$${ids[0]}`], threshold);
		});
	}
});