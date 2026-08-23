import { assert, describe, test } from 'vitest';
import { FlowrAnalyzerBuilder } from '../../../src/project/flowr-analyzer-builder';
import { withTreeSitter } from '../_helper/shell';
import { label } from '../_helper/label';

describe('Inspect Recursion Query', withTreeSitter(parser => {
	/** Whether the query calls any of the program's function definitions recursive. */
	function testRecursion(name: string, code: string, expected: boolean) {
		test(label(name, ['name-normal'], ['other']), async() => {
			const analyzer = await new FlowrAnalyzerBuilder().setParser(parser).build();
			analyzer.addRequest(code);
			const result = await analyzer.query([{ type: 'inspect-recursion' }]);
			const found = result['inspect-recursion'].recursive;
			assert.isNotEmpty(Object.keys(found), 'the query has to report every function definition');
			assert.strictEqual(Object.values(found).includes(true), expected, JSON.stringify(found));
		});
	}

	testRecursion('a function calling itself', 'f <- function(n) if(n > 0) f(n - 1)', true);
	testRecursion('two functions calling each other', 'f <- function() g()\ng <- function() f()', true);
	testRecursion('a call through Recall', 'f <- function() Recall()', true);
	testRecursion('a call built by do.call', 'f <- function() do.call("f", list())', true);
	testRecursion('a call handed to an applying built-in', 'f <- function() lapply(1:2, f)', true);
	testRecursion('a same-named definition of its own is another function', 'f <- function() { f <- function() 1; f() }', false);
	testRecursion('a function calling something else', 'g <- function() 1\nf <- function() g()', false);
}));
