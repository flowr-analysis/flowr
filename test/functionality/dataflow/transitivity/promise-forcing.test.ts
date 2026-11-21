import { describe } from 'vitest';
import { withTreeSitter } from '../../_helper/shell';
import { resolvesLikeR, sliceMatchesR, type TransitivityCase } from './transitivity';

/* a promise reads the state at the point it is forced, wherever that is */
describe('Transitivity through promises forced late, checked against R', withTreeSitter(parser => {
	const cases: readonly TransitivityCase[] = [
		{ name: 'forced three calls down after a write', code: 'f <- function(a) g(a)\ng <- function(b) h(b)\nh <- function(c) { y <<- 2; c }\ny <- 0\nprint(f(y))' },
		{ name: 'forced by force after a write', code: 'f <- function(a) { z <<- 7; force(a) }\nz <- 1\nprint(f(z))' },
		{ name: 'checked by missing before a write', code: 'f <- function(a) { if(!missing(a)) w <<- 3; a }\nw <- 1\nprint(f(w))' },
		{ name: 'forced by match.arg after a write', code: 'f <- function(m) { mm <<- "b"; match.arg(m, c("a", "b")) }\nmm <- "a"\nprint(f(mm))' },
		{ name: 'a default reading a global written before forcing', code: 'f <- function(a = gg) { gg <<- 6; a }\ngg <- 1\nprint(f())' },
		{ name: 'forced through the dots', code: 'f <- function(...) { d <<- 8; list(...)[[1]] }\nd <- 1\nprint(f(d))' },
		{ name: 'forced in a callback after a write', code: 'f <- function(a) { s <<- 2; lapply(1, function(i) a)[[1]] }\ns <- 0\nprint(f(s))' },
		{ name: 'forced in an exit hook one call down', code: 'f <- function(a) g(a)\ng <- function(b) { on.exit(r <<- b); u <<- 4 }\nu <- 0\nf(u)\nprint(r)' },
		{ name: 'an expression forced after a write', code: 'f <- function(a) { q <<- 3; a }\nq <- 1\nprint(f(q * 10))' },
		{ name: 'a sibling argument written first', code: 'f <- function(p, q) { q; p }\nk <- 0\nprint(f(k, k <- 9))' },
		{ name: 'a sibling argument written later', code: 'f <- function(p, q) { p; q }\nk <- 0\nprint(f(k, k <- 9))' },
		{ name: 'forced by a closure after the call', code: 'mk <- function(a) function() a\nx <- 1\nh <- mk(x)\nx <- 5\nprint(h())' },
		{ name: 'forced by a stored closure after the call', code: 'mk <- function(a) list(get = function() a)\nx <- 1\nh <- mk(x)\nx <- 5\nprint(h$get())' }
	];
	for(const c of cases) {
		sliceMatchesR(parser, c);
	}
	resolvesLikeR(parser, 'value forced three calls down', 'f <- function(a) g(a)\ng <- function(b) h(b)\nh <- function(c) { y <<- 2; c }\ny <- 0\nv <- f(y)\ncat(v)', '5@v');
	resolvesLikeR(parser, 'value forced by a closure after the call', 'mk <- function(a) function() a\nx <- 1\nh <- mk(x)\nx <- 5\nv <- h()\ncat(v)', '5@v');
}));
