import { assert, describe } from 'vitest';
import { withTreeSitter } from '../_helper/shell';
import { queryCase } from '../_helper/query';
import type { SlicingCriteria } from '../../../src/slicing/criterion/parse';
import { SlicingCriterion } from '../../../src/slicing/criterion/parse';
import { VertexType } from '../../../src/dataflow/graph/vertex';
import { NodeId } from '../../../src/r-bridge/lang-4.x/ast/model/processing/node-id';

describe('Inspect Recursion Query', withTreeSitter(parser => {
	/**
	 * The query has to answer for every function definition the code writes, so we compare the whole map:
	 * the definitions named by `recursive` are the ones that may call themselves again, all others may not.
	 */
	function testRecursion(name: string, code: string, recursive: SlicingCriteria) {
		queryCase(parser, 'inspect-recursion', name, code, async({ result, idMap, analyzer }) => {
			const found = result.recursive;
			const expectedRecursive = new Set(SlicingCriterion.decodeAll(recursive, idMap).map(d => String(d.id)));

			const expected: Record<string, boolean> = {};
			for(const [id] of (await analyzer.dataflow()).graph.verticesOfType(VertexType.FunctionDefinition)) {
				if(NodeId.isWritten(id)) {
					expected[String(id)] = expectedRecursive.has(String(id));
				}
			}
			assert.isNotEmpty(Object.keys(expected), 'the query has to report every function definition');
			assert.deepStrictEqual(found, expected, JSON.stringify({ found, expected }));
		});
	}

	describe('recursion the query has to find', () => {
		testRecursion('a function calling itself', 'f <- function(n) if(n > 0) f(n - 1) else 0', ['1@function']);
		testRecursion('two functions calling each other', 'f <- function() g()\ng <- function() f()', ['1@function', '2@function']);
		testRecursion('a cycle of three', 'f <- function(n) g(n)\ng <- function(n) h(n)\nh <- function(n) f(n)', ['1@function', '2@function', '3@function']);
		testRecursion('a call through Recall', 'f <- function(n) if(n > 0) Recall(n - 1) else 0', ['1@function']);
		testRecursion('a call built by do.call', 'f <- function() do.call("f", list())', ['1@function']);
		testRecursion('a call handed to an applying built-in', 'f <- function(x) if(is.list(x)) lapply(x, f) else x', ['1@function']);
		testRecursion('a call through the native pipe', 'f <- function(n) if(n > 0) (n - 1) |> f() else 0', ['1@function']);
		testRecursion('a call within a deferred expression', 'f <- function(n) { on.exit(if(n > 0) f(n - 1)); n }', ['1@function']);
		testRecursion('a nested definition calling out and back in',
			'outer <- function(n) {\n  inner <- function(m) if(m > 0) outer(m - 1) else 0\n  inner(n)\n}',
			['1@function', '2@function']);
		/* a definition shadowing a built-in of the same name is looked up when the body runs, not when it is written */
		testRecursion('a definition shadowing a built-in', 'c <- function(n) if(n > 0) c(n - 1) else 0', ['1@function']);
		testRecursion('two definitions shadowing built-ins calling each other', 'c <- function(n) rev(n)\nrev <- function(n) c(n)', ['1@function', '2@function']);
	});

	describe('what only looks like recursion', () => {
		testRecursion('a function calling something else', 'g <- function() 1\nf <- function() g()', []);
		testRecursion('an entry point outside the cycle', 'a <- function() b()\nb <- function() k()\nk <- function() d()\nd <- function() b()',
			['2@function', '3@function', '4@function']);
		testRecursion('a same-named definition of its own is another function', 'f <- function() { f <- function() 1; f() }', []);
		testRecursion('a dead branch', 'f <- function(n) if(FALSE) f(n) else n', []);
		testRecursion('a definition rebound before it is ever called', 'f <- function(n) f(n - 1)\nf <- function(n) n', []);
		/* writing a closure is not calling it, no matter what its body names */
		testRecursion('a nested definition naming the function it is written in', 'f <- function(n) { g <- function(m) f(m); 42 }', []);
		testRecursion('a nested definition in a branch', 'f <- function(n) { if(n > 0) { k <- function() f(1) }; n }', []);
		testRecursion('a nested definition inside a container', 'f <- function(n) { lst <- list(function() f(1)); n }', []);
		testRecursion('a nested definition reaching a third function that comes back', 'a <- function() { z <- function() b(); 1 }\nb <- function() a()', []);
		testRecursion('a nested Recall binds to the definition it sits in',
			'f <- function(n) {\n  h <- function(m) Recall(m - 1)\n  h(n)\n}', ['2@function']);
	});
}));
