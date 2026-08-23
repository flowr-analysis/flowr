import { assert, describe, test } from 'vitest';
import { FlowrAnalyzerBuilder } from '../../../src/project/flowr-analyzer-builder';
import { withTreeSitter } from '../_helper/shell';
import { label } from '../_helper/label';

describe('Inspect Higher-Order Functions Query', withTreeSitter(parser => {
	/** Whether the query calls any of the program's function definitions higher-order. */
	function testHigherOrder(name: string, code: string, expected: boolean) {
		test(label(name, ['name-normal'], ['other']), async() => {
			const analyzer = await new FlowrAnalyzerBuilder().setParser(parser).build();
			analyzer.addRequest(code);
			const result = await analyzer.query([{ type: 'inspect-higher-order' }]);
			const found = result['inspect-higher-order'].higherOrder;
			assert.isNotEmpty(Object.keys(found), 'the query has to report every function definition');
			assert.strictEqual(Object.values(found).includes(true), expected, JSON.stringify(found));
		});
	}

	testHigherOrder('a function taking a function is higher-order', 'f <- function(g) g(1)\nh <- function(x) x\nf(h)', true);
	testHigherOrder('so is one taking a built-in', 'f <- function(g) g(1)\nf(print)', true);
	testHigherOrder('and one returning a function', 'f <- function() function() 1', true);
	testHigherOrder('a plain function is not', 'f <- function(x) x + 1\nf(1)', false);
	testHigherOrder('nor is one taking a value', 'f <- function(g) g\nf(2)', false);
	/* counterexamples: the body states what its parameters are for, whatever the call sites hand over */
	testHigherOrder('a parameter the body calls needs no call site', 'f <- function(g) g()', true);
	testHigherOrder('one handed to an applying built-in as well', 'f <- function(g) lapply(1:2, g)', true);
	testHigherOrder('and one called through do.call', 'f <- function(g) do.call(g, list())', true);
	testHigherOrder('a parameter only computed with stays plain', 'f <- function(x) x + 1', false);
	testHigherOrder('a parameter called under another name counts', 'f <- function(g) { h <- g; h() }', true);
	testHigherOrder('handing back a function of its own counts', 'f <- function() { g <- function() 1; g }', true);
}));
