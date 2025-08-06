import { assert, describe, test } from 'vitest';
import type { SingleSlicingCriterion } from '../../../../src/slicing/criterion/parse';
import { slicingCriterionToId } from '../../../../src/slicing/criterion/parse';
import type { NodeId } from '../../../../src/r-bridge/lang-4.x/ast/model/processing/node-id';
import { withShell } from '../../_helper/shell';
import { createDataflowPipeline } from '../../../../src/core/steps/pipeline/default-pipelines';
import { requestFromInput } from '../../../../src/r-bridge/retriever';
import { defaultConfigOptions } from '../../../../src/config';

describe.sequential('dataflow graph links', withShell(shell => {
	function assertLink(name: string, code: string, criterion: SingleSlicingCriterion, expect: NodeId[] | undefined) {
		test(name, async() => {
			const info = await createDataflowPipeline(shell, {
				request: requestFromInput(code),
			}, defaultConfigOptions).allRemainingSteps();

			const graph = info.dataflow.graph;
			const id = slicingCriterionToId(criterion, graph.idMap ?? info.normalize.idMap);
			const link = graph.getLinked(id);
			if(expect === undefined) {
				assert.isUndefined(link);
			} else {
				assert.deepStrictEqual(link, expect);
			}
		});
	}

	assertLink('simple', 'x[0] <- 1', '1@<-', [3]);
	assertLink('simple', 'x <- 1', '1@<-', [2]);
	assertLink('simple', 'x$a$b <- 1', '1@<-', [6]);
}));