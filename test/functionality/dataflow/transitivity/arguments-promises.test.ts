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
			{ name: 'a dots element by position', code: 'u <- 1\nv <- 5\nf <- function(...) ..2\nprint(f(u, v))', dropped: 'u <- 1', imprecise: 'keeps u <- 1, the first dots element' },
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

	describe('values', () => {
		resolvesLikeR(parser, 'a default referring to another parameter', 'f <- function(a, b = a * 2) b\ny <- f(4)\ncat(y)', '3@y');
		resolvesLikeR(parser, 'a default referring to a local defined later', 'f <- function(b = y) { y <- 3; b }\nz <- f()\ncat(z)', '3@z');
		resolvesLikeR(parser, 'a default refers to a parameter changed before it is forced', 'f <- function(a, b = a) { a <- 10; b }\ny <- f(1)\ncat(y)', '3@y', { imprecise: 'resolves 1 and 10, R forces b after a <- 10' });
		resolvesLikeR(parser, 'dots forwarded through three calls', 'f <- function(...) g(...)\ng <- function(...) h(...)\nh <- function(a, b) b\ny <- f(b = 1, a = 3)\ncat(y)', '5@y', { imprecise: 'unknown, forwarded dots are not matched to parameters' });
		resolvesLikeR(parser, 'an argument never forced', 'x <- 1\nf <- function(a) 2\nf(x <- 5)\ncat(x)', '4@x', { imprecise: 'resolves 1 and 5, R never forces the argument' });
		resolvesLikeR(parser, 'an argument forced', 'x <- 1\nf <- function(a) a\nf(x <- 5)\ncat(x)', '4@x', { imprecise: 'resolves 1 and 5, R always forces the argument' });
		resolvesLikeR(parser, 'a default never forced', 'x <- 1\nf <- function(b = (x <<- 7)) 0\nf()\ncat(x)', '4@x', { imprecise: 'resolves 1 and 7, R never forces the default' });
		resolvesLikeR(parser, 'a promise forced in the caller frame', 'f <- function(a) { y <- 100; a }\ny <- 1\nz <- f(y + 1)\ncat(z)', '4@z');
	});
}));
