import { assert, describe, test } from 'vitest';
import { FlowrAnalyzerBuilder } from '../../../src/project/flowr-analyzer-builder';
import { withTreeSitter } from '../_helper/shell';
import { label } from '../_helper/label';
import { Ternary } from '../../../src/util/logic';

describe('Inspect Strict Functions Query', withTreeSitter(parser => {
	/** The verdicts the query hands out for the program's function definitions. */
	function testStrictness(name: string, code: string, expected: readonly Ternary[]) {
		test(label(name, ['name-normal'], ['other']), async() => {
			const analyzer = await new FlowrAnalyzerBuilder().setParser(parser).build();
			analyzer.addRequest(code);
			const result = await analyzer.query([{ type: 'inspect-strictness' }]);
			const found = result['inspect-strictness'].strictness;
			assert.isNotEmpty(Object.keys(found), 'the query has to report every function definition');
			assert.deepStrictEqual(Object.values(found).map(f => f.strict), [...expected], JSON.stringify(found));
		});
	}

	testStrictness('a function reading its parameter is strict', 'f <- function(x) x + 1', [Ternary.Always]);
	testStrictness('one ignoring it is not', 'f <- function(x) 1', [Ternary.Never]);
	testStrictness('a conditional read is conditional', 'f <- function(x) if(runif(1) > .5) x', [Ternary.Maybe]);
	/* counterexamples: what the verdict has to get right where the read is not a plain one */
	testStrictness('an assignment forces what it stores', 'f <- function(x) { y <- x }', [Ternary.Always]);
	testStrictness('a constant condition is no condition', 'f <- function(x) if(TRUE) x', [Ternary.Always]);
	testStrictness('a dead branch never forces', 'f <- function(x) if(FALSE) x else 1', [Ternary.Never]);
	testStrictness('a quoted parameter is not evaluated', 'f <- function(x) quote(x)', [Ternary.Never]);
	testStrictness('a caught block still evaluates', 'f <- function(x) tryCatch(x, error = function(e) 1)', [Ternary.Never, Ternary.Always]);

	testStrictness('the callee decides for an argument passed on', 'g <- function(y) y\nf <- function(x) g(x)', [Ternary.Always, Ternary.Always]);
	testStrictness('a callee leaving it alone makes it lazy', 'g <- function(y) 1\nf <- function(x) g(x)', [Ternary.Never, Ternary.Never]);

	test(label('the query reports each parameter on its own', ['name-normal'], ['other']), async() => {
		const analyzer = await new FlowrAnalyzerBuilder().setParser(parser).build();
		analyzer.addRequest('f <- function(x, y) x');
		const result = await analyzer.query([{ type: 'inspect-strictness' }]);
		const [info] = Object.values(result['inspect-strictness'].strictness);
		assert.deepStrictEqual(Object.values(info.parameters), [Ternary.Always, Ternary.Never], JSON.stringify(info));
		assert.strictEqual(info.strict, Ternary.Never);
	});

	test(label('the filter narrows the definitions', ['name-normal'], ['other']), async() => {
		const analyzer = await new FlowrAnalyzerBuilder().setParser(parser).build();
		analyzer.addRequest('f <- function(x) x\ng <- function(y) 1');
		const result = await analyzer.query([{ type: 'inspect-strictness', filter: ['2@function'] }]);
		const found = result['inspect-strictness'].strictness;
		assert.deepStrictEqual(Object.values(found).map(f => f.strict), [Ternary.Never], JSON.stringify(found));
	});
}));
