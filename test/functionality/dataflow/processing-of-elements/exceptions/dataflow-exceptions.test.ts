import { assert, describe, test } from 'vitest';
import { withTreeSitter } from '../../../_helper/shell';
import { label } from '../../../_helper/label';
import { FlowrAnalyzerBuilder } from '../../../../../src/project/flowr-analyzer-builder';
import { requestFromInput } from '../../../../../src/r-bridge/retriever';
import type { SingleSlicingCriterion } from '../../../../../src/slicing/criterion/parse';
import { Q } from '../../../../../src/search/flowr-search-builder';
import { graphToMermaidUrl } from '../../../../../src/util/mermaid/dfg';

interface DFConstraints {
	hasVertices:         SingleSlicingCriterion[];
	doesNotHaveVertices: SingleSlicingCriterion[];
	// TODO: wanted cds
}

// TODO: support try, tryCatch, withCallingHandlers
// TODO: test that it breaks loops with another visitor that does these computations transitively

describe('Dataflow, Handle Exceptions', withTreeSitter(ts  => {
	function checkDfContains(code: string, constraints: DFConstraints): void {
		const effName = label(code, ['exceptions-and-errors'], ['dataflow']);
		test(effName, async() => {
			const analyzer = await new FlowrAnalyzerBuilder().setParser(ts).build();
			analyzer.addRequest(requestFromInput(code));
			const df = await analyzer.dataflow();
			try {
				for(const [coll, shouldHave] of [[constraints.hasVertices, true], [constraints.doesNotHaveVertices, false]] as const) {
					for(const v of coll) {
						const resolved = (await analyzer.runSearch(Q.criterion(v))).getElements();
						assert.lengthOf(resolved, 1);
						const id = resolved[0].node.info.id;
						const hasVertex = df.graph.hasVertex(id);
						assert.strictEqual(hasVertex, shouldHave);
					}
				}
			} catch(e: unknown) {
				console.error('DF', graphToMermaidUrl(df.graph));
				throw e;
			}
		});
	}

	describe('Simple Exceptions', () => {
		const trueVariants = ['stopifnot(TRUE)', 'if(FALSE) stop()', 'stopifnot(u)', 'stopifnot(TRUE, u)', 'stopifnot(TRUE, TRUE)', 'stopifnot(TRUE, T, TRUE)', 'stopifnot(t, t)', 'stopifnot(exprs={TRUE; TRUE})'];
		const falseVariants = ['if(TRUE) stop()', 'repeat { stop() }', 'stop()', 'stop(msg)', 'stopifnot(FALSE)', 'stopifnot(FALSE, u)', 'stopifnot(FALSE, TRUE)', 'stopifnot(FALSE, F, FALSE)', 'stopifnot(f, f)', 'stopifnot(exprs={FALSE; FALSE})'];
		for(const [variant, exp] of [[trueVariants, true], [falseVariants, false]] as const) {
			describe(exp ? 'Reachable' : 'Unreachable', () => {
				for(const v of variant) {
					checkDfContains(`x <- 1
t <- TRUE
f <- FALSE
${v}
3`, { hasVertices: exp ? ['1@1', '5@3'] : ['1@1'], doesNotHaveVertices: exp ? [] : ['5@3'] });
				}
			});
		}
	});
	describe('Exceptions must propagate through functions', () => {
		for(const [stopName, callArgs] of [['stop',''], ['stopifnot', 'FALSE'], ['abort', '']] as const) {
			checkDfContains(`1
indirect <- function() { ${stopName}(${callArgs}) }
indirect()
3`, { hasVertices: ['1@1'], doesNotHaveVertices: ['4@3'] });
		}
	});
	describe('Exceptions with try and tryCatch', () => {
		describe('try', () => {
			checkDfContains('1\ntry({ stop("error") })\n3', { hasVertices: ['1@1', '3@3'], doesNotHaveVertices: [] });
			checkDfContains('1\ntry({ stop("error") }, silent=TRUE)\n3', { hasVertices: ['1@1', '3@3'], doesNotHaveVertices: [] });
			checkDfContains('1\ntry(if(u) stop(), silent=TRUE)\n3', { hasVertices: ['1@1', '3@3'], doesNotHaveVertices: [] });
			checkDfContains('1\ntry(x, silent=stop("x"))\n3', { hasVertices: ['1@1'], doesNotHaveVertices: ['3@3'] });
			checkDfContains('1\ntry(x);stop()\n3', { hasVertices: ['1@1'], doesNotHaveVertices: ['3@3'] });
			checkDfContains('1\nstop();try(x)\n3', { hasVertices: ['1@1'], doesNotHaveVertices: ['3@3'] });
			checkDfContains('1\nprint({ stop("error") })\n3', { hasVertices: ['1@1'], doesNotHaveVertices: ['3@3'] });
		});
	});
}));