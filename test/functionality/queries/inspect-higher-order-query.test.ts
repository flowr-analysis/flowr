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
	testHigherOrder('a plain function is not', 'f <- function(x) x + 1\nf(1)', false);
	testHigherOrder('nor is one taking a value', 'f <- function(g) g\nf(2)', false);
	/* counterexamples: the body states what its parameters are for, whatever the call sites hand over */
	testHigherOrder('a parameter the body calls needs no call site', 'f <- function(g) g()', true);
	testHigherOrder('one handed to an applying built-in as well', 'f <- function(g) lapply(1:2, g)', true);
	testHigherOrder('a parameter called under another name counts', 'f <- function(g) { h <- g; h() }', true);
	testHigherOrder('handing back a function of its own counts', 'f <- function() { g <- function() 1; g }', true);

	/** What the query answers for every definition of the program, keyed by the definition as it is written. */
	function testEachHigherOrder(name: string, code: string, expected: Readonly<Record<string, boolean>>) {
		test(label(name, ['name-normal'], ['other']), async() => {
			const analyzer = await new FlowrAnalyzerBuilder().setParser(parser).build();
			analyzer.addRequest(code);
			const result = await analyzer.query([{ type: 'inspect-higher-order' }]);
			const idMap = (await analyzer.normalize()).idMap;
			const found: Record<string, boolean> = {};
			for(const [id, higherOrder] of Object.entries(result['inspect-higher-order'].higherOrder)) {
				found[idMap.get(Number(id))?.info.fullLexeme ?? id] = higherOrder;
			}
			assert.deepStrictEqual(found, { ...expected });
		});
	}

	/* a callback is not higher-order just because the built-in applying it hands it around */
	testEachHigherOrder('a named callback stays what it is', 'myf <- function(v) v + 1\nr <- lapply(1:3, myf)', {
		'function(v) v + 1': false
	});
	testEachHigherOrder('an inline callback as well', 'r <- lapply(1:3, function(v) v + 1)', {
		'function(v) v + 1': false
	});
	testEachHigherOrder('whichever built-in applies it', 'r <- Map(function(v) v + 1, 1:3)', {
		'function(v) v + 1': false
	});

	/* an inline function inside the returned expression is an argument of it, not what it hands back */
	testEachHigherOrder('a body applying an inline function returns its results', 'f <- function() sapply(1:2, function(i) i)', {
		'function(i) i':                         false,
		'function() sapply(1:2, function(i) i)': false
	});
	testEachHigherOrder('through a local as well', 'h <- function() { s <- sapply(1:2, function(i) i); s }', {
		'function(i) i':                                     false,
		'function() { s <- sapply(1:2, function(i) i); s }': false
	});
	testEachHigherOrder('and when the built-in filters', 'g <- function() Filter(function(x) x > 1, 1:3)', {
		'function(x) x > 1':                         false,
		'function() Filter(function(x) x > 1, 1:3)': false
	});

	/* what the fixes must leave alone */
	testEachHigherOrder('a parameter the body calls', 'f <- function(g) g(1)', { 'function(g) g(1)': true });
	testEachHigherOrder('only the composing function takes functions', 'comp <- function(f, g) function(x) f(g(x))', {
		'function(x) f(g(x))':                false,
		'function(f, g) function(x) f(g(x))': true
	});
	testEachHigherOrder('a body handing back a function', 'mk <- function() function() 1', {
		'function() 1':            false,
		'function() function() 1': true
	});
	testEachHigherOrder('the identity is not', 'id <- function(x) x', { 'function(x) x': false });
	testEachHigherOrder('a parameter called through do.call', 'a7 <- function(x) do.call(x, list(1))', {
		'function(x) do.call(x, list(1))': true
	});
	testEachHigherOrder('a function looked up by name is not handed in', 'a3 <- function(n) match.fun("sum")(n)', {
		'function(n) match.fun("sum")(n)': false
	});
	testEachHigherOrder('a parameter named after a built-in is still a value', 'a8 <- function(sum) sum + 1', {
		'function(sum) sum + 1': false
	});
	testEachHigherOrder('only the one taking the callback', 'g <- function(z) z+1\np <- function(cb) cb(1)\nq <- function() p(g)', {
		'function(z) z+1':    false,
		'function(cb) cb(1)': true,
		'function() p(g)':    false
	});

	/* what a call hands back is what its callee returns, never the callee itself */
	testEachHigherOrder('a helper call as the last expression', 'f <- function() { g <- function() 1; g() }', {
		'function() 1':                          false,
		'function() { g <- function() 1; g() }': false
	});
	testEachHigherOrder('an inline function applied right away', 'p <- function(x) (function(y) y + 1)(x)', {
		'function(y) y + 1':                  false,
		'function(x) (function(y) y + 1)(x)': false
	});
	testEachHigherOrder('a built-in making the function that is called', 'k <- function(x) Negate(is.na)(x)', {
		'function(x) Negate(is.na)(x)': false
	});
	testEachHigherOrder('a callee handing back a function still counts', 'mk <- function() function() 1\nuse <- function() mk()', {
		'function() 1':            false,
		'function() function() 1': true,
		'function() mk()':         true
	});
	/* a variable a nested lambda closes over is nothing the call around it calls */
	testEachHigherOrder('a captured value is no callee', 'f <- function(x) lapply(1:2, function(i) x)', {
		'function(i) x':                          false,
		'function(x) lapply(1:2, function(i) x)': false
	});
	testEachHigherOrder('a built-in applied to a value is not', 'f1 <- function(x) sapply(x, sqrt)', {
		'function(x) sapply(x, sqrt)': false
	});
	testEachHigherOrder('nor is a value handed through one', 'm <- function(x) identity(x)', {
		'function(x) identity(x)': false
	});
}));
