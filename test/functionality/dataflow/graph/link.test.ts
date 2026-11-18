import { assert, describe, test } from 'vitest';
import { SlicingCriterion } from '../../../../src/slicing/criterion/parse';
import type { NodeId } from '../../../../src/r-bridge/lang-4.x/ast/model/processing/node-id';
import { withShell } from '../../_helper/shell';
import { analyze } from '../../_helper/analyzer';

describe('dataflow graph links', { concurrent: false }, withShell(shell => {
	function assertLink(name: string, code: string, criterion: SlicingCriterion, expect: NodeId[] | undefined) {
		test(name, async() => {
			const analyzer = await analyze(shell, code);
			const graph = (await analyzer.dataflow()).graph;
			const id = SlicingCriterion.parse(criterion, graph.idMap ?? (await analyzer.normalize()).idMap);
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