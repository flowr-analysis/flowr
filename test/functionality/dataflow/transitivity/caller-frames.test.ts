import { describe } from 'vitest';
import { withTreeSitter } from '../../_helper/shell';
import { sliceMatchesR, type TransitivityCase } from './transitivity';

/** Writes into the frame of a caller further up (`parent.frame(n)`), each checked against what R leaves there. */
describe('Writes into the frames of callers, checked against R', withTreeSitter(parser => {
	const cases: readonly TransitivityCase[] = [
		{ name: 'parent.frame(2)', code: 'f <- function() g()\ng <- function() assign("y", 5, envir = parent.frame(2))\nh <- function() { y <- 1; f(); y }\nprint(h())' },
		{ name: 'parent.frame(3)', code: 'a <- function() b()\nb <- function() c2()\nc2 <- function() assign("y", 5, envir = parent.frame(3))\nh <- function() { y <- 1; a(); y }\nprint(h())' },
		{ name: 'parent.frame(2) reverse order', code: 'h <- function() { y <- 1; f(); y }\ng <- function() assign("y", 5, envir = parent.frame(2))\nf <- function() g()\nprint(h())' },
		{ name: 'parent.frame(2) to global', code: 'y <- 1\nf <- function() g()\ng <- function() assign("y", 5, envir = parent.frame(2))\nf()\nprint(y)' },
		{ name: 'parent.frame(2) evalq', code: 'f <- function() g()\ng <- function() evalq(y <- 5, parent.frame(2))\nh <- function() { y <- 1; f(); y }\nprint(h())' },
		{ name: 'parent.frame(2) dollar', code: 'f <- function() g()\ng <- function() { p <- parent.frame(2); p$y <- 5 }\nh <- function() { y <- 1; f(); y }\nprint(h())' },
		{ name: 'parent.frame(1) explicit', code: 'g <- function() assign("y", 5, envir = parent.frame(1))\nh <- function() { y <- 1; g(); y }\nprint(h())' }
	];
	for(const c of cases) {
		sliceMatchesR(parser, c);
	}
}));
