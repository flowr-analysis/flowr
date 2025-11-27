import { bench, describe } from 'vitest';
import { TreeSitterExecutor } from '../../../src/r-bridge/lang-4.x/tree-sitter/tree-sitter-executor';
import { requestFromInput } from '../../../src/r-bridge/retriever';
import type { NodeId } from '../../../src/r-bridge/lang-4.x/ast/model/processing/node-id';
import { Q } from '../../../src/search/flowr-search-builder';
import { guard } from '../../../src/util/assert';
import { staticSlice } from '../../../src/slicing/static/static-slicer';
import { SliceDirection } from '../../../src/core/steps/all/static-slicing/00-slice';
import { FlowrAnalyzerBuilder } from '../../../src/project/flowr-analyzer-builder';
import type { FlowrAnalyzer } from '../../../src/project/flowr-analyzer';


describe('slicing', () => {
	let analyzer: FlowrAnalyzer | undefined = undefined;
	let ids: NodeId[] | undefined = undefined;

	for(const threshold of [1, 10, 100, 200]) {
		bench(`slice (threshold: ${threshold})`, async() => {
			if(!analyzer) {
				/* make it hurt! */
				const request = requestFromInput(`
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
			`.trim().repeat(200) + '\nprint(x + f(1, function(i) x[[i]] + 2, 3))');
				await TreeSitterExecutor.initTreeSitter();
				const exec = new TreeSitterExecutor();
				analyzer = await new FlowrAnalyzerBuilder()
					.setParser(exec)
					.build();
				analyzer.addRequest(request);
				ids = (await analyzer.runSearch(Q.var('print').first())).getElements().map(n => n.node.info.id);
			}
			guard(ids !== undefined, () => 'no result');
			staticSlice(analyzer.inspectContext(), await analyzer.dataflow(), await analyzer.normalize(), [`$${ids[0]}`], SliceDirection.Backward, threshold);
		});
	}
});
