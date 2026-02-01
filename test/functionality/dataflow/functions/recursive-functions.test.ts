import { assert, describe, test } from 'vitest';
import { withTreeSitter } from '../../_helper/shell';
import { type SingleSlicingCriterion, tryResolveSliceCriterionToId } from '../../../../src/slicing/criterion/parse';
import { isFunctionRecursive } from '../../../../src/dataflow/fn/recursive-function';
import { FlowrAnalyzerBuilder } from '../../../../src/project/flowr-analyzer-builder';
import { requestFromInput } from '../../../../src/r-bridge/retriever';
import { graphToMermaidUrl } from '../../../../src/util/mermaid/dfg';

describe('is-recursive-function', withTreeSitter(ts => {
	function testRec(
		label: string,
		code: string,
		expect: {
			pos?: SingleSlicingCriterion[]
			neg?: SingleSlicingCriterion[]
		}
	) {
		for(const [exp, crit] of [[true, expect.pos], [false, expect.neg]] as const) {
			for(const c of crit ?? []) {
				test(`${label} (expect ${c} to be ${exp ? 'rec' : 'not rec'})`, async() => {
					const analyzer = new FlowrAnalyzerBuilder().setParser(ts).buildSync();
					analyzer.addRequest(requestFromInput(code));
					const idMap = (await analyzer.normalize()).idMap;
					const id = tryResolveSliceCriterionToId(c, idMap);
					// move up the error message :sparkles:
					assert.isDefined(id, `could not resolve criterion ${c}`);
					try {
						assert.strictEqual(isFunctionRecursive(id, await analyzer.callGraph()), exp);
					} catch(e) {
						console.error(`Error while testing criterion ${c} in code:\n${code}`);
						console.log('CG', graphToMermaidUrl(await analyzer.callGraph()));
						console.log('DFG', graphToMermaidUrl((await analyzer.dataflow()).graph));
						throw e;
					}
				});
			}
		}
	}

	testRec('direct recursion', 'f <- function(x) {\n if(x <= 1) 1 else x * f(x - 1)\n}', { pos: ['1@function'], neg: ['2@-'] });
	testRec('non-recursive', 'f <- function(x) {\n g(x - 1)\n}', { neg: ['1@function'] });
	testRec('fak', 'f <- function(x) {\n if(x <= 1) 1 else x * (function(y) { y - 1 })(x)\n}', { neg: ['1@function'] });
	testRec('fib', `fib <- function(n) {
	if(n <= 1) n else fib(n - 1) + fib(n - 2)
}
`, { pos: ['1@function'] });
	testRec('dead fib', `fib <- function(n) {
	if(TRUE) n else fib(n - 1) + fib(n - 2)
}
`, { neg: ['1@function'] });
	testRec('indirect recursion', `f <- function(x) {
	if(x <= 1) 1 else x * g(x - 1)
}
g <- function(y) {
	if(y <= 1) 1 else y * f(y - 1)
}
x <- function(z) {
	z + 1
}
`, { pos: ['1@function', '4@function'], neg: ['7@function'] });
	testRec('Loops are not recursion', `f <- function(x) {
	sum <- 0
	for(i in 1:x) {
		sum <- sum + i
	}
	return(sum)
}
`, { neg: ['1@function'] });
	// we assume it is!
	testRec('Recursive Higher-Order Function Unknown', `applyRec <- function(f, x) {
	if(x <= 1) return(1)
	else return(f(x, applyRec(f, x -1)))
}
`, { pos: ['1@function'] });
	testRec('Non-Recursive Higher-Order Function', `applyNonRec <- function(f, x) {
	if(x <= 1) return(1)
	else return(f(x, x - 1))
	}`, { neg: ['1@function'] });
	testRec('Recursive Higher-Order Function Known', `applyRec <- function(x) {
	f <- function(a, b) { a + b }
	if(x <= 1) return(1)
	else return(f(x, applyRec(f, x -1)))
}
`, { pos: ['1@function'] });
}));
