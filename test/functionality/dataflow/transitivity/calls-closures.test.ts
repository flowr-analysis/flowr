import { describe } from 'vitest';
import { withTreeSitter } from '../../_helper/shell';
import { resolvesLikeR, sliceMatchesR, type TransitivityCase } from './transitivity';

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

	describe('closures', () => {
		const cases: readonly TransitivityCase[] = [
			{ name: 'a local captured by a returned function', code: 'f <- function() { x <- 5; function() x }\ng <- f()\nprint(g())' },
			{ name: 'a parameter captured by a returned function', code: 'mk <- function(v) function() v\nk <- mk(7)\nprint(k())' },
			{ name: 'a counter closure', code: 'mk <- function() { i <- 0; function() { i <<- i + 1; i } }\nc1 <- mk()\nc1()\nc1()\nprint(c1())' },
			{ name: 'a global changed after the closure was made', code: 'x <- 1\nf <- function() function() x\ng <- f()\nx <- 2\nprint(g())', dropped: 'x <- 1', imprecise: 'keeps x <- 1, the value at the time the closure was made' },
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
	});

	describe('values', () => {
		resolvesLikeR(parser, 'a global read three calls deep', 'x <- 1\nf <- function() g()\ng <- function() h()\nh <- function() x\nx <- 2\ny <- f()\ncat(y)', '7@y', { imprecise: 'resolves the value and unknown, a call in a function body adds unknown' });
		resolvesLikeR(parser, 'a value through three parameters', 'a <- function(p) b(p + 1)\nb <- function(q) cc(q * 2)\ncc <- function(r) r - 1\ny <- a(3)\ncat(y)', '5@y', { imprecise: 'resolves the value and unknown, a call in a function body adds unknown' });
		resolvesLikeR(parser, 'an identity chain', 'id1 <- function(p) id2(p)\nid2 <- function(q) id3(q)\nid3 <- function(r) r\ny <- id1(6)\ncat(y)', '5@y', { imprecise: 'resolves the value and unknown, a call in a function body adds unknown' });
		resolvesLikeR(parser, 'a local captured by a returned function', 'f <- function() { x <- 5; function() x }\ng <- f()\ny <- g()\ncat(y)', '4@y');
		resolvesLikeR(parser, 'a parameter captured by a returned function', 'mk <- function(v) function() v\nk <- mk(7)\ny <- k()\ncat(y)', '4@y');
		resolvesLikeR(parser, 'a global changed after the closure was made', 'x <- 1\nf <- function() function() x\ng <- f()\nx <- 2\ny <- g()\ncat(y)', '6@y', { imprecise: 'resolves 1 and 2, R reads x when the closure runs' });
		resolvesLikeR(parser, 'a lazy parameter captured unforced', 'f <- function(x) function() x\ny <- 2\ng <- f(y)\ny <- 3\nz <- g()\ncat(z)', '6@z');
		resolvesLikeR(parser, 'a forced parameter captured', 'f <- function(x) { force(x); function() x }\ny <- 2\ng <- f(y)\ny <- 3\nz <- g()\ncat(z)', '6@z');
		resolvesLikeR(parser, 'a super assignment three calls deep', 'n <- 0\nf <- function() g()\ng <- function() h()\nh <- function() n <<- 4\nf()\ncat(n)', '6@n');
	});
}));
