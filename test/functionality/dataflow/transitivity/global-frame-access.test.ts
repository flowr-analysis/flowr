import { describe } from 'vitest';
import { withTreeSitter } from '../../_helper/shell';
import { sliceMatchesR, type TransitivityCase } from './transitivity';

/** What a function defined at the top hands out as its environment is the global frame, read through fields and lookups, checked against R. */
describe('Reading the global frame through the environment of a function, checked against R', withTreeSitter(parser => {
	const cases: readonly TransitivityCase[] = [
		{ name: 'environment(g)$f()', code: 'f <- function() k\ng <- function() NULL\nk <- 22\nprint(environment(g)$f())' },
		{ name: 'environment(g)[[f]]()', code: 'f <- function() k\ng <- function() NULL\nk <- 22\nprint(environment(g)[["f"]]())' },
		{ name: 'env held in a variable', code: 'f <- function() k\ng <- function() NULL\nk <- 22\ne <- environment(g)\nprint(e$f())' },
		{ name: 'get from environment(g)', code: 'f <- function() k\ng <- function() NULL\nk <- 22\nprint(get("f", envir = environment(g))())' },
		{ name: 'value from environment(g)', code: 'g <- function() NULL\nk <- 22\nprint(environment(g)$k)' }
	];
	for(const c of cases) {
		sliceMatchesR(parser, c);
	}
}));
