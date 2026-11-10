import { describe } from 'vitest';
import { withTreeSitter } from '../../_helper/shell';
import { resolvesLikeR, sliceMatchesR, type TransitivityCase, testing } from './transitivity';

describe('Transitivity through arguments and promises, checked against R', withTreeSitter(parser => {
	describe('arguments and defaults', () => {
		const cases: readonly TransitivityCase[] = [
			{ name: 'a default referring to another parameter', code: 'f <- function(a, b = a * 2) b\nprint(f(4))' },
			{ name: 'a default referring to a local defined later', code: 'f <- function(b = y) { y <- 3; b }\nprint(f())' },
			{ name: 'a default reading a global', code: 'k <- 6\nf <- function(b = k) g(b)\ng <- function(v) v\nprint(f())' },
			{ name: 'dots forwarded through three calls', code: 'f <- function(...) g(...)\ng <- function(...) h(...)\nh <- function(a, b) a - b\nx <- 10\nprint(f(b = 1, a = x))' },
			{ name: 'a dots element by position', code: 'u <- 1\nv <- 5\nf <- function(...) ..2\nprint(f(u, v))', dropped: 'u <- 1' },
			{ name: 'a dots element by ...elt', code: 'u <- 1\nv <- 5\nf <- function(...) ...elt(2)\nprint(f(u, v))', dropped: 'u <- 1' },
			{ name: 'a dots element by position handed on', code: 'u <- 1\nv <- 5\nf <- function(...) g(...)\ng <- function(...) ..2\nprint(f(u, v))', dropped: 'u <- 1' },
			{ name: 'a dots element by ...elt handed on', code: 'f <- function(...) g(...)\ng <- function(...) ...elt(2)\nu <- 1\nv <- 5\nprint(f(u, v))', dropped: 'u <- 1' },
			{ name: 'dots handed on to a parameter never read', code: 'f <- function(...) g(...)\ng <- function(a, b) b\nu <- 1\nv <- 5\nprint(f(u, v))', dropped: 'u <- 1' },
			{ name: 'dots handed on to a parameter by name', code: 'f <- function(...) g(...)\ng <- function(a, b) b\nu <- 1\nv <- 5\nprint(f(b = u, a = v))', dropped: 'v <- 5' },
			{ name: 'dots handed on twice to a parameter never read', code: 'f <- function(...) h(...)\nh <- function(...) g(...)\ng <- function(a, b) b\nu <- 1\nv <- 5\nprint(f(u, v))', dropped: 'u <- 1' },
			{ name: 'dots handed on beside a positional argument', code: 'f <- function(x, ...) g(x, ...)\ng <- function(a, b, c) c\nu <- 1\nv <- 5\nw <- 9\nprint(f(u, v, w))', dropped: 'v <- 5' },
			{ name: 'dots handed on to dots read by position', code: 'f <- function(...) g(...)\ng <- function(a, ...) ..1\nu <- 1\nv <- 5\nw <- 7\nprint(f(u, v, w))', dropped: 'w <- 7' },
			{ name: 'dots handed on to a parameter its default reads', code: 'f <- function(...) g(...)\ng <- function(a, b = a) b\nu <- 1\nprint(f(u))' },
			{ name: 'dots handed on to two functions', code: 'f <- function(...) { g(...); k(...) }\ng <- function(a, b) b\nk <- function(a, b) a\nu <- 1\nv <- 5\nprint(f(u, v))' },
			{ name: 'dots handed on to a parameter checked by missing', code: 'f <- function(...) g(...)\ng <- function(a, b) if(missing(a)) b else a\nu <- 1\nv <- 5\nprint(f(u, v))' },
			{ name: 'a side effect in dots never forced', code: 'f <- function(...) g(...)\ng <- function(a, b) b\nn <- 0\nr <- f(n <<- 1, 2)\nprint(n)', dropped: 'n <<- 1' },
			{ name: 'dots handed on after a positional argument', code: 'f <- function(x, ...) g(...)\ng <- function(a, b) a\nh <- function(...) f(9, ...)\np <- 4\nq <- 7\nprint(h(p, q))', dropped: 'q <- 7' },
			{ name: 'dots handed on beside a named argument', code: 'f <- function(...) g(k = 2, ...)\ng <- function(a, k) a\nx <- 8\nprint(f(x))' },
			{ name: 'dots collected into a list', code: 'x <- 3\nf <- function(...) { l <- list(...); l$b }\nprint(f(a = 1, b = x))' },
			{ name: 'a missing argument filled in', code: 'k <- 11\nf <- function(x) { if(missing(x)) x <- k; x }\nprint(f())' },
			{ name: 'a partially matched argument', code: 'x <- 6\nf <- function(value) value\nprint(f(val = x))' },
			{ name: 'a named argument reordered', code: 'x <- 2\ny <- 9\nf <- function(a, b) b\nprint(f(b = y, a = x))', dropped: 'x <- 2' },
			{ name: 'a default refers to a parameter changed before it is forced', code: 'f <- function(a, b = a) { a <- 10; b }\nprint(f(1))' },
			{ name: 'sys.call arguments evaluated by the callee', code: 'x <- 4\nf <- function(...) eval(substitute(alist(...))[[1]])\nprint(f(x))' }
		];
		for(const c of cases) {
			sliceMatchesR(parser, c);
		}
	});

	describe('promises', () => testing(['formals-promises'], () => {
		const cases: readonly TransitivityCase[] = [
			{ name: 'an argument never forced', code: 'x <- 1\nf <- function(a) 2\nf(x <- 5)\nprint(x)' },
			{ name: 'an argument forced', code: 'x <- 1\nf <- function(a) a\nf(x <- 5)\nprint(x)' },
			{ name: 'an argument forced three calls deep', code: 'x <- 1\nf <- function(a) g(a)\ng <- function(b) h(b)\nh <- function(cc) cc\nf(x <- 5)\nprint(x)' },
			{ name: 'an argument forced only once', code: 'n <- 0\nf <- function(a) { a; a }\nf(n <- n + 1)\nprint(n)' },
			{ name: 'an argument forced by force', code: 'x <- 1\nf <- function(a) { force(a); 2 }\nf(x <- 5)\nprint(x)' },
			{ name: 'an argument forced by a returned closure', code: 'x <- 1\nf <- function(a) function() a\ng <- f(x <- 5)\ng()\nprint(x)' },
			{ name: 'a default forced by a branch', code: 'x <- 1\nf <- function(a, b = (x <<- 7)) if(a) b else 0\nf(TRUE)\nprint(x)' },
			{ name: 'a default never forced', code: 'x <- 1\nf <- function(b = (x <<- 7)) 0\nf()\nprint(x)' },
			{ name: 'a promise forced in the caller frame', code: 'f <- function(a) { y <- 100; a }\ny <- 1\nprint(f(y + 1))' }
		];
		for(const c of cases) {
			sliceMatchesR(parser, c);
		}
	}));

	describe('promises of package functions', () => testing(['formals-promises', 'higher-order-functions'], () => {
		const cases: readonly TransitivityCase[] = [
			{ name: 'an argument kept by a purrr partial', code: 'x <- 1\ng <- purrr::partial(function(a) a, x)\nx <- 5\nprint(g())' },
			{ name: 'an attached purrr partial', code: 'library(purrr)\nx <- 1\ng <- partial(function(a) a, x)\nx <- 5\nprint(g())', sigdb: true },
			{ name: 'a named argument kept by a partial called through an alias', code: 'x <- 1\ng <- purrr::partial(function(a, b) a + b, b = x)\nh <- g\nx <- 5\nprint(h(1))' },
			{ name: 'a dplyr filter forcing its condition in the call', code: 'k <- 1\nd <- dplyr::filter(data.frame(a = 1:3), a > k)\nk <- 99\nprint(nrow(d))', dropped: 'k <- 99' }
		];
		for(const c of cases) {
			sliceMatchesR(parser, c);
		}
	}));

	describe('values', () => {
		resolvesLikeR(parser, 'a default referring to another parameter', 'f <- function(a, b = a * 2) b\ny <- f(4)\ncat(y)', '3@y');
		resolvesLikeR(parser, 'a default referring to a local defined later', 'f <- function(b = y) { y <- 3; b }\nz <- f()\ncat(z)', '3@z');
		resolvesLikeR(parser, 'a default refers to a parameter changed before it is forced', 'f <- function(a, b = a) { a <- 10; b }\ny <- f(1)\ncat(y)', '3@y');
		resolvesLikeR(parser, 'dots forwarded through three calls', 'f <- function(...) g(...)\ng <- function(...) h(...)\nh <- function(a, b) b\ny <- f(b = 1, a = 3)\ncat(y)', '5@y');
		resolvesLikeR(parser, 'a dots element by position handed on', 'u <- 1\nv <- 5\nf <- function(...) g(...)\ng <- function(...) ..2\ny <- f(u, v)\ncat(y)', '6@y');
		resolvesLikeR(parser, 'dots handed on after a positional argument', 'f <- function(x, ...) g(...)\ng <- function(a, b) a\nh <- function(...) f(9, ...)\ny <- h(4, 7)\ncat(y)', '5@y');
		resolvesLikeR(parser, 'dots handed on by two callers', 'f <- function(...) g(...)\ng <- function(a, b) b\ny <- f(1, 2)\nz <- f(b = 3, a = 4)\ncat(y)', '5@y');
		resolvesLikeR(parser, 'an argument never forced', 'x <- 1\nf <- function(a) 2\nf(x <- 5)\ncat(x)', '4@x');
		resolvesLikeR(parser, 'an argument in dots handed on never forced', 'x <- 1\nf <- function(...) g(...)\ng <- function(a, b) b\nf(x <- 5, 2)\ncat(x)', '5@x');
		resolvesLikeR(parser, 'an argument forced', 'x <- 1\nf <- function(a) a\nf(x <- 5)\ncat(x)', '4@x');
		resolvesLikeR(parser, 'a default never forced', 'x <- 1\nf <- function(b = (x <<- 7)) 0\nf()\ncat(x)', '4@x');
		resolvesLikeR(parser, 'a promise forced in the caller frame', 'f <- function(a) { y <- 100; a }\ny <- 1\nz <- f(y + 1)\ncat(z)', '4@z');
	});
}));
