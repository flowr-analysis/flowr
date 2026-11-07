import { describe } from 'vitest';
import { withTreeSitter } from '../../_helper/shell';
import { resolvesLikeR, sliceMatchesR, type TransitivityCase, testing } from './transitivity';

describe('Transitivity through calls and closures, checked against R', withTreeSitter(parser => {
	describe('nested calls', () => {
		const cases: readonly TransitivityCase[] = [
			{ name: 'a global read three calls deep', code: 'x <- 1\nf <- function() g()\ng <- function() h()\nh <- function() x\nx <- 2\nprint(f())', dropped: 'x <- 1' },
			{ name: 'a value through three parameters', code: 'a <- function(p) b(p + 1)\nb <- function(q) cc(q * 2)\ncc <- function(r) r - 1\ny <- a(3)\nprint(y)' },
			{ name: 'a super assignment three calls deep', code: 'n <- 0\nf <- function() g()\ng <- function() h()\nh <- function() n <<- n + 1\nf()\nf()\nprint(n)' },
			{ name: 'an option set three calls deep', code: 'f <- function() g()\ng <- function() h()\nh <- function() options(digits = 3)\nf()\nprint(pi)' },
			{ name: 'a callee defined after the caller', code: 'f <- function() g(2)\ng <- function(v) v * k\nk <- 5\nprint(f())' },
			{ name: 'a redefined callee between calls', code: 'g <- function() 1\nf <- function() g()\ng <- function() 2\nprint(f())', dropped: 'function() 1' },
			{ name: 'a callee passed down as an argument', code: 'k <- 4\nap <- function(fn, v) fn(v)\nwr <- function(fn, v) ap(fn, v)\nprint(wr(function(v) v + k, 1))' },
			{ name: 'a side effect in an argument of a nested call', code: 'n <- 0\nf <- function(a) g(a)\ng <- function(b) b\nf(n <- 3)\nprint(n)' }
		];
		for(const c of cases) {
			sliceMatchesR(parser, c);
		}
	});

	describe('closures', () => testing(['closures'], () => {
		const cases: readonly TransitivityCase[] = [
			{ name: 'a local captured by a returned function', code: 'f <- function() { x <- 5; function() x }\ng <- f()\nprint(g())' },
			{ name: 'a parameter captured by a returned function', code: 'mk <- function(v) function() v\nk <- mk(7)\nprint(k())' },
			{ name: 'a counter closure', code: 'mk <- function() { i <- 0; function() { i <<- i + 1; i } }\nc1 <- mk()\nc1()\nc1()\nprint(c1())' },
			{ name: 'a global changed after the closure was made', code: 'x <- 1\nf <- function() function() x\ng <- f()\nx <- 2\nprint(g())', dropped: 'x <- 1' },
			{ name: 'a global changed after a closure held in a local was made', code: 'x <- 1\nf <- function() { h <- function() x; h }\ng <- f()\nx <- 2\nprint(g())', dropped: 'x <- 1' },
			{ name: 'a global changed between two nested closures', code: 'x <- 1\nf <- function() function() function() x\ng <- f()\nx <- 2\nh <- g()\nx <- 3\nprint(h())', dropped: 'x <- 2' },
			{ name: 'a global changed after the closure was made, called by sapply', code: 'x <- 1\nf <- function() function(i) x\ng <- f()\nx <- 2\nprint(sapply(1, g))', dropped: 'x <- 1' },
			{ name: 'a global changed after the closure was made, called by Reduce', code: 'x <- 1\nf <- function() function(a, b) a + b + x\ng <- f()\nx <- 2\nprint(Reduce(g, 1:3))', dropped: 'x <- 1' },
			{ name: 'a global changed after the closure was made, called by a handler', code: 'x <- 1\nf <- function() function(e) x\ng <- f()\nx <- 2\nprint(tryCatch(stop("a"), error = g))', dropped: 'x <- 1' },
			{ name: 'a global changed after a closure called by the function making it', code: 'x <- 1\nk <- function(fn) fn()\nf <- function() k(function() x)\ny <- f()\nx <- 2\nprint(y)', dropped: 'x <- 2' },
			{ name: 'a global changed after a closure called by an unmodeled function', code: 'x <- 1\nf <- function() Vectorize(function(i) i + x)(1:2)\ny <- f()\nx <- 2\nprint(y)' },
			{ name: 'three nested returned functions', code: 'k <- 42\nf <- function() function() function() k\nprint(f()()())' },
			{ name: 'sibling closures sharing a frame', code: 'mk <- function() { v <- 1; list(set = function(n) v <<- n, get = function() v) }\no <- mk()\no$set(9)\nprint(o$get())' },
			{ name: 'closures made by lapply', code: 'ad <- lapply(1:3, function(i) function(x) x + i)\nprint(ad[[2]](10))' },
			{ name: 'a lazy parameter captured unforced', code: 'f <- function(x) function() x\ny <- 2\ng <- f(y)\ny <- 3\nprint(g())' },
			{ name: 'a forced parameter captured', code: 'f <- function(x) { force(x); function() x }\ny <- 2\ng <- f(y)\ny <- 3\nprint(g())', dropped: 'y <- 3' },
			{ name: 'a closure stored in a list and called later', code: 'k <- 3\nl <- list(f = function() k * 2)\nh <- l$f\nprint(h())' },
			{ name: 'a closure returned through two calls', code: 'mk <- function(v) function() v + 1\npass <- function(fn) fn\ng <- pass(pass(mk(4)))\nprint(g())' }
		];
		for(const c of cases) {
			sliceMatchesR(parser, c);
		}
	}));

	describe('closures called in loops', () => testing(['closures', 'for-loop', 'while-loop', 'repeat-loop'], () => {
		const cases: readonly TransitivityCase[] = [
			{ name: 'a for loop redefining the global before the call', code: 'x <- 1\nf <- function() x\nfor(i in 1:3) {\n  x <- x + 1\n  y <- f()\n}\nprint(y)' },
			{ name: 'a while loop redefining the global after the call', code: 'x <- 1\nf <- function() x\ni <- 0\nwhile(i < 2) {\n  i <- i + 1\n  y <- f()\n  x <- 7\n}\nprint(y)' },
			{ name: 'a repeat loop redefining the global after the call', code: 'x <- 1\nf <- function() x\nrepeat {\n  y <- f()\n  if(x > 2) break\n  x <- x + 2\n}\nprint(y)' },
			{ name: 'a closure defined in nested loops', code: 'x <- 1\nfor(j in 1:2) for(i in 1:2) {\n  f <- function() x\n  y <- f()\n  x <- 10\n}\nprint(y)' },
			{ name: 'a closure called through a variable in a loop', code: 'x <- 1\nf <- function() x\ng <- f\nfor(i in 1:2) {\n  y <- g()\n  x <- 5\n}\nprint(y)' },
			{ name: 'a closure in an inner loop and a global set by the outer one', code: 'x <- 1\nf <- function() x\nfor(j in 1:2) {\n  for(i in 1:2) {\n    y <- f()\n  }\n  x <- 4\n}\nprint(y)' },
			{ name: 'a closure called by a closure in a loop', code: 'x <- 1\ng <- function() x\nf <- function() g()\nfor(i in 1:2) {\n  y <- f()\n  x <- 9\n}\nprint(y)' },
			{ name: 'a closure in a while condition', code: 'x <- 1\nf <- function() x\ny <- 0\nwhile(f() < 3) {\n  y <- y + 1\n  x <- x + 1\n}\nprint(y)' },
			{ name: 'a loop in a function with a closure of its frame', code: 'h <- function() {\n  x <- 1\n  f <- function() x\n  for(i in 1:2) {\n    y <- f()\n    x <- 6\n  }\n  y\n}\nprint(h())' }
		];
		for(const c of cases) {
			sliceMatchesR(parser, c);
		}
		resolvesLikeR(parser, 'a for loop redefining the global before the call', 'x <- 1\nf <- function() x\nfor(i in 1:3) {\n  x <- x + 1\n  y <- f()\n}\ncat(y)', '7@y');
		resolvesLikeR(parser, 'a closure defined in nested loops', 'x <- 1\nfor(j in 1:2) for(i in 1:2) {\n  f <- function() x\n  y <- f()\n  x <- 10\n}\ncat(y)', '7@y');
		resolvesLikeR(parser, 'a closure called through a variable in a loop', 'x <- 1\nf <- function() x\ng <- f\nfor(i in 1:2) {\n  y <- g()\n  x <- 5\n}\ncat(y)', '8@y');
		resolvesLikeR(parser, 'a loop in a function with a closure of its frame', 'h <- function() {\n  x <- 1\n  f <- function() x\n  for(i in 1:2) {\n    y <- f()\n    x <- 6\n  }\n  y\n}\ny <- h()\ncat(y)', '11@y');
		resolvesLikeR(parser, 'a loop in a function with a global closure', 'x <- 1\nf <- function() x\nh <- function() {\n  for(i in 1:2) {\n    y <- f()\n    x <- 6\n  }\n  y\n}\ny <- h()\ncat(y)', '11@y');
		resolvesLikeR(parser, 'a while loop redefining the global after the call', 'x <- 1\nf <- function() x\ni <- 0\nwhile(i < 2) {\n  i <- i + 1\n  y <- f()\n  x <- 7\n}\ncat(y)', '9@y');
		resolvesLikeR(parser, 'a while loop redefining the global around the call', 'x <- 1\nf <- function() x\ni <- 0\nwhile(i < 3) {\n  i <- i + 1\n  x <- 2\n  y <- f()\n  x <- 7\n}\ncat(y)', '10@y');
		resolvesLikeR(parser, 'a while loop counting down', 'n <- 0\ni <- 3\nwhile(i > 0) {\n  n <- n + 1\n  i <- i - 1\n}\ncat(n)', '7@n');
		resolvesLikeR(parser, 'the counter of a while loop', 'i <- 0\nwhile(i < 3) i <- i + 1\ncat(i)', '3@i');
		resolvesLikeR(parser, 'a while loop that never runs', 'x <- 1\nf <- function() x\ni <- 5\nwhile(i < 3) {\n  i <- i + 1\n  y <- f()\n  x <- 7\n}\ncat(x)', '9@x');
		resolvesLikeR(parser, 'a while loop with an unknown bound', 'x <- 1\nf <- function() x\ni <- 0\nn <- length(commandArgs())\nwhile(i < n + 2) {\n  i <- i + 1\n  y <- f()\n  x <- 7\n}\ncat(y)', '10@y', { imprecise: 'resolves 1 and 7, the bound is not known' });
		resolvesLikeR(parser, 'a repeat loop breaking at its end', 'x <- 1\nf <- function() x\ni <- 0\nrepeat {\n  i <- i + 1\n  y <- f()\n  x <- 7\n  if(i >= 2) break\n}\ncat(y)', '10@y');
		resolvesLikeR(parser, 'a repeat loop breaking after one run', 'x <- 1\nf <- function() x\ni <- 0\nrepeat {\n  i <- i + 1\n  y <- f()\n  x <- 7\n  if(i >= 1) break\n}\ncat(y)', '10@y');
		resolvesLikeR(parser, 'the counter of a repeat loop', 'i <- 0\nrepeat {\n  i <- i + 1\n  if(i >= 4) break\n}\ncat(i)', '6@i');
		resolvesLikeR(parser, 'a global redefined before and after the call', 'x <- 1\nf <- function() x\nfor(i in 1:2) {\n  x <- 3\n  y <- f()\n  x <- 9\n}\ncat(y)', '8@y');
		resolvesLikeR(parser, 'a global redefined around a closure calling a closure', 'x <- 1\ng <- function() x\nf <- function() g()\nfor(i in 1:2) {\n  x <- 3\n  y <- f()\n  x <- 9\n}\ncat(y)', '9@y');
		resolvesLikeR(parser, 'a global redefined by the outer loop after the inner one', 'x <- 0\nf <- function() x\nfor(j in 1:2) {\n  for(i in 1:2) {\n    y <- f()\n    x <- 9\n  }\n  x <- 5\n}\ncat(y)', '10@y');
	}));

	describe('values', () => {
		resolvesLikeR(parser, 'a global read three calls deep', 'x <- 1\nf <- function() g()\ng <- function() h()\nh <- function() x\nx <- 2\ny <- f()\ncat(y)', '7@y');
		resolvesLikeR(parser, 'a value through three parameters', 'a <- function(p) b(p + 1)\nb <- function(q) cc(q * 2)\ncc <- function(r) r - 1\ny <- a(3)\ncat(y)', '5@y');
		resolvesLikeR(parser, 'an identity chain', 'id1 <- function(p) id2(p)\nid2 <- function(q) id3(q)\nid3 <- function(r) r\ny <- id1(6)\ncat(y)', '5@y');
		resolvesLikeR(parser, 'a local captured by a returned function', 'f <- function() { x <- 5; function() x }\ng <- f()\ny <- g()\ncat(y)', '4@y');
		resolvesLikeR(parser, 'a parameter captured by a returned function', 'mk <- function(v) function() v\nk <- mk(7)\ny <- k()\ncat(y)', '4@y');
		resolvesLikeR(parser, 'a global changed after the closure was made', 'x <- 1\nf <- function() function() x\ng <- f()\nx <- 2\ny <- g()\ncat(y)', '6@y');
		resolvesLikeR(parser, 'a lazy parameter captured unforced', 'f <- function(x) function() x\ny <- 2\ng <- f(y)\ny <- 3\nz <- g()\ncat(z)', '6@z');
		resolvesLikeR(parser, 'a forced parameter captured', 'f <- function(x) { force(x); function() x }\ny <- 2\ng <- f(y)\ny <- 3\nz <- g()\ncat(z)', '6@z');
		resolvesLikeR(parser, 'a super assignment three calls deep', 'n <- 0\nf <- function() g()\ng <- function() h()\nh <- function() n <<- 4\nf()\ncat(n)', '6@n');
	});
}));
