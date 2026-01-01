import { assert, describe, test } from 'vitest';
import { withTreeSitter } from '../../../_helper/shell';
import { label } from '../../../_helper/label';
import { FlowrAnalyzerBuilder } from '../../../../../src/project/flowr-analyzer-builder';
import { requestFromInput } from '../../../../../src/r-bridge/retriever';
import type { SingleSlicingCriterion } from '../../../../../src/slicing/criterion/parse';
import { Q } from '../../../../../src/search/flowr-search-builder';

interface DFConstraints {
	hasVertices:         SingleSlicingCriterion[];
	doesNotHaveVertices: SingleSlicingCriterion[];
	// TODO: wanted cds
}

describe('Dataflow, Handle Exceptions', withTreeSitter(ts  => {
	function checkDfContains(code: string, constraints: DFConstraints): void {
		const effName = label(code,['exceptions-and-errors'], ['dataflow']);
		test(effName, async() => {
			const analyzer = await new FlowrAnalyzerBuilder().setParser(ts).build();
			analyzer.addRequest(requestFromInput(code));
			const df = await analyzer.dataflow();
			for(const [coll, shouldHave] of [[constraints.hasVertices, true], [constraints.doesNotHaveVertices, false]] as const) {
				for(const v of coll) {
					const resolved = (await analyzer.runSearch(Q.criterion(v))).getElements();
					assert.lengthOf(resolved, 1);
					const id = resolved[0].node.info.id;
					const hasVertex = df.graph.hasVertex(id);
					assert.strictEqual(hasVertex, shouldHave);
				}
			}
		});
	}
	describe('Simple stops', () =>  {
		checkDfContains('x <- 1\nstopifnot(TRUE)\n3',  { hasVertices: ['1@1', '3@3'],  doesNotHaveVertices: [] });
		checkDfContains('x <- 1\nstopifnot(FALSE)\n3',  { hasVertices: ['1@1'],  doesNotHaveVertices: ['3@3'] });
	});
}));